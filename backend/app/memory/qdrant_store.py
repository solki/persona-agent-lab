from typing import Optional

from qdrant_client import QdrantClient

from app.memory.vector_store import VectorSearchResult, VectorStoreStatus


class QdrantVectorStore:
    def __init__(self, url: str, collection_prefix: str, api_key: Optional[str] = None) -> None:
        self.url = url
        self.collection_prefix = collection_prefix
        self.api_key = api_key
        self._client: Optional[QdrantClient] = None

    @property
    def client(self) -> QdrantClient:
        if self._client is None:
            self._client = QdrantClient(url=self.url, api_key=self.api_key)
        return self._client

    def status(self) -> VectorStoreStatus:
        try:
            self.client.get_collections()
        except Exception as exc:
            return VectorStoreStatus(available=False, reason=str(exc))
        return VectorStoreStatus(available=True)

    def collection_name(self, agent_id: int) -> str:
        self._require_agent_id(agent_id)
        return f"{self.collection_prefix}_agent_{agent_id}_memory"

    def search(self, agent_id: Optional[int], query: str, limit: int = 5) -> VectorSearchResult:
        self._require_agent_id(agent_id)
        if not query:
            return VectorSearchResult(available=True, items=[])

        return VectorSearchResult(
            available=False,
            reason="Vector embedding search is not implemented until the embedding provider is configured.",
            items=[],
        )

    def upsert(
        self,
        agent_id: Optional[int],
        memory_id: int,
        content: str,
        metadata: Optional[dict] = None,
    ) -> VectorStoreStatus:
        self._require_agent_id(agent_id)
        if not content:
            return VectorStoreStatus(available=False, reason="content is required")

        return VectorStoreStatus(
            available=False,
            reason="Vector upsert is not implemented until the embedding provider is configured.",
        )

    def _require_agent_id(self, agent_id: Optional[int]) -> None:
        if agent_id is None:
            raise ValueError("agent_id is required for vector memory access")
