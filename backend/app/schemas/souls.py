from typing import Optional

from pydantic import BaseModel, Field


class SoulBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    principles: Optional[str] = None
    decision_style: Optional[str] = None
    collaboration_style: Optional[str] = None
    failure_handling_style: Optional[str] = None
    escalation_style: Optional[str] = None


class SoulCreate(SoulBase):
    pass


class SoulUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    principles: Optional[str] = None
    decision_style: Optional[str] = None
    collaboration_style: Optional[str] = None
    failure_handling_style: Optional[str] = None
    escalation_style: Optional[str] = None


class SoulRead(SoulBase):
    id: int

    model_config = {"from_attributes": True}
