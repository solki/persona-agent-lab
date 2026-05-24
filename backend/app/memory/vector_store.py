from typing import Optional

from pydantic import BaseModel, Field


class VectorStoreStatus(BaseModel):
    available: bool
    reason: Optional[str] = None


class VectorSearchItem(BaseModel):
    memory_id: int
    content: str
    score: float
    metadata: dict = Field(default_factory=dict)


class VectorSearchResult(BaseModel):
    available: bool
    items: list[VectorSearchItem] = Field(default_factory=list)
    reason: Optional[str] = None


class DisabledVectorStore:
    def __init__(self, reason: str) -> None:
        self.reason = reason

    def status(self) -> VectorStoreStatus:
        return VectorStoreStatus(available=False, reason=self.reason)

    def search(self, agent_id: int, query: str, limit: int = 5) -> VectorSearchResult:
        return VectorSearchResult(available=False, reason=self.reason, items=[])

    def upsert(self, agent_id: int, memory_id: int, content: str, metadata: Optional[dict] = None) -> VectorStoreStatus:
        return self.status()
