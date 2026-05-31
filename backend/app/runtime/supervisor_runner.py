from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.workflow import Workflow
from app.models.run import Run
from app.runtime.action_decision_parser import parse_supervisor_decision
from app.runtime.context_assembler import ContextAssembler
from app.runtime.provider_interface import ProviderInterface
from app.services import observatory_service
from app.services.trace_service import create_trace_event


class SupervisorRunner:
    """Execute a supervisor agent that delegates tasks to worker agents in a loop.

    The supervisor receives the task, decides which worker to delegate to (or finishes),
    and accumulates worker outputs in run-scoped context. Workers only see the
    supervisor's explicit instruction and their own context/memory/tools/settings.
    """

    def __init__(self, db: Session, provider: ProviderInterface, settings) -> None:
        self.db = db
        self.context_assembler = ContextAssembler(db)
        self.settings = settings
        self.provider = provider

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(self, workflow: Workflow, task: str) -> Run:
        run = self.start(workflow, task)
        try:
            return self.execute_run(run.id)
        except Exception as exc:
            self.fail_run(run.id, str(exc))
            raise

    def start(self, workflow: Workflow, task: str) -> Run:
        supervisor, workers = self._validate_and_load(workflow)

        run = Run(
            workflow_id=workflow.id,
            input={"task": task},
            status="running",
            started_at=datetime.utcnow(),
            config_snapshot=self._config_snapshot(workflow, [supervisor] + workers),
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)

        create_trace_event(self.db, run.id, "run_started", {"task": task})
        create_trace_event(
            self.db,
            run.id,
            "workflow_loaded",
            {
                "workflow_id": workflow.id,
                "workflow_type": workflow.workflow_type,
                "supervisor_agent_id": supervisor.id,
                "worker_agent_ids": [w.id for w in workers],
            },
        )

        observatory_service.create_execution(
            self.db, run.id, supervisor, 0,
            {"task": task}, provider=self.settings.llm_provider,
        )

        return run

    def execute_run(self, run_id: int) -> Run:
        run = self.db.get(Run, run_id)
        if run is None:
            raise ValueError("Run not found.")
        workflow = self.db.get(Workflow, run.workflow_id)
        if workflow is None:
            raise ValueError("Workflow not found.")

        supervisor, workers = self._validate_and_load(workflow)
        max_iterations = int(workflow.graph_config.get("max_iterations", 10))
        worker_by_id: dict[int, Agent] = {w.id: w for w in workers}

        supervisor_execution = self._get_or_create_execution(run, supervisor, 0, {"task": str(run.input.get("task", ""))})
        self._emit_agent_selected(run.id, supervisor)
        observatory_service.start_execution(self.db, supervisor_execution)

        accumulated_outputs: list[dict[str, Any]] = []
        current_task = str(run.input.get("task", ""))

        for iteration in range(1, max_iterations + 1):
            supervisor_context = self._assemble_supervisor_context(
                supervisor, current_task, accumulated_outputs, iteration, max_iterations, workers,
            )
            self._emit_context_events(run.id, supervisor.id, supervisor_execution, supervisor_context)

            supervisor_response = self._call_llm(supervisor, supervisor_context, supervisor_execution, run.id)
            parse_result = parse_supervisor_decision(supervisor_response.content)

            self._emit_parse_event(run.id, supervisor.id, supervisor_execution, parse_result)
            create_trace_event(
                self.db, run.id, "supervisor_decision",
                {
                    "iteration": iteration,
                    "decision": parse_result.decision.model_dump(),
                    "parse_success": parse_result.parse_success,
                },
                supervisor.id,
            )

            decision = parse_result.decision

            if decision.action == "finish":
                final_response = decision.final_response or supervisor_response.content
                observatory_service.complete_execution(
                    self.db, supervisor_execution,
                    {"agent_id": supervisor.id, "agent_name": supervisor.name, "content": final_response},
                )
                create_trace_event(
                    self.db, run.id, "agent_output",
                    {"agent_id": supervisor.id, "agent_name": supervisor.name, "content": final_response}, supervisor.id,
                )
                self._emit_agent_completed(run.id, supervisor)
                run.status = "completed"
                run.output = {"final_output": final_response, "agent_outputs": accumulated_outputs, "iterations": iteration}
                run.ended_at = datetime.utcnow()
                self.db.commit()
                self.db.refresh(run)
                create_trace_event(self.db, run.id, "run_completed", {"status": run.status, "iterations": iteration})
                return run

            # action == "delegate"
            target_agent_id = decision.agent_id
            if target_agent_id not in worker_by_id:
                error_msg = f"Supervisor attempted to delegate to agent {target_agent_id}, which is not in worker_agent_ids."
                observatory_service.create_execution_event(
                    self.db, supervisor_execution, "invalid_delegation_target",
                    {"requested_agent_id": target_agent_id, "allowed_ids": list(worker_by_id.keys())},
                )
                raise ValueError(error_msg)

            worker = worker_by_id[target_agent_id]
            instruction = decision.instruction or ""
            create_trace_event(
                self.db, run.id, "supervisor_delegated",
                {"from_agent_id": supervisor.id, "to_agent_id": worker.id, "instruction": instruction, "iteration": iteration},
                supervisor.id,
            )

            worker_execution = self._get_or_create_execution(run, worker, iteration, {"task": instruction})
            self._emit_agent_selected(run.id, worker)
            observatory_service.start_execution(self.db, worker_execution)

            worker_task = self._build_worker_task(
                supervisor.name, instruction, str(run.input.get("task", "")), accumulated_outputs,
            )
            worker_context = self.context_assembler.assemble(worker.id, worker_task)
            self._emit_context_events(run.id, worker.id, worker_execution, worker_context)

            worker_response = self._call_llm(worker, worker_context, worker_execution, run.id)
            observatory_service.complete_execution(
                self.db, worker_execution,
                {"agent_id": worker.id, "agent_name": worker.name, "content": worker_response.content},
            )
            create_trace_event(
                self.db, run.id, "agent_output",
                {"agent_id": worker.id, "agent_name": worker.name, "content": worker_response.content}, worker.id,
            )
            self._emit_agent_completed(run.id, worker)

            worker_output = {
                "agent_id": worker.id,
                "agent_name": worker.name,
                "content": worker_response.content,
            }
            accumulated_outputs.append(worker_output)
            create_trace_event(
                self.db, run.id, "worker_responded",
                {"from_agent_id": worker.id, "to_agent_id": supervisor.id, "content_preview": worker_response.content[:500], "iteration": iteration},
                worker.id,
            )

            current_task = (
                f"Worker '{worker.name}' (id={worker.id}) responded in iteration {iteration}:\n"
                f"{worker_response.content}\n\n"
                f"Decide next action: delegate to another worker or finish with final_response."
            )

        # max_iterations reached
        self._fail_with_limit(run, max_iterations, supervisor_execution)
        raise ValueError(f"Supervisor reached max_iterations ({max_iterations}) without finishing.")

    def fail_run(self, run_id: int, error_message: str) -> Run:
        run = self.db.get(Run, run_id)
        if run is None:
            raise ValueError("Run not found.")
        for execution in observatory_service.list_executions_for_run(self.db, run.id):
            if execution.status in {"queued", "running"}:
                observatory_service.fail_execution(self.db, execution, error_message)
        run.status = "failed"
        run.output = {"error": error_message}
        run.ended_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(run)
        create_trace_event(self.db, run.id, "run_failed", {"error_message": error_message})
        return run

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _validate_and_load(self, workflow: Workflow) -> tuple[Agent, list[Agent]]:
        graph = workflow.graph_config
        supervisor_id = graph.get("supervisor_agent_id")
        worker_ids = graph.get("worker_agent_ids", [])

        if not supervisor_id:
            raise ValueError("graph_config.supervisor_agent_id is required for supervisor workflows.")
        if not isinstance(worker_ids, list) or len(worker_ids) == 0:
            raise ValueError("graph_config.worker_agent_ids must be a non-empty list for supervisor workflows.")

        supervisor = self.db.get(Agent, supervisor_id)
        if supervisor is None or not supervisor.is_active:
            raise ValueError(f"Supervisor agent {supervisor_id} not found or inactive.")

        workers: list[Agent] = []
        for wid in worker_ids:
            worker = self.db.get(Agent, wid)
            if worker is None or not worker.is_active:
                raise ValueError(f"Worker agent {wid} not found or inactive.")
            workers.append(worker)

        return supervisor, workers

    def _get_or_create_execution(self, run: Run, agent: Agent, sequence_index: int, input_payload: dict) -> Any:
        """Return an existing queued/running execution for this agent, or create a new one.

        For supervisor workflows, worker executions are created lazily on first delegation.
        For the supervisor itself, the execution created in start() is reused.
        Matching is by agent_id only — sequence_index is metadata, not identity.
        """
        executions = observatory_service.list_executions_for_run(self.db, run.id)
        for ex in executions:
            if ex.agent_id == agent.id and ex.status in ("queued", "running"):
                ex.input_payload = input_payload
                ex.sequence_index = sequence_index
                self.db.commit()
                self.db.refresh(ex)
                return ex
        return observatory_service.create_execution(
            self.db, run.id, agent, sequence_index, input_payload, provider=self.settings.llm_provider,
        )

    def _build_worker_task(self, supervisor_name: str, instruction: str, original_task: str, accumulated_outputs: list[dict]) -> str:
        """Build the task text a worker receives when delegated to.

        Includes the supervisor's instruction, the original workflow task,
        and outputs from workers who already ran. This ensures workers have
        enough context to understand references like "case TK-7712" or
        "based on triage output" without receiving private memory/context.
        """
        accumulated_text = "None yet."
        if accumulated_outputs:
            lines = []
            for item in accumulated_outputs:
                lines.append(f"[{item['agent_name']} (id={item['agent_id']})]: {item['content']}")
            accumulated_text = "\n\n".join(lines)

        return (
            f"## Supervisor instruction from '{supervisor_name}'\n{instruction}\n\n"
            f"## Original workflow task\n{original_task}\n\n"
            f"## Outputs from workers who already ran\n{accumulated_text}"
        )

    def _assemble_supervisor_context(self, supervisor: Agent, task: str, accumulated: list[dict], iteration: int, max_iter: int, workers: list[Agent] | None = None) -> Any:
        accumulated_text = "No worker outputs yet."
        if accumulated:
            lines = []
            for item in accumulated:
                lines.append(f"[{item['agent_name']} (id={item['agent_id']})]: {item['content']}")
            accumulated_text = "\n\n".join(lines)

        worker_list_text = "No workers available."
        if workers:
            worker_lines = []
            for w in workers:
                worker_lines.append(f"- Worker ID {w.id}: {w.name} (role: {w.role})")
            worker_list_text = "\n".join(worker_lines)

        base = self.context_assembler.assemble(supervisor.id, task)
        supervisor_prompt = (
            f"{base.prompt}\n\n"
            f"## Available workers (use these agent_id values in delegate actions)\n{worker_list_text}\n\n"
            f"## Accumulated worker outputs (iteration {iteration}/{max_iter})\n{accumulated_text}\n\n"
            "## Output format instruction\n"
            "You MUST respond with a JSON object. Choose one of:\n"
            '{"action": "delegate", "agent_id": <int>, "instruction": "<what the worker should do>", "reasoning": "<why>"}\n'
            '{"action": "finish", "final_response": "<your complete final response>", "reasoning": "<why>"}\n'
            "Use only worker IDs from the available workers list above. Do not include any text outside the JSON object."
        )
        base.prompt = supervisor_prompt
        return base

    def _call_llm(self, agent: Agent, assembled_context: Any, execution: Any, run_id: int) -> Any:
        from app.runtime.provider_interface import ProviderResponse

        create_trace_event(
            self.db, run_id, "llm_request_started",
            {"provider": self.settings.llm_provider, "model": agent.model, "temperature": agent.temperature}, agent.id,
        )
        try:
            config = {"agent_name": agent.name, "task": "", "model": agent.model, "temperature": agent.temperature, "max_tokens": agent.max_tokens}
            response = self.provider.generate(assembled_context.prompt, config)
        except Exception:
            observatory_service.fail_execution(self.db, execution, "LLM call failed")
            raise
        create_trace_event(
            self.db, run_id, "llm_response_received",
            {"metadata": response.metadata, "content_preview": response.content[:500]}, agent.id,
        )
        observatory_service.record_token_usage(
            self.db, execution, assembled_context.prompt, response.content, response.metadata,
        )
        return response

    def _emit_agent_selected(self, run_id: int, agent: Agent) -> None:
        create_trace_event(self.db, run_id, "agent_selected", {"agent_id": agent.id, "agent_name": agent.name}, agent.id)

    def _emit_agent_completed(self, run_id: int, agent: Agent) -> None:
        create_trace_event(self.db, run_id, "agent_completed", {"agent_id": agent.id, "agent_name": agent.name}, agent.id)

    def _emit_context_events(self, run_id: int, agent_id: int, execution: Any, assembled: Any) -> None:
        observatory_service.create_execution_event(self.db, execution, "context_assembly_started", {"agent_id": agent_id})
        observatory_service.create_execution_event(self.db, execution, "context_assembled", {"prompt": assembled.prompt[:500], "metadata": assembled.metadata})
        create_trace_event(self.db, run_id, "context_assembled", {"prompt": assembled.prompt[:500], "metadata": assembled.metadata}, agent_id)
        create_trace_event(self.db, run_id, "memory_retrieved", {"memory_ids": assembled.metadata.get("memory_ids", [])}, agent_id)

    def _emit_parse_event(self, run_id: int, agent_id: int, execution: Any, parse_result: Any) -> None:
        if parse_result.parse_success:
            create_trace_event(
                self.db, run_id, "action_parse_succeeded",
                {"agent_id": agent_id, "action": parse_result.decision.action}, agent_id,
            )
            observatory_service.create_execution_event(
                self.db, execution, "action_parse_succeeded",
                {"action": parse_result.decision.action},
            )
        else:
            create_trace_event(
                self.db, run_id, "action_parse_failed",
                {"agent_id": agent_id, "error": parse_result.parse_error, "raw_preview": parse_result.raw[:200]}, agent_id,
            )
            observatory_service.create_execution_event(
                self.db, execution, "action_parse_failed",
                {"error": parse_result.parse_error, "raw_preview": parse_result.raw[:200]},
            )

    def _fail_with_limit(self, run: Run, max_iterations: int, supervisor_execution: Any) -> None:
        error_msg = f"Supervisor reached max_iterations ({max_iterations}) without finishing."
        observatory_service.fail_execution(self.db, supervisor_execution, error_msg)
        run.status = "failed"
        run.output = {"error": error_msg}
        run.ended_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(run)
        create_trace_event(self.db, run.id, "run_failed", {"error_message": error_msg})

    def _config_snapshot(self, workflow: Workflow, agents: list[Agent]) -> dict:
        return {
            "workflow": {
                "id": workflow.id,
                "name": workflow.name,
                "workflow_type": workflow.workflow_type,
                "graph_config": workflow.graph_config,
            },
            "agents": [
                {
                    "id": agent.id,
                    "name": agent.name,
                    "role": agent.role,
                    "soul_id": agent.soul_id,
                    "llm_provider": agent.llm_provider,
                    "model": agent.model,
                    "temperature": agent.temperature,
                    "max_tokens": agent.max_tokens,
                    "system_prompt": agent.system_prompt,
                    "memory_policy": agent.memory_policy,
                    "context_policy": agent.context_policy,
                    "handoff_policy": agent.handoff_policy,
                }
                for agent in agents
            ],
        }
