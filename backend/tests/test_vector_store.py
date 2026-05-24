import pytest

from app.config import Settings
from app.database import sqlalchemy_database_url
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


def test_qdrant_config_loads_from_environment(monkeypatch):
    monkeypatch.setenv("QDRANT_URL", "http://qdrant:6333")
    monkeypatch.setenv("QDRANT_API_KEY", "")
    monkeypatch.setenv("QDRANT_COLLECTION_PREFIX", "agent_swarm_lab_test")

    settings = Settings()

    assert settings.qdrant_url == "http://qdrant:6333"
    assert settings.qdrant_api_key == ""
    assert settings.qdrant_collection_prefix == "agent_swarm_lab_test"


def test_qdrant_store_collection_name_uses_configured_prefix():
    store = QdrantVectorStore(url="http://localhost:6333", collection_prefix="agent_swarm_lab_test", api_key="")

    assert store.collection_name(agent_id=42) == "agent_swarm_lab_test_agent_42_memory"
    assert store.api_key == ""


def test_plain_postgresql_database_url_uses_psycopg_driver():
    assert (
        sqlalchemy_database_url("postgresql://postgres:postgres@localhost:5433/agent_swarm_lab")
        == "postgresql+psycopg://postgres:postgres@localhost:5433/agent_swarm_lab"
    )
