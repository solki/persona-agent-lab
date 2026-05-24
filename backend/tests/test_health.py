from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_reports_mock_mode_and_database_configuration():
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "agent-swarm-lab-backend",
        "version": "0.1.0",
        "llm_provider": "mock",
        "database_configured": True,
    }
