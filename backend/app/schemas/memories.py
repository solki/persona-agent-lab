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


class AgentMemoryUpdate(BaseModel):
    memory_type: Optional[str] = Field(default=None, min_length=1, max_length=80)
    content: Optional[str] = Field(default=None, min_length=1)
    source: Optional[str] = None
    importance: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[Literal["active", "pending", "rejected", "archived"]] = None


class AgentMemoryRead(AgentMemoryBase):
    id: int
    agent_id: int

    model_config = {"from_attributes": True}
