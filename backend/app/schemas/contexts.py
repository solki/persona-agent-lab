from pydantic import BaseModel, Field


class AgentContextBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    context_type: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1)
    priority: int = 100
    is_active: bool = True


class AgentContextCreate(AgentContextBase):
    pass


class AgentContextRead(AgentContextBase):
    id: int
    agent_id: int

    model_config = {"from_attributes": True}
