from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class RunCreate(BaseModel):
    workflow_id: int
    input: dict[str, Any] = Field(default_factory=dict)


class WorkflowRunRequest(BaseModel):
    task: str = Field(min_length=1)


class RunRead(BaseModel):
    id: int
    workflow_id: int
    input: dict[str, Any]
    output: Optional[dict[str, Any]] = None
    status: Literal["pending", "running", "completed", "failed", "archived"]
    config_snapshot: dict[str, Any]
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RunArchiveResponse(BaseModel):
    id: int
    status: Literal["archived"]
    archived: bool = True
    archived_at: datetime
    message: str


class RunActivateResponse(BaseModel):
    id: int
    status: Literal["pending", "running", "completed", "failed"]
    archived: bool = False
    archived_at: None = None
    message: str


class RunDeleteResponse(BaseModel):
    id: int
    deleted: bool = True
    message: str


class TraceEventRead(BaseModel):
    id: int
    run_id: int
    event_type: str
    agent_id: Optional[int] = None
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Collaboration Graph
# ---------------------------------------------------------------------------


class CollaborationNode(BaseModel):
    agent_id: int
    agent_name: str
    role: str
    execution_count: int
    execution_ids: list[int]
    status_summary: dict[str, int]


class CollaborationEdge(BaseModel):
    from_agent_id: int
    to_agent_id: int
    type: Literal["delegation", "response"]
    iteration: Optional[int] = None
    instruction: Optional[str] = None
    full_instruction: Optional[str] = None
    content_preview: Optional[str] = None
    full_content: Optional[str] = None
    elapsed_ms: Optional[int] = None
    source_trace_event_id: Optional[int] = None


class CollaborationChainSummary(BaseModel):
    supervisor_agent_id: Optional[int] = None
    supervisor_agent_name: Optional[str] = None
    supervisor_iterations: int = 0
    worker_count: int = 0
    delegation_count: int = 0
    final_decision: Optional[str] = None
    status: str = "unknown"


class CollaborationGraphResponse(BaseModel):
    run_id: int
    workflow_type: str
    nodes: list[CollaborationNode] = Field(default_factory=list)
    edges: list[CollaborationEdge] = Field(default_factory=list)
    chain_summary: CollaborationChainSummary
