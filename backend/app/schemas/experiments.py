from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


class ExperimentBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    task_prompt: str = Field(min_length=1)
    agent_ids: list[int] = Field(default_factory=list)
    evaluation_config: dict[str, Any] = Field(default_factory=dict)


class ExperimentCreate(ExperimentBase):
    @model_validator(mode="after")
    def _validate_agent_ids(self) -> "ExperimentCreate":
        exp_type = self.evaluation_config.get("experiment_type", "")
        if exp_type == "soul_behavior_comparison":
            if not self.evaluation_config.get("workflow_id"):
                raise ValueError("evaluation_config.workflow_id is required for soul_behavior_comparison")
            if not self.evaluation_config.get("supervisor_agent_id"):
                raise ValueError("evaluation_config.supervisor_agent_id is required for soul_behavior_comparison")
            soul_ids = self.evaluation_config.get("soul_ids", [])
            if not isinstance(soul_ids, list) or len(soul_ids) < 2:
                raise ValueError("evaluation_config.soul_ids requires at least 2 soul IDs for soul_behavior_comparison")
        else:
            if len(self.agent_ids) < 2:
                raise ValueError("agent_ids must have at least 2 agents for standard experiments")
        return self


class ExperimentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    task_prompt: Optional[str] = Field(default=None, min_length=1)
    agent_ids: Optional[list[int]] = None
    evaluation_config: Optional[dict[str, Any]] = None


class ExperimentRead(ExperimentBase):
    id: int
    archived_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ExperimentArchiveResponse(BaseModel):
    id: int
    archived: bool
    archived_at: Optional[datetime] = None
    message: str


class ExperimentRunRead(BaseModel):
    id: int
    experiment_id: int
    run_ids: list[int]
    comparison_result: Optional[dict[str, Any]] = None

    model_config = {"from_attributes": True}
