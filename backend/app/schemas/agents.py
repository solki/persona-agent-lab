from typing import Literal, Optional

from pydantic import BaseModel, Field


class MemoryPolicy(BaseModel):
    write_mode: Literal["off", "manual_review", "auto"] = "manual_review"
    retrieval_enabled: bool = True


class ContextPolicy(BaseModel):
    include_active_context: bool = True


class HandoffPolicy(BaseModel):
    allow_handoff: bool = False
    allowed_agent_ids: list[int] = Field(default_factory=list)


class AgentBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    role: str = Field(min_length=1, max_length=120)
    system_prompt: str = Field(min_length=1)
    soul_id: Optional[int] = None
    llm_provider: Literal["mock", "openai", "anthropic", "ollama"] = "mock"
    model: str = "mock-deterministic"
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=200000)
    memory_policy: MemoryPolicy = Field(default_factory=MemoryPolicy)
    context_policy: ContextPolicy = Field(default_factory=ContextPolicy)
    handoff_policy: HandoffPolicy = Field(default_factory=HandoffPolicy)
    is_active: bool = True


class AgentCreate(AgentBase):
    pass


class AgentRead(AgentBase):
    id: int

    model_config = {"from_attributes": True}
