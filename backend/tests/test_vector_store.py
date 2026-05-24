import pytest

from app.memory.qdrant_store import QdrantVectorStore
from app.memory.vector_store import DisabledVectorStore


def test_disabled_vector_store_reports_unavailable():
    store = DisabledVectorStore(reason="Qdrant is not configured.")

    status = store.status()
    search_result = store.search(agent_id=1, query="memory", limit=3)

    assert status.available is False
    assert status.reason == "Qdrant is not configured."
    assert search_result.available is False
    assert search_result.items == []


def test_qdrant_store_requires_agent_scope_for_search():
    store = QdrantVectorStore(url="http://localhost:6333", collection_prefix="agent_swarm_lab")

    with pytest.raises(ValueError, match="agent_id is required"):
        store.search(agent_id=None, query="private memory", limit=3)


def test_qdrant_store_requires_agent_scope_for_upsert():
    store = QdrantVectorStore(url="http://localhost:6333", collection_prefix="agent_swarm_lab")

    with pytest.raises(ValueError, match="agent_id is required"):
        store.upsert(agent_id=None, memory_id=10, content="private memory")
