from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, object_session

from app.database import Base


class AgentFeedback(Base):
    __tablename__ = "agent_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"), nullable=False, index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), nullable=False, index=True)
    trace_event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("trace_events.id"), nullable=True, index=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    feedback_text: Mapped[str] = mapped_column(Text, nullable=False)
    feedback_type: Mapped[str] = mapped_column(String(80), nullable=False, default="general")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class AgentEvaluation(Base):
    __tablename__ = "agent_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"), nullable=False, index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), nullable=False, index=True)
    evaluator_type: Mapped[str] = mapped_column(String(80), nullable=False)
    scores: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False, default=dict)
    issues: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    recommendations: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class ProposedMemory(Base):
    __tablename__ = "proposed_memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), nullable=False, index=True)
    source_feedback_id: Mapped[Optional[int]] = mapped_column(ForeignKey("agent_feedback.id"), nullable=True, index=True)
    source_evaluation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("agent_evaluations.id"), nullable=True, index=True)
    memory_type: Mapped[str] = mapped_column(String(80), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    importance: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    @property
    def source_type(self) -> Optional[str]:
        if self.source_feedback_id is not None:
            return "feedback"
        if self.source_evaluation_id is not None:
            return "evaluation"
        return None

    @property
    def source_summary(self) -> Optional[str]:
        session = object_session(self)
        if session is None:
            return None
        if self.source_feedback_id is not None:
            feedback = session.get(AgentFeedback, self.source_feedback_id)
            if feedback:
                return feedback.feedback_text[:120] if len(feedback.feedback_text) > 120 else feedback.feedback_text
        if self.source_evaluation_id is not None:
            evaluation = session.get(AgentEvaluation, self.source_evaluation_id)
            if evaluation:
                parts = [f"{key}: {value}" for key, value in list(evaluation.scores.items())[:3]]
                return ", ".join(parts) if parts else None
        return None

    @property
    def source_run_id(self) -> Optional[int]:
        session = object_session(self)
        if session is None:
            return None
        if self.source_feedback_id is not None:
            feedback = session.get(AgentFeedback, self.source_feedback_id)
            return feedback.run_id if feedback else None
        if self.source_evaluation_id is not None:
            evaluation = session.get(AgentEvaluation, self.source_evaluation_id)
            return evaluation.run_id if evaluation else None
        return None
