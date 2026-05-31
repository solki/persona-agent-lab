"""Handoff swarm runner — peer-to-peer agent handoff chain.

Agents in a handoff swarm process a task and voluntarily transfer it
to another agent based on their handoff_policy. The chain ends when
an agent decides not to hand off (finish).

Reuses ActionParseResult pattern from action_decision_parser and the
HandoffEngine for policy enforcement.
"""

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.run import Run
from app.models.workflow import Workflow
from app.runtime.context_assembler import ContextAssembler
from app.runtime.handoff_engine import HandoffEngine
from app.runtime.provider_interface import ProviderInterface
from app.schemas.actions import HandoffDecision
from app.services import observatory_service
from app.runtime.action_decision_parser import ActionParseResult
from app.services.trace_service import create_trace_event


class HandoffSwarmRunner:
    """Execute a peer-to-peer handoff chain.

    The entry agent starts the task. Each agent may finish or hand off
    to another participant.  Handoffs are validated against the
    sender's handoff_policy and the workflow's participant list.
    """

    def __init__(self, db: Session, provider: ProviderInterface, settings) -> None:
        self.db = db
        self.context_assembler = ContextAssembler(db)
        self.settings = settings
        self.provider = provider
        self.handoff_engine = HandoffEngine()

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
        entry_agent, participants = self._validate_and_load(workflow)

        run = Run(
            workflow_id=workflow.id,
            input={"task": task},
            status="running",
            started_at=datetime.utcnow(),
            config_snapshot=self._config_snapshot(workflow, [entry_agent] + [p for p in participants if p.id != entry_agent.id]),
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)

        create_trace_event(self.db, run.id, "run_started", {"task": task})
        create_trace_event(
            self.db, run.id, "workflow_loaded",
            {"workflow_id": workflow.id, "workflow_type": workflow.workflow_type,
             "entry_agent_id": entry_agent.id, "participant_agent_ids": [p.id for p in participants]},
        )

        observatory_service.create_execution(
            self.db, run.id, entry_agent, 0,
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

        entry_agent, participants = self._validate_and_load(workflow)
        max_handoffs = int(workflow.graph_config.get("max_handoffs", 10))
        participant_by_id: dict[int, Agent] = {p.id: p for p in participants}
        original_task = str(run.input.get("task", ""))

        handoff_chain: list[dict[str, Any]] = []
        current_agent = entry_agent
        current_task = original_task
        sequence_index = 0

        for _ in range(max_handoffs + 1):  # +1 for the final finish
            execution = self._get_or_create_execution(run, current_agent, sequence_index, {"task": current_task})
            self._emit_agent_selected(run.id, current_agent)
            observatory_service.start_execution(self.db, execution)

            assembled = self._assemble_handoff_context(
                current_agent, current_task, handoff_chain, original_task, participants,
            )
            self._emit_context_events(run.id, current_agent.id, execution, assembled)

            response = self._call_llm(current_agent, assembled, execution, run.id)
            parse_result = self._parse_handoff_decision(response.content)

            self._emit_parse_event(run.id, current_agent.id, execution, parse_result)
            create_trace_event(
                self.db, run.id, "handoff_decision",
                {"decision": parse_result.decision.model_dump(), "parse_success": parse_result.parse_success},
                current_agent.id,
            )

            decision = parse_result.decision

            if decision.action == "finish":
                final_response = decision.final_response or response.content
                observatory_service.complete_execution(
                    self.db, execution,
                    {"agent_id": current_agent.id, "agent_name": current_agent.name, "content": final_response},
                )
                create_trace_event(
                    self.db, run.id, "agent_output",
                    {"agent_id": current_agent.id, "agent_name": current_agent.name, "content": final_response},
                    current_agent.id,
                )
                self._emit_agent_completed(run.id, current_agent)
                create_trace_event(
                    self.db, run.id, "handoff_completed",
                    {"final_agent_id": current_agent.id, "chain_agent_ids": [h["agent_id"] for h in handoff_chain] + [current_agent.id],
                     "total_handoffs": len(handoff_chain)},
                    current_agent.id,
                )
                run.status = "completed"
                run.output = {"final_output": final_response, "handoff_chain": handoff_chain, "total_handoffs": len(handoff_chain)}
                run.ended_at = datetime.utcnow()
                self.db.commit()
                self.db.refresh(run)
                create_trace_event(self.db, run.id, "run_completed", {"status": run.status, "total_handoffs": len(handoff_chain)})
                return run

            # action == "handoff"
            target_id = decision.target_agent_id
            if target_id is None or target_id not in participant_by_id:
                denied_msg = f"Handoff to agent {target_id} denied: not in participant_agent_ids."
                create_trace_event(
                    self.db, run.id, "handoff_denied",
                    {"from_agent_id": current_agent.id, "to_agent_id": target_id, "reason": "not_in_participants"},
                    current_agent.id,
                )
                observatory_service.create_execution_event(
                    self.db, execution, "handoff_denied",
                    {"reason": "not_in_participants", "requested_agent_id": target_id},
                )
                current_task = f"Handoff to agent {target_id} was denied (not in participants). Choose another target or finish."
                continue

            target_agent = participant_by_id[target_id]
            handoff_policy = current_agent.handoff_policy or {}
            engine_decision = self.handoff_engine.evaluate(handoff_policy, target_id, decision.payload or {})

            create_trace_event(
                self.db, run.id, "handoff_requested",
                {"from_agent_id": current_agent.id, "to_agent_id": target_id, "requested_at": datetime.utcnow().isoformat()},
                current_agent.id,
            )

            if not engine_decision.allowed:
                create_trace_event(
                    self.db, run.id, "handoff_denied",
                    {"from_agent_id": current_agent.id, "to_agent_id": target_id, "reason": engine_decision.reason},
                    current_agent.id,
                )
                observatory_service.create_execution_event(
                    self.db, execution, "handoff_denied",
                    {"reason": engine_decision.reason, "requested_agent_id": target_id},
                )
                current_task = f"Handoff to agent {target_id} was denied by sender policy: {engine_decision.reason}. Choose another target or finish."
                continue

            # Handoff allowed
            create_trace_event(
                self.db, run.id, "handoff_allowed",
                {"from_agent_id": current_agent.id, "to_agent_id": target_id,
                 "payload_summary": str(decision.payload or {})[:200]},
                current_agent.id,
            )
            handoff_chain.append({
                "from_agent_id": current_agent.id,
                "from_agent_name": current_agent.name,
                "to_agent_id": target_id,
                "to_agent_name": target_agent.name,
                "payload_summary": str(decision.payload or {})[:300],
            })
            observatory_service.complete_execution(
                self.db, execution,
                {"agent_id": current_agent.id, "agent_name": current_agent.name,
                 "handoff_to": target_id},
            )
            sequence_index += 1
            current_agent = target_agent
            current_task = f"Handoff from '{handoff_chain[-1]['from_agent_name']}': {json.dumps(decision.payload or {})}"
            continue

        # max_handoffs exceeded
        error_msg = f"Handoff chain exceeded max_handoffs ({max_handoffs})."
        run.status = "failed"
        run.output = {"error": error_msg, "handoff_chain": handoff_chain}
        run.ended_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(run)
        create_trace_event(self.db, run.id, "run_failed", {"error_message": error_msg})
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

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _validate_and_load(self, workflow: Workflow) -> tuple[Agent, list[Agent]]:
        graph = workflow.graph_config
        entry_id = graph.get("entry_agent_id")
        participant_ids = graph.get("participant_agent_ids", [])

        if not entry_id:
            raise ValueError("graph_config.entry_agent_id is required for handoff_swarm workflows.")
        if not isinstance(participant_ids, list) or len(participant_ids) == 0:
            raise ValueError("graph_config.participant_agent_ids must be non-empty.")
        if entry_id not in participant_ids:
            raise ValueError("entry_agent_id must be included in participant_agent_ids.")

        entry = self.db.get(Agent, entry_id)
        if entry is None or not entry.is_active:
            raise ValueError(f"Entry agent {entry_id} not found or inactive.")

        participants: list[Agent] = []
        for pid in participant_ids:
            agent = self.db.get(Agent, pid)
            if agent is None or not agent.is_active:
                raise ValueError(f"Participant agent {pid} not found or inactive.")
            participants.append(agent)

        return entry, participants

    def _get_or_create_execution(self, run: Run, agent: Agent, sequence_index: int, input_payload: dict) -> Any:
        executions = observatory_service.list_executions_for_run(self.db, run.id)
        for ex in executions:
            if ex.agent_id == agent.id and ex.status in ("queued",):
                ex.input_payload = input_payload
                ex.sequence_index = sequence_index
                self.db.commit()
                self.db.refresh(ex)
                return ex
        return observatory_service.create_execution(
            self.db, run.id, agent, sequence_index, input_payload, provider=self.settings.llm_provider,
        )

    def _assemble_handoff_context(self, agent: Agent, task: str, chain: list[dict], original_task: str, participants: list[Agent]) -> Any:
        chain_text = "No prior handoffs."
        if chain:
            lines = [f"{i+1}. {h['from_agent_name']} → {h['to_agent_name']}: {h['payload_summary']}" for i, h in enumerate(chain)]
            chain_text = "\n".join(lines)

        # Calculate available handoff targets:
        # participants ∩ handoff_policy.allowed_agent_ids, excluding self
        handoff_policy = agent.handoff_policy or {}
        allow_handoff = handoff_policy.get("allow_handoff", False)
        sender_allowed = set(handoff_policy.get("allowed_agent_ids", []))
        participant_ids = {p.id for p in participants}

        targets_text = "No handoff targets are currently available. You must finish or explain why you cannot proceed."
        if allow_handoff and sender_allowed:
            available = []
            for p in participants:
                if p.id == agent.id:
                    continue
                if p.id in sender_allowed and p.id in participant_ids and p.is_active:
                    available.append(
                        f"- Agent ID: {p.id}\n"
                        f"  Name: {p.name}\n"
                        f"  Role: {p.role}\n"
                        f"  Description: {p.description or 'No description.'}"
                    )
            if available:
                targets_text = "\n".join(available)

        enriched_task = (
            f"{task}\n\n"
            f"## Original workflow task\n{original_task}\n\n"
            f"## Handoff chain so far\n{chain_text}\n\n"
            f"## Available handoff targets\n{targets_text}\n\n"
            "## Output format instruction\n"
            "You MUST respond with a JSON object. Choose one of:\n"
            '{"action": "handoff", "target_agent_id": <int from available targets above>, "payload": {"summary": "...", "key_findings": [...], "requested_work": "..."}, "reasoning": "..."}\n'
            '{"action": "finish", "final_response": "<your complete response>", "reasoning": "..."}\n'
            "Rules:\n"
            "- Choose target_agent_id ONLY from the available handoff targets listed above.\n"
            "- Do not invent target_agent_id values.\n"
            "- Do not use agent names instead of numeric target_agent_id.\n"
            "- If the specialist you need is not available, finish with a clear explanation or choose the closest allowed target.\n"
            "- Do not include any text outside the JSON object."
        )
        return self.context_assembler.assemble(agent.id, enriched_task)

    def _parse_handoff_decision(self, raw_output: str) -> ActionParseResult:
        """Parse handoff decision from raw agent output, with repair + fallback."""
        import json as _json
        import re as _re

        # Try to extract JSON
        json_text = None
        fence = _re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_output, _re.DOTALL)
        if fence:
            json_text = fence.group(1)
        else:
            start = raw_output.find("{")
            if start != -1:
                depth = 0
                in_string = False
                escape = False
                for i in range(start, len(raw_output)):
                    ch = raw_output[i]
                    if escape:
                        escape = False; continue
                    if ch == "\\":
                        escape = True; continue
                    if ch == '"':
                        in_string = not in_string; continue
                    if in_string: continue
                    if ch == "{": depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            json_text = raw_output[start:i+1]
                            break

        if json_text:
            try:
                obj = _json.loads(json_text)
                decision = HandoffDecision.model_validate(obj)
                return ActionParseResult(decision, raw_output, True, "")
            except Exception:
                pass

            # Simple repair: close unclosed brackets
            repaired = json_text
            depth_brace = repaired.count("{") - repaired.count("}")
            depth_bracket = repaired.count("[") - repaired.count("]")
            if depth_brace > 0:
                repaired += "}" * depth_brace
            if depth_bracket > 0:
                repaired += "]" * depth_bracket
            try:
                obj = _json.loads(repaired)
                decision = HandoffDecision.model_validate(obj)
                return ActionParseResult(decision, raw_output, True, "")
            except Exception:
                pass

        fallback = HandoffDecision(action="finish", final_response=raw_output.strip() or "(empty)", reasoning="Parser fallback.")
        return ActionParseResult(fallback, raw_output, False, "Parse failed; fell back to finish.")

    @staticmethod
    def _validate_handoff_json(json_text: str) -> tuple[Any, str]:
        import json as _json
        try:
            obj = _json.loads(json_text)
            return HandoffDecision.model_validate(obj), ""
        except Exception as exc:
            return None, str(exc)

    def _call_llm(self, agent: Agent, assembled: Any, execution: Any, run_id: int) -> Any:
        create_trace_event(
            self.db, run_id, "llm_request_started",
            {"provider": self.settings.llm_provider, "model": agent.model, "temperature": agent.temperature}, agent.id,
        )
        config = {"agent_name": agent.name, "task": "", "model": agent.model, "temperature": agent.temperature, "max_tokens": agent.max_tokens}
        try:
            response = self.provider.generate(assembled.prompt, config)
        except Exception:
            observatory_service.fail_execution(self.db, execution, "LLM call failed")
            raise
        create_trace_event(
            self.db, run_id, "llm_response_received",
            {"metadata": response.metadata, "content_preview": response.content[:500]}, agent.id,
        )
        observatory_service.record_token_usage(self.db, execution, assembled.prompt, response.content, response.metadata)
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

    def _emit_parse_event(self, run_id: int, agent_id: int, execution: Any, parse_result: ActionParseResult) -> None:
        if parse_result.parse_success:
            create_trace_event(self.db, run_id, "action_parse_succeeded", {"agent_id": agent_id, "action": parse_result.decision.action}, agent_id)
            observatory_service.create_execution_event(self.db, execution, "action_parse_succeeded", {"action": parse_result.decision.action})
        else:
            create_trace_event(self.db, run_id, "action_parse_failed", {"agent_id": agent_id, "error": parse_result.parse_error, "raw_preview": parse_result.raw[:200]}, agent_id)
            observatory_service.create_execution_event(self.db, execution, "action_parse_failed", {"error": parse_result.parse_error, "raw_preview": parse_result.raw[:200]})

    def _config_snapshot(self, workflow: Workflow, agents: list[Agent]) -> dict:
        return {
            "workflow": {"id": workflow.id, "name": workflow.name, "workflow_type": workflow.workflow_type, "graph_config": workflow.graph_config},
            "agents": [
                {"id": a.id, "name": a.name, "role": a.role, "soul_id": a.soul_id, "llm_provider": a.llm_provider,
                 "model": a.model, "temperature": a.temperature, "max_tokens": a.max_tokens,
                 "system_prompt": a.system_prompt, "memory_policy": a.memory_policy,
                 "context_policy": a.context_policy, "handoff_policy": a.handoff_policy}
                for a in agents
            ],
        }
