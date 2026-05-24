from typing import Optional

from pydantic import BaseModel, Field


class AgentContextBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    context_type: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1)
    priority: int = 100
    is_active: bool = True


class AgentContextCreate(AgentContextBase):
    pass


class AgentContextUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    context_type: Optional[str] = Field(default=None, min_length=1, max_length=80)
    content: Optional[str] = Field(default=None, min_length=1)
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class AgentContextRead(AgentContextBase):
    id: int
    agent_id: int

    model_config = {"from_attributes": True}
