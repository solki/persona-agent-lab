from typing import Literal, Optional

from pydantic import BaseModel, Field


class AgentMemoryBase(BaseModel):
    memory_type: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1)
    source: Optional[str] = None
    importance: int = Field(default=50, ge=0, le=100)
    status: Literal["active", "pending", "rejected", "archived"] = "pending"


class AgentMemoryCreate(AgentMemoryBase):
    pass


class AgentMemoryRead(AgentMemoryBase):
    id: int
    agent_id: int

    model_config = {"from_attributes": True}
