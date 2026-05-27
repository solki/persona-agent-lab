from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ExperimentBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    task_prompt: str = Field(min_length=1)
    agent_ids: list[int] = Field(min_length=2)
    evaluation_config: dict[str, Any] = Field(default_factory=dict)


class ExperimentCreate(ExperimentBase):
    pass


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
