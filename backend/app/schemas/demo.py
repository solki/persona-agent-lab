from typing import Optional

from pydantic import BaseModel


class DemoEntityRef(BaseModel):
    id: int
    name: str
    created: bool


class DemoSeedResponse(BaseModel):
    souls: list[DemoEntityRef]
    agents: list[DemoEntityRef]
    contexts: list[DemoEntityRef]
    memories: list[DemoEntityRef]
    workflow: Optional[DemoEntityRef]
    first_complaint: str
    second_complaint: str
    feedback_text: str
    acceptance_checklist: list[str]


class DemoCleanupResponse(BaseModel):
    deleted_souls: int
    deleted_agents: int
    deleted_workflows: int
    deleted_runs: int
    deleted_contexts: int
    deleted_memories: int
