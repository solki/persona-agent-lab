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


class WorkflowRead(WorkflowBase):
    id: int

    model_config = {"from_attributes": True}
