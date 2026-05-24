from typing import Any, Optional

from pydantic import BaseModel, Field


class ToolBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    tool_type: str = Field(min_length=1, max_length=80)
    config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class ToolCreate(ToolBase):
    pass


class ToolUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    tool_type: Optional[str] = Field(default=None, min_length=1, max_length=80)
    config: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class ToolRead(ToolBase):
    id: int

    model_config = {"from_attributes": True}
