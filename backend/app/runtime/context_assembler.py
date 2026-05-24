from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.context import AgentContext
from app.models.memory import AgentMemory
from app.models.soul import Soul


class AssembledContext(BaseModel):
    prompt: str
    sections: list[dict[str, str]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ContextAssembler:
    def __init__(self, db: Session) -> None:
        self.db = db

    def assemble(self, agent_id: int, task: str, workflow_shared_context: str = "") -> AssembledContext:
        agent = self.db.get(Agent, agent_id)
        if agent is None:
            raise ValueError("Agent not found.")

        soul = self.db.get(Soul, agent.soul_id) if agent.soul_id else None
        contexts = self._active_contexts(agent_id)
        memories = self._active_memories(agent_id)

        sections = [
            {
                "title": "Platform safety and execution rules",
                "content": (
                    "Agents are isolated by default. Use only this agent's context, memory, "
                    "tools, settings, and explicit workflow inputs."
                ),
            },
            {"title": "Soul/persona", "content": self._soul_text(soul)},
            {"title": "Agent role", "content": agent.role},
            {"title": "System prompt", "content": agent.system_prompt},
            {"title": "Agent-specific context entries", "content": self._context_text(contexts)},
            {"title": "Agent-specific retrieved memory", "content": self._memory_text(memories)},
            {"title": "Workflow-level shared context", "content": workflow_shared_context or "None."},
            {"title": "Current task", "content": task},
            {"title": "Output format instruction", "content": "Return a concise deterministic response."},
        ]
        prompt = "\n\n".join(f"## {section['title']}\n{section['content']}" for section in sections)
        return AssembledContext(
            prompt=prompt,
            sections=sections,
            metadata={
                "agent_id": agent.id,
                "soul_id": agent.soul_id,
                "context_entry_ids": [context.id for context in contexts],
                "memory_ids": [memory.id for memory in memories],
                "assembly_order": [section["title"] for section in sections],
            },
        )

    def _active_contexts(self, agent_id: int) -> list[AgentContext]:
        statement = (
            select(AgentContext)
            .where(AgentContext.agent_id == agent_id, AgentContext.is_active.is_(True))
            .order_by(AgentContext.priority, AgentContext.id)
        )
        return list(self.db.scalars(statement).all())

    def _active_memories(self, agent_id: int) -> list[AgentMemory]:
        statement = (
            select(AgentMemory)
            .where(AgentMemory.agent_id == agent_id, AgentMemory.status == "active")
            .order_by(AgentMemory.importance.desc(), AgentMemory.id)
        )
        return list(self.db.scalars(statement).all())

    def _soul_text(self, soul: Soul) -> str:
        if soul is None:
            return "No soul/persona configured."
        parts = [
            f"Name: {soul.name}",
            f"Principles: {soul.principles or 'None.'}",
            f"Decision style: {soul.decision_style or 'None.'}",
            f"Collaboration style: {soul.collaboration_style or 'None.'}",
            f"Failure handling style: {soul.failure_handling_style or 'None.'}",
            f"Escalation style: {soul.escalation_style or 'None.'}",
        ]
        return "\n".join(parts)

    def _context_text(self, contexts: list[AgentContext]) -> str:
        if not contexts:
            return "None."
        return "\n".join(f"- {context.title} ({context.context_type}): {context.content}" for context in contexts)

    def _memory_text(self, memories: list[AgentMemory]) -> str:
        if not memories:
            return "None."
        return "\n".join(f"- {memory.memory_type} [{memory.importance}]: {memory.content}" for memory in memories)
