from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def default_memory_policy() -> dict[str, Any]:
    return {"write_mode": "manual_review", "retrieval_enabled": True}


def default_context_policy() -> dict[str, Any]:
    return {"include_active_context": True}


def default_handoff_policy() -> dict[str, Any]:
    return {"allow_handoff": False, "allowed_agent_ids": []}


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(120), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    soul_id: Mapped[Optional[int]] = mapped_column(ForeignKey("souls.id"), nullable=True)
    llm_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="mock")
    model: Mapped[str] = mapped_column(String(120), nullable=False, default="mock-deterministic")
    temperature: Mapped[float] = mapped_column(Float, nullable=False, default=0.2)
    max_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=1024)
    memory_policy: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=default_memory_policy)
    context_policy: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=default_context_policy)
    handoff_policy: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=default_handoff_policy)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.llm_provider = self.llm_provider or "mock"
        self.model = self.model or "mock-deterministic"
        self.temperature = 0.2 if self.temperature is None else self.temperature
        self.max_tokens = 1024 if self.max_tokens is None else self.max_tokens
        self.memory_policy = self.memory_policy or default_memory_policy()
        self.context_policy = self.context_policy or default_context_policy()
        self.handoff_policy = self.handoff_policy or default_handoff_policy()
        self.is_active = True if self.is_active is None else self.is_active
