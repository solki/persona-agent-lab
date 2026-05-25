from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.memories import AgentMemoryRead


EVALUATION_RUBRIC = {
    "task_completion",
    "persistence",
    "collaboration",
    "evidence_discipline",
    "tool_usage_quality",
    "handoff_quality",
    "customer_readiness",
    "safety",
    "clarity",
}


class AgentFeedbackCreate(BaseModel):
    trace_event_id: Optional[int] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    feedback_text: str = Field(min_length=1)
    feedback_type: str = Field(default="general", min_length=1, max_length=80)


class AgentFeedbackRead(AgentFeedbackCreate):
    id: int
    run_id: int
    agent_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentEvaluationCreate(BaseModel):
    evaluator_type: str = Field(default="human", min_length=1, max_length=80)
    scores: dict[str, int]
    issues: dict[str, Any] = Field(default_factory=dict)
    recommendations: dict[str, Any] = Field(default_factory=dict)

    @field_validator("scores")
    @classmethod
    def validate_scores(cls, scores: dict[str, int]) -> dict[str, int]:
        score_keys = set(scores.keys())
        missing = EVALUATION_RUBRIC - score_keys
        unknown = score_keys - EVALUATION_RUBRIC
        if missing:
            raise ValueError(f"Missing evaluation scores: {', '.join(sorted(missing))}")
        if unknown:
            raise ValueError(f"Unknown evaluation scores: {', '.join(sorted(unknown))}")
        invalid = [key for key, value in scores.items() if value < 1 or value > 5]
        if invalid:
            raise ValueError(f"Evaluation scores must be between 1 and 5: {', '.join(sorted(invalid))}")
        return scores


class AgentEvaluationRead(AgentEvaluationCreate):
    id: int
    run_id: int
    agent_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ProposedMemoryCreate(BaseModel):
    source_feedback_id: Optional[int] = None
    source_evaluation_id: Optional[int] = None
    memory_type: str = Field(default="lesson", min_length=1, max_length=80)
    content: str = Field(min_length=1)
    importance: int = Field(default=50, ge=0, le=100)


class ProposedMemoryRead(BaseModel):
    id: int
    agent_id: int
    source_feedback_id: Optional[int] = None
    source_evaluation_id: Optional[int] = None
    memory_type: str
    content: str
    importance: int
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ProposedMemoryApproveResponse(BaseModel):
    proposed_memory: ProposedMemoryRead
    agent_memory: AgentMemoryRead


class ProposedMemoryRejectResponse(BaseModel):
    proposed_memory: ProposedMemoryRead


class ReflectionRequest(BaseModel):
    feedback_id: Optional[int] = None
    evaluation_id: Optional[int] = None
    memory_type: str = Field(default="lesson", min_length=1, max_length=80)
    importance: int = Field(default=70, ge=0, le=100)


class ReflectionResponse(BaseModel):
    run_id: int
    agent_id: int
    reflection: str
    proposed_memory: ProposedMemoryRead
