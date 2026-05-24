from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class RunCreate(BaseModel):
    workflow_id: int
    input: dict[str, Any] = Field(default_factory=dict)


class RunRead(BaseModel):
    id: int
    workflow_id: int
    input: dict[str, Any]
    output: Optional[dict[str, Any]] = None
    status: Literal["pending", "running", "completed", "failed"]
    config_snapshot: dict[str, Any]

    model_config = {"from_attributes": True}


class TraceEventRead(BaseModel):
    id: int
    run_id: int
    event_type: str
    agent_id: Optional[int] = None
    payload: dict[str, Any]

    model_config = {"from_attributes": True}
