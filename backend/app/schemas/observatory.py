from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class AgentExecutionRead(BaseModel):
    id: int
    run_id: int
    agent_id: int
    agent_name_snapshot: str
    status: str
    sequence_index: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    elapsed_ms: Optional[int] = None
    input_payload: dict[str, Any]
    output_payload: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    provider: str
    model: str
    temperature: float
    config_snapshot: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentExecutionEventRead(BaseModel):
    id: int
    execution_id: int
    run_id: int
    agent_id: int
    event_type: str
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenUsageRead(BaseModel):
    id: int
    run_id: int
    execution_id: int
    agent_id: int
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost: float
    raw_usage: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenUsageSummary(BaseModel):
    run_id: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    estimated_cost: float
    by_agent: list[dict[str, Any]]
    items: list[TokenUsageRead]


class LearningEventRead(BaseModel):
    id: int
    run_id: Optional[int] = None
    agent_id: int
    event_type: str
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    content: Optional[str] = None
    status: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentExecutionDetail(BaseModel):
    execution: AgentExecutionRead
    events: list[AgentExecutionEventRead]
    token_usage: Optional[TokenUsageRead] = None
    assembled_context: Optional[dict[str, Any]] = None
    retrieved_memory: Optional[dict[str, Any]] = None
    tool_calls: list[AgentExecutionEventRead]
    learning_events: list[LearningEventRead]


class RunMonitorRead(BaseModel):
    run_id: int
    run_status: str
    active_workflow_step: Optional[int] = None
    active_agent_execution: Optional[AgentExecutionRead] = None
    agent_executions: list[AgentExecutionRead]
    latest_events: list[AgentExecutionEventRead]
    current_event_stream: list[AgentExecutionEventRead]
    started_at: Optional[datetime] = None
    elapsed_ms: Optional[int] = None
    token_usage_summary: TokenUsageSummary
    learning_event_summary: dict[str, Any]
    errors: list[dict[str, Any]]


class AgentEvolutionRead(BaseModel):
    agent_id: int
    memories: list[dict[str, Any]]
    feedback: list[dict[str, Any]]
    evaluations: list[dict[str, Any]]
    proposed_memories: list[dict[str, Any]]
    learning_events: list[LearningEventRead]
    executions: list[AgentExecutionRead]
    token_usage: list[TokenUsageRead]


class AgentPerformanceSummary(BaseModel):
    agent_id: int
    execution_count: int
    completed_count: int
    failed_count: int
    average_elapsed_ms: Optional[float] = None
    total_tokens: int
    estimated_cost: float
