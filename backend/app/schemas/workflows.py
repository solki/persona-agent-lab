from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class WorkflowBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    workflow_type: Literal["sequential", "supervisor", "handoff_swarm"] = "sequential"
    graph_config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    workflow_type: Optional[Literal["sequential", "supervisor", "handoff_swarm"]] = None
    graph_config: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class WorkflowRead(WorkflowBase):
    id: int

    model_config = {"from_attributes": True}
