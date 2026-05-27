from datetime import datetime

from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.workflow import Workflow
from app.models.run import Run
from app.config import get_settings
from app.runtime.context_assembler import ContextAssembler
from app.runtime.provider_factory import create_provider
from app.services import observatory_service
from app.services.trace_service import create_trace_event


class WorkflowRunner:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.context_assembler = ContextAssembler(db)
        self.settings = get_settings()
        self.provider = create_provider(self.settings)

    def run(self, workflow: Workflow, task: str) -> Run:
        run = self.start(workflow, task)
        try:
            return self.execute_run(run.id)
        except Exception as exc:
            self.fail_run(run.id, str(exc))
            raise

    def start(self, workflow: Workflow, task: str) -> Run:
        if workflow.workflow_type != "sequential":
            raise ValueError(f"Workflow type {workflow.workflow_type} is a placeholder in the MVP runtime.")

        agents = self._workflow_agents(workflow)
        run = Run(
            workflow_id=workflow.id,
            input={"task": task},
            status="running",
            started_at=datetime.utcnow(),
            config_snapshot=self._config_snapshot(workflow, agents),
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)

        create_trace_event(self.db, run.id, "run_started", {"task": task})
        create_trace_event(
            self.db,
            run.id,
            "workflow_loaded",
            {"workflow_id": workflow.id, "workflow_type": workflow.workflow_type, "agent_sequence": [agent.id for agent in agents]},
        )

        for sequence_index, agent in enumerate(agents):
            observatory_service.create_execution(
                self.db,
                run.id,
                agent,
                sequence_index,
                {"task": task if sequence_index == 0 else None},
                provider=self.settings.llm_provider,
            )

        return run

    def execute_run(self, run_id: int) -> Run:
        run = self.db.get(Run, run_id)
        if run is None:
            raise ValueError("Run not found.")
        workflow = self.db.get(Workflow, run.workflow_id)
        if workflow is None:
            raise ValueError("Workflow not found.")
        agents = self._snapshot_agents(run)
        executions = observatory_service.list_executions_for_run(self.db, run.id)
        executions_by_step = {(execution.agent_id, execution.sequence_index): execution for execution in executions}
        agent_outputs = []
        current_task = str(run.input.get("task", ""))
        for sequence_index, agent in enumerate(agents):
            execution = executions_by_step.get((agent.id, sequence_index))
            if execution is None:
                execution = observatory_service.create_execution(
                    self.db,
                    run.id,
                    agent,
                    sequence_index,
                    {"task": current_task},
                    provider=self.settings.llm_provider,
                )
            else:
                execution.input_payload = {"task": current_task}
                self.db.commit()
                self.db.refresh(execution)
            create_trace_event(self.db, run.id, "agent_selected", {"agent_id": agent.id, "agent_name": agent.name}, agent.id)
            observatory_service.start_execution(self.db, execution)
            observatory_service.create_execution_event(
                self.db,
                execution,
                "context_assembly_started",
                {"task": current_task},
            )
            observatory_service.create_execution_event(
                self.db,
                execution,
                "memory_retrieval_started",
                {"agent_id": agent.id},
            )
            assembled = self.context_assembler.assemble(agent.id, current_task)
            observatory_service.create_execution_event(
                self.db,
                execution,
                "context_assembled",
                {"prompt": assembled.prompt, "metadata": assembled.metadata, "sections": assembled.sections},
            )
            create_trace_event(
                self.db,
                run.id,
                "context_assembled",
                {"prompt": assembled.prompt, "metadata": assembled.metadata, "sections": assembled.sections},
                agent.id,
            )
            create_trace_event(
                self.db,
                run.id,
                "memory_retrieved",
                {"memory_ids": assembled.metadata["memory_ids"]},
                agent.id,
            )
            observatory_service.create_execution_event(
                self.db,
                execution,
                "memory_retrieved",
                {"memory_ids": assembled.metadata["memory_ids"]},
            )
            observatory_service.create_execution_event(
                self.db,
                execution,
                "llm_request_started",
                {"provider": self.settings.llm_provider, "model": agent.model, "temperature": agent.temperature},
            )
            create_trace_event(
                self.db,
                run.id,
                "llm_request_started",
                {"provider": self.settings.llm_provider, "model": agent.model, "temperature": agent.temperature},
                agent.id,
            )
            try:
                provider_response = self.provider.generate(
                    assembled.prompt,
                    {
                        "agent_name": agent.name,
                        "task": current_task,
                        "model": agent.model,
                        "temperature": agent.temperature,
                        "max_tokens": agent.max_tokens,
                    },
                )
            except Exception as exc:
                observatory_service.fail_execution(self.db, execution, str(exc))
                raise
            observatory_service.create_execution_event(
                self.db,
                execution,
                "llm_response_received",
                {"metadata": provider_response.metadata, "content_preview": provider_response.content[:500]},
            )
            create_trace_event(
                self.db,
                run.id,
                "llm_response_received",
                {"metadata": provider_response.metadata, "content_preview": provider_response.content[:500]},
                agent.id,
            )
            observatory_service.record_token_usage(
                self.db,
                execution,
                assembled.prompt,
                provider_response.content,
                provider_response.metadata,
            )
            agent_output = {
                "agent_id": agent.id,
                "agent_name": agent.name,
                "content": provider_response.content,
                "metadata": provider_response.metadata,
            }
            agent_outputs.append(agent_output)
            create_trace_event(self.db, run.id, "agent_output", agent_output, agent.id)
            create_trace_event(
                self.db,
                run.id,
                "memory_proposed",
                {"write_mode": agent.memory_policy.get("write_mode", "manual_review"), "proposed": False},
                agent.id,
            )
            observatory_service.create_execution_event(
                self.db,
                execution,
                "memory_write_proposed",
                {"write_mode": agent.memory_policy.get("write_mode", "manual_review"), "proposed": False},
            )
            observatory_service.complete_execution(self.db, execution, agent_output)
            create_trace_event(
                self.db,
                run.id,
                "agent_completed",
                {"agent_id": agent.id, "agent_name": agent.name},
                agent.id,
            )
            current_task = provider_response.content

        run.status = "completed"
        run.output = {"final_output": agent_outputs[-1]["content"] if agent_outputs else "", "agent_outputs": agent_outputs}
        run.ended_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(run)
        create_trace_event(self.db, run.id, "run_completed", {"status": run.status, "agent_count": len(agent_outputs)})
        return run

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

    def _workflow_agents(self, workflow: Workflow) -> list[Agent]:
        agent_ids = workflow.graph_config.get("agent_sequence", [])
        agents = []
        for agent_id in agent_ids:
            agent = self.db.get(Agent, agent_id)
            if agent is None or not agent.is_active:
                raise ValueError(f"Workflow references missing or inactive agent {agent_id}.")
            agents.append(agent)
        return agents

    def _snapshot_agents(self, run: Run) -> list[Agent]:
        agent_ids = [agent["id"] for agent in run.config_snapshot.get("agents", []) if "id" in agent]
        agents = []
        for agent_id in agent_ids:
            agent = self.db.get(Agent, agent_id)
            if agent is None or not agent.is_active:
                raise ValueError(f"Workflow references missing or inactive agent {agent_id}.")
            agents.append(agent)
        return agents

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
