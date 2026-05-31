from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class WorkflowBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    workflow_type: Literal["sequential", "supervisor", "handoff_swarm"] = "sequential"
    graph_config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class WorkflowCreate(WorkflowBase):
    @model_validator(mode="after")
    def _validate_graph_config(self) -> "WorkflowCreate":
        _check_graph_config(self.workflow_type, self.graph_config)
        return self


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    workflow_type: Optional[Literal["sequential", "supervisor", "handoff_swarm"]] = None
    graph_config: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def _validate_graph_config(self) -> "WorkflowUpdate":
        if self.workflow_type is not None and self.graph_config is not None:
            _check_graph_config(self.workflow_type, self.graph_config)
        return self


class WorkflowRead(WorkflowBase):
    id: int

    model_config = {"from_attributes": True}


def _check_graph_config(workflow_type: str, graph_config: dict[str, Any]) -> None:
    if workflow_type == "supervisor":
        if not graph_config.get("supervisor_agent_id"):
            raise ValueError("graph_config.supervisor_agent_id is required for supervisor workflows")
        worker_ids = graph_config.get("worker_agent_ids", [])
        if not isinstance(worker_ids, list) or len(worker_ids) == 0:
            raise ValueError("graph_config.worker_agent_ids must be a non-empty list for supervisor workflows")
        if not isinstance(graph_config.get("supervisor_agent_id"), int):
            raise ValueError("graph_config.supervisor_agent_id must be an integer")
        for wid in worker_ids:
            if not isinstance(wid, int):
                raise ValueError("graph_config.worker_agent_ids must contain only integers")
    elif workflow_type == "handoff_swarm":
        if not graph_config.get("entry_agent_id"):
            raise ValueError("graph_config.entry_agent_id is required for handoff_swarm workflows")
        participant_ids = graph_config.get("participant_agent_ids", [])
        if not isinstance(participant_ids, list) or len(participant_ids) == 0:
            raise ValueError("graph_config.participant_agent_ids must be a non-empty list for handoff_swarm workflows")
    elif workflow_type == "sequential":
        pass  # agent_sequence is optional at schema level; validated at runtime
