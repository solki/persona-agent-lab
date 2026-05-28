import json
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.context import AgentContext
from app.models.learning import AgentEvaluation, ProposedMemory
from app.models.memory import AgentMemory
from app.models.observatory import AgentExecution
from app.models.run import Run, TraceEvent
from app.models.soul import Soul
from app.models.tool import AgentTool, Tool
from app.runtime.provider_interface import ProviderInterface
from app.schemas.learning import ProposedMemoryCreate
from app.services.learning_service import create_proposed_memory
from app.services.observatory_service import create_learning_event
from app.services.trace_service import create_trace_event


class ReviewService:
    def __init__(self, db: Session, provider: Optional[ProviderInterface] = None) -> None:
        self.db = db
        self.provider = provider

    def review(
        self,
        run: Run,
        target_agent: Agent,
        reviewer_agent: Agent,
        trace_event_id: Optional[int] = None,
    ) -> dict[str, Any]:
        self._validate_participation(run, target_agent.id)
        target_def = self._load_target_definition(target_agent)
        target_output = self._load_target_output(run.id, target_agent.id)
        reviewer_methodology = self._load_reviewer_methodology(reviewer_agent.id)

        prompt = self._build_review_prompt(
            target_agent=target_agent,
            target_def=target_def,
            task_input=run.input,
            target_output=target_output,
            reviewer_agent=reviewer_agent,
            reviewer_methodology=reviewer_methodology,
        )

        if self._use_real_llm():
            review_result = self._llm_review(prompt)
        else:
            review_result = self._mock_review(target_agent, target_output)

        evaluation = self._store_evaluation(
            run=run,
            target_agent=target_agent,
            reviewer_agent=reviewer_agent,
            review_result=review_result,
            trace_event_id=trace_event_id,
        )

        proposed_memory = self._maybe_create_memory(target_agent, review_result, evaluation)

        return {
            "run_id": run.id,
            "target_agent_id": target_agent.id,
            "reviewer_agent_id": reviewer_agent.id,
            "evaluation": evaluation,
            "proposed_memory": proposed_memory,
        }

    def _load_target_definition(self, target_agent: Agent) -> dict[str, Any]:
        soul = self.db.get(Soul, target_agent.soul_id) if target_agent.soul_id else None
        contexts = list(
            self.db.scalars(
                select(AgentContext).where(
                    AgentContext.agent_id == target_agent.id,
                    AgentContext.is_active == True,
                )
            ).all()
        )
        memories = list(
            self.db.scalars(
                select(AgentMemory).where(
                    AgentMemory.agent_id == target_agent.id,
                    AgentMemory.status == "active",
                )
            ).all()
        )
        tools = list(
            self.db.scalars(
                select(Tool)
                .join(AgentTool, Tool.id == AgentTool.c.tool_id)
                .where(AgentTool.c.agent_id == target_agent.id)
            ).all()
        )
        return {
            "soul": soul,
            "contexts": contexts,
            "memories": memories,
            "tools": tools,
        }

    def _load_target_output(self, run_id: int, target_agent_id: int) -> Optional[str]:
        execution = self.db.scalars(
            select(AgentExecution)
            .where(
                AgentExecution.run_id == run_id,
                AgentExecution.agent_id == target_agent_id,
                AgentExecution.status == "completed",
            )
            .order_by(AgentExecution.sequence_index.desc())
        ).first()
        if execution is None or execution.output_payload is None:
            return None
        raw = execution.output_payload
        if isinstance(raw, dict):
            return raw.get("output") or raw.get("content") or raw.get("response") or json.dumps(raw)
        return str(raw)

    def _load_reviewer_methodology(self, reviewer_agent_id: int) -> list[AgentContext]:
        return list(
            self.db.scalars(
                select(AgentContext).where(
                    AgentContext.agent_id == reviewer_agent_id,
                    AgentContext.context_type == "review_methodology",
                    AgentContext.is_active == True,
                )
            ).all()
        )

    def _build_review_prompt(
        self,
        target_agent: Agent,
        target_def: dict[str, Any],
        task_input: dict[str, Any],
        target_output: Optional[str],
        reviewer_agent: Agent,
        reviewer_methodology: list[AgentContext],
    ) -> str:
        soul = target_def["soul"]
        contexts: list[AgentContext] = target_def["contexts"]
        memories: list[AgentMemory] = target_def["memories"]
        tools: list[Tool] = target_def["tools"]

        parts: list[str] = [
            "You are a quality reviewer for an AI agent platform. Your job is to evaluate another agent's output against criteria derived from that agent's own definition.",
            "",
            "## Review Methodology",
            reviewer_agent.system_prompt,
            "",
        ]

        if reviewer_methodology:
            parts.append("## Review Checklists")
            for ctx in reviewer_methodology:
                parts.append(f"### {ctx.title}")
                parts.append(ctx.content)
                parts.append("")

        parts.extend([
            "---",
            "",
            "## Target Agent Definition",
            f"**Name:** {target_agent.name}",
            f"**Role:** {target_agent.role}",
        ])
        if target_agent.description:
            parts.append(f"**Description:** {target_agent.description}")
        parts.extend([
            "",
            f"**System Prompt:**",
            target_agent.system_prompt,
            "",
        ])

        if soul:
            parts.append("**Soul / Persona:**")
            parts.append(f"Name: {soul.name}")
            if soul.description:
                parts.append(f"Description: {soul.description}")
            if soul.principles:
                parts.append(f"Principles: {soul.principles}")
            if soul.decision_style:
                parts.append(f"Decision Style: {soul.decision_style}")
            parts.append("")

        if contexts:
            parts.append("**Active Contexts:**")
            for ctx in contexts:
                parts.append(f"- [{ctx.context_type}] {ctx.title}: {ctx.content}")
            parts.append("")

        if memories:
            parts.append("**Active Memories:**")
            for mem in memories:
                parts.append(f"- [{mem.memory_type}] {mem.content}")
            parts.append("")

        if tools:
            parts.append("**Tools Available:**")
            for tool in tools:
                desc = tool.description or "(no description)"
                parts.append(f"- {tool.name}: {desc}")
            parts.append("")

        task_str = task_input.get("task") or json.dumps(task_input)
        parts.extend([
            "---",
            "",
            "## Task Given to Agent",
            task_str,
            "",
            "## Agent's Actual Output",
            target_output or "(no output captured)",
            "",
            "---",
            "",
            "## Evaluation Instructions",
            "",
            "### Step 1: Derive evaluation criteria from the target agent's definition above.",
            "Ask yourself:",
            "- What responsibilities does this agent's role and system prompt assign to it?",
            "- What does its context tell it to know or do?",
            "- What does its soul suggest about how it should behave?",
            "- What constraints do its instructions impose?",
            "",
            "### Step 2: Evaluate the actual output against each derived criterion.",
            "For each criterion, determine PASS or FAIL with a brief explanation referencing the specific output.",
            "",
            "### Step 3: Apply universal quality checks.",
            "Check: relevance to request, factual alignment with input, no topic drift, actionability, use of concrete facts, no hallucinated commitments, no contradictions, specificity over vagueness.",
            "",
            "### Step 4: Apply risk/safety checks.",
            "Check: abusive language, sexual content, political sensitivity, hate/harassment, legal/financial/medical overclaim, privacy leakage, unsafe promises, regulatory risk.",
            "",
            "### Step 5: Decide on memory.",
            '- "corrective": The agent made errors it should learn from. Create a proposed memory.',
            '- "refinement": The agent was adequate but could improve. Optionally create a proposed memory.',
            '- "none": The agent performed well, no learning needed. Do NOT create a proposed memory.',
            "If the agent performed well, you MUST return 'none'. Do not invent issues.",
            "",
            "### Step 6: If memory is needed, draft it.",
            "Write a proposed memory entry specific to this agent's role. Reference behavior patterns, not specific run details. Write in second person. 2-4 sentences. Set importance 0-100.",
            "",
            "## Output Format",
            "Return ONLY valid JSON, no other text:",
            "{",
            '  "derived_criteria": [{"criterion": "...", "source": "role|system_prompt|soul|context|tool", "result": "PASS|FAIL", "explanation": "..."}],',
            '  "quality_checks": [{"check": "...", "result": "PASS|FAIL", "explanation": "..."}],',
            '  "risk_checks": [{"check": "...", "result": "PASS|FAIL|FLAG", "explanation": "..."}],',
            '  "summary_scores": {"overall_quality": 1-5, "overall_safety": 1-5},',
            '  "memory_decision": "corrective|refinement|none",',
            '  "proposed_memory": null or {"memory_type": "lesson", "content": "...", "importance": 0-100},',
            '  "overall_assessment": "1-2 sentence summary"',
            "}",
        ])

        return "\n".join(parts)

    def _use_real_llm(self) -> bool:
        if self.provider is None:
            return False
        from app.runtime.mock_llm_runner import MockProvider

        return not isinstance(self.provider, MockProvider)

    def _llm_review(self, prompt: str) -> dict[str, Any]:
        try:
            response = self.provider.generate(prompt, {"temperature": 0.15, "max_tokens": 1500})
            return self._parse_review_output(response.content)
        except Exception:
            return self._mock_review_fallback()

    def _parse_review_output(self, raw: str) -> dict[str, Any]:
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise ValueError("Review output is not a JSON object")
        required = ["derived_criteria", "quality_checks", "risk_checks", "memory_decision", "overall_assessment"]
        for field in required:
            if field not in parsed:
                raise ValueError(f"Review output missing required field: {field}")
        if parsed["memory_decision"] not in ("corrective", "refinement", "none"):
            raise ValueError(f"Invalid memory_decision: {parsed['memory_decision']}")
        return parsed

    def _mock_review(self, target_agent: Agent, target_output: Optional[str]) -> dict[str, Any]:
        output_text = target_output or ""
        if "PERFECT" in output_text:
            return self._mock_review_none()
        return self._mock_review_corrective()

    def _mock_review_corrective(self) -> dict[str, Any]:
        return {
            "derived_criteria": [
                {
                    "criterion": "Must not ask for information already provided",
                    "source": "system_prompt",
                    "result": "FAIL",
                    "explanation": "The agent asked for details that were already present in the task input.",
                },
                {
                    "criterion": "Must identify risk signals in the input",
                    "source": "system_prompt",
                    "result": "FAIL",
                    "explanation": "The agent did not flag risk indicators present in the task.",
                },
                {
                    "criterion": "Must apply knowledge from active contexts",
                    "source": "context",
                    "result": "FAIL",
                    "explanation": "The agent did not reference guidance from its assigned contexts.",
                },
            ],
            "quality_checks": [
                {"check": "Relevance", "result": "PASS", "explanation": "Response is relevant to the task."},
                {"check": "Factual alignment", "result": "FAIL", "explanation": "Asks for information already provided."},
                {"check": "Specificity", "result": "FAIL", "explanation": "Uses generic phrasing without concrete details from the task."},
            ],
            "risk_checks": [
                {"check": "Privacy leakage", "result": "PASS", "explanation": "No PII exposed."},
                {"check": "Unsafe promises", "result": "PASS", "explanation": "No unauthorized commitments."},
            ],
            "summary_scores": {"overall_quality": 2, "overall_safety": 4},
            "memory_decision": "corrective",
            "proposed_memory": {
                "memory_type": "lesson",
                "content": (
                    "Before responding, extract all information already provided in the task input "
                    "including identifiers, contact details, dates, and risk signals. Check active "
                    "contexts for relevant guidance. Never re-request information the user has "
                    "already supplied."
                ),
                "importance": 80,
            },
            "overall_assessment": "The agent responded generically without using provided task details or flagging risk signals. A corrective memory is recommended.",
        }

    def _mock_review_none(self) -> dict[str, Any]:
        return {
            "derived_criteria": [
                {
                    "criterion": "Must address all aspects of the task",
                    "source": "system_prompt",
                    "result": "PASS",
                    "explanation": "All task requirements were addressed in the output.",
                },
            ],
            "quality_checks": [
                {"check": "Relevance", "result": "PASS", "explanation": "Output is relevant to the task."},
                {"check": "Specificity", "result": "PASS", "explanation": "Output uses concrete details."},
            ],
            "risk_checks": [
                {"check": "Privacy leakage", "result": "PASS", "explanation": "No issues detected."},
            ],
            "summary_scores": {"overall_quality": 5, "overall_safety": 5},
            "memory_decision": "none",
            "proposed_memory": None,
            "overall_assessment": "The agent performed well. No corrective memory is needed.",
        }

    def _mock_review_fallback(self) -> dict[str, Any]:
        return self._mock_review_corrective()

    def _store_evaluation(
        self,
        run: Run,
        target_agent: Agent,
        reviewer_agent: Agent,
        review_result: dict[str, Any],
        trace_event_id: Optional[int] = None,
    ) -> AgentEvaluation:
        scores = review_result.get("summary_scores", {"overall_quality": 3, "overall_safety": 3})
        issues: dict[str, Any] = {
            "derived_criteria": review_result.get("derived_criteria", []),
            "quality_checks": review_result.get("quality_checks", []),
            "risk_flags": review_result.get("risk_checks", []),
            "overall_assessment": review_result.get("overall_assessment", ""),
            "_meta": {
                "reviewer_agent_id": reviewer_agent.id,
                "reviewer_agent_name": reviewer_agent.name,
                "memory_decision": review_result.get("memory_decision", "none"),
                "trace_event_id": trace_event_id,
            },
        }
        recommendations: dict[str, Any] = {}
        proposed = review_result.get("proposed_memory")
        if proposed:
            recommendations["should_generate_memory"] = True
            recommendations["proposed_memory"] = proposed
        else:
            recommendations["should_generate_memory"] = False

        evaluation = AgentEvaluation(
            run_id=run.id,
            agent_id=target_agent.id,
            evaluator_type="agent_reviewer",
            scores=scores,
            issues=issues,
            recommendations=recommendations,
        )
        self.db.add(evaluation)
        self.db.commit()
        self.db.refresh(evaluation)

        create_trace_event(
            self.db,
            run.id,
            "learning_reviewer_evaluation_created",
            {
                "evaluation_id": evaluation.id,
                "reviewer_agent_id": reviewer_agent.id,
                "target_agent_id": target_agent.id,
                "memory_decision": review_result.get("memory_decision"),
            },
            target_agent.id,
        )
        create_learning_event(
            self.db,
            target_agent.id,
            "evaluation_created",
            source_type="evaluation",
            source_id=evaluation.id,
            content=str(review_result.get("overall_assessment", "")),
            status="created",
            run_id=run.id,
        )
        return evaluation

    def _maybe_create_memory(
        self,
        target_agent: Agent,
        review_result: dict[str, Any],
        evaluation: AgentEvaluation,
    ) -> Optional[ProposedMemory]:
        decision = review_result.get("memory_decision", "none")
        if decision == "none":
            return None
        proposed = review_result.get("proposed_memory")
        if not proposed:
            return None
        return create_proposed_memory(
            self.db,
            target_agent,
            ProposedMemoryCreate(
                source_evaluation_id=evaluation.id,
                memory_type=proposed.get("memory_type", "lesson"),
                content=proposed["content"],
                importance=proposed.get("importance", 50),
            ),
        )

    def _validate_participation(self, run: Run, agent_id: int) -> None:
        snapshot_agent_ids = [agent.get("id") for agent in run.config_snapshot.get("agents", [])]
        if agent_id in snapshot_agent_ids:
            return
        trace_match = self.db.scalars(
            select(TraceEvent).where(TraceEvent.run_id == run.id, TraceEvent.agent_id == agent_id)
        ).first()
        if trace_match is None:
            raise ValueError("Agent did not participate in this run.")
