from sqlalchemy import select

from app.models.agent import Agent
from app.models.learning import AgentFeedback, ProposedMemory
from app.models.run import Run
from app.runtime.context_assembler import ContextAssembler
from app.runtime.provider_interface import ProviderInterface, ProviderResponse
from app.schemas.learning import ReflectionRequest
from app.services.learning_service import ReflectionService


def create_agent(client, name, memory_policy=None):
    payload = {
        "name": name,
        "role": "worker",
        "system_prompt": "Use only your own scoped memory.",
    }
    if memory_policy is not None:
        payload["memory_policy"] = memory_policy
    response = client.post("/agents", json=payload)
    assert response.status_code == 201
    return response.json()


def create_run(client, agent):
    workflow = client.post(
        "/workflows",
        json={
            "name": f"{agent['name']} learning workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [agent["id"]]},
        },
    ).json()
    response = client.post(f"/workflows/{workflow['id']}/run", json={"task": "Diagnose a BI discrepancy."})
    assert response.status_code == 201
    return response.json()


def default_scores(value=4):
    return {
        "task_completion": value,
        "persistence": value,
        "collaboration": value,
        "evidence_discipline": value,
        "tool_usage_quality": value,
        "handoff_quality": value,
        "customer_readiness": value,
        "safety": value,
        "clarity": value,
    }


def test_feedback_creation_is_scoped_to_run_agent(client):
    agent = create_agent(client, "Learner")
    other_agent = create_agent(client, "Other")
    run = create_run(client, agent)

    response = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/feedback",
        json={
            "rating": 3,
            "feedback_text": "The agent asked for a file before checking available dashboard evidence.",
            "feedback_type": "correction",
        },
    )

    assert response.status_code == 201
    feedback = response.json()
    assert feedback["run_id"] == run["id"]
    assert feedback["agent_id"] == agent["id"]
    assert feedback["rating"] == 3

    wrong_agent_response = client.post(
        f"/runs/{run['id']}/agents/{other_agent['id']}/feedback",
        json={"feedback_text": "Should not attach to a non-participating agent.", "feedback_type": "correction"},
    )
    assert wrong_agent_response.status_code == 400

    missing_run_response = client.post(
        f"/runs/9999/agents/{agent['id']}/feedback",
        json={"feedback_text": "No run.", "feedback_type": "correction"},
    )
    assert missing_run_response.status_code == 404

    missing_agent_response = client.post(
        f"/runs/{run['id']}/agents/9999/feedback",
        json={"feedback_text": "No agent.", "feedback_type": "correction"},
    )
    assert missing_agent_response.status_code == 404


def test_evaluation_stores_scores_and_rejects_invalid_values(client):
    agent = create_agent(client, "Evaluated")
    run = create_run(client, agent)

    response = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/evaluate",
        json={
            "evaluator_type": "human",
            "scores": default_scores(5),
            "issues": {"evidence_discipline": ["Asked for customer file too early."]},
            "recommendations": {"next": "Check dashboard filters and ETL logic first."},
        },
    )

    assert response.status_code == 201
    evaluation = response.json()
    assert evaluation["run_id"] == run["id"]
    assert evaluation["agent_id"] == agent["id"]
    assert evaluation["scores"]["clarity"] == 5
    assert evaluation["recommendations"]["next"] == "Check dashboard filters and ETL logic first."

    invalid_score_response = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/evaluate",
        json={"evaluator_type": "human", "scores": {**default_scores(), "clarity": 6}},
    )
    assert invalid_score_response.status_code == 422

    missing_score_response = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/evaluate",
        json={"evaluator_type": "human", "scores": {"clarity": 4}},
    )
    assert missing_score_response.status_code == 422


def test_reflection_creates_pending_proposed_memory_from_feedback(client):
    agent = create_agent(client, "Reflective")
    run = create_run(client, agent)
    feedback = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/feedback",
        json={
            "feedback_text": (
                "This agent asked the customer for the Excel file too early. It should first check "
                "dashboard filters, date range, metric definition, refresh timestamp, and ETL logic."
            ),
            "feedback_type": "correction",
            "rating": 2,
        },
    ).json()

    response = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/reflect",
        json={"feedback_id": feedback["id"], "memory_type": "lesson", "importance": 85},
    )

    assert response.status_code == 201
    reflection = response.json()
    assert reflection["agent_id"] == agent["id"]
    assert "dashboard filters" in reflection["reflection"]
    proposed_memory = reflection["proposed_memory"]
    assert proposed_memory["agent_id"] == agent["id"]
    assert proposed_memory["source_feedback_id"] == feedback["id"]
    assert proposed_memory["status"] == "pending"
    assert proposed_memory["importance"] == 85
    assert "before asking the customer for files" in proposed_memory["content"]

    event_types = [event["event_type"] for event in client.get(f"/runs/{run['id']}/trace").json()]
    assert "learning_feedback_received" in event_types
    assert "memory_proposed" in event_types
    assert "learning_reflection_created" in event_types


def test_proposed_memory_notifications_count_only_pending_feedback_or_evaluation_sources(client):
    feedback_agent = create_agent(client, "Feedback Notification")
    evaluation_agent = create_agent(client, "Evaluation Notification")
    manual_agent = create_agent(client, "Manual Memory No Notification")
    reviewed_agent = create_agent(client, "Reviewed Notification")
    feedback_run = create_run(client, feedback_agent)
    evaluation_run = create_run(client, evaluation_agent)
    reviewed_run = create_run(client, reviewed_agent)

    feedback = client.post(
        f"/runs/{feedback_run['id']}/agents/{feedback_agent['id']}/feedback",
        json={"feedback_text": "Create a feedback-derived proposed memory.", "feedback_type": "improvement"},
    ).json()
    evaluation = client.post(
        f"/runs/{evaluation_run['id']}/agents/{evaluation_agent['id']}/evaluate",
        json={
            "evaluator_type": "human",
            "scores": default_scores(4),
            "recommendations": {"next": "Create an evaluation-derived proposed memory."},
        },
    ).json()
    reviewed_feedback = client.post(
        f"/runs/{reviewed_run['id']}/agents/{reviewed_agent['id']}/feedback",
        json={"feedback_text": "This proposed memory will be reviewed.", "feedback_type": "improvement"},
    ).json()

    feedback_proposed = client.post(
        f"/agents/{feedback_agent['id']}/proposed-memories",
        json={"source_feedback_id": feedback["id"], "content": "Pending feedback source.", "memory_type": "lesson"},
    ).json()
    evaluation_proposed = client.post(
        f"/agents/{evaluation_agent['id']}/proposed-memories",
        json={"source_evaluation_id": evaluation["id"], "content": "Pending evaluation source.", "memory_type": "lesson"},
    ).json()
    approved_proposed = client.post(
        f"/agents/{reviewed_agent['id']}/proposed-memories",
        json={"source_feedback_id": reviewed_feedback["id"], "content": "Approved feedback source.", "memory_type": "lesson"},
    ).json()
    rejected_proposed = client.post(
        f"/agents/{reviewed_agent['id']}/proposed-memories",
        json={"source_feedback_id": reviewed_feedback["id"], "content": "Rejected feedback source.", "memory_type": "lesson"},
    ).json()

    assert feedback_proposed["status"] == "pending"
    assert evaluation_proposed["status"] == "pending"
    assert client.post(f"/agents/{reviewed_agent['id']}/proposed-memories/{approved_proposed['id']}/approve").status_code == 200
    assert client.post(f"/agents/{reviewed_agent['id']}/proposed-memories/{rejected_proposed['id']}/reject").status_code == 200
    manual_memory_response = client.post(
        f"/agents/{manual_agent['id']}/memories",
        json={"memory_type": "lesson", "content": "Manual pending AgentMemory must not notify.", "status": "pending"},
    )
    assert manual_memory_response.status_code == 201

    response = client.get("/proposed-memory-notifications")

    assert response.status_code == 200
    summary = response.json()
    assert summary["total_count"] == 2
    assert summary["by_agent"] == [
        {"agent_id": feedback_agent["id"], "count": 1},
        {"agent_id": evaluation_agent["id"], "count": 1},
    ]


def test_proposed_memory_approval_creates_active_agent_memory_and_future_run_retrieves_it(client, db_session):
    agent = create_agent(client, "Approver")
    run = create_run(client, agent)
    feedback = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/feedback",
        json={"feedback_text": "Next time, check filters and ETL logic before asking for files."},
    ).json()
    proposed = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/reflect",
        json={"feedback_id": feedback["id"], "importance": 90},
    ).json()["proposed_memory"]

    approve_response = client.post(f"/agents/{agent['id']}/proposed-memories/{proposed['id']}/approve")

    assert approve_response.status_code == 200
    approved = approve_response.json()
    assert approved["proposed_memory"]["status"] == "approved"
    agent_memory = approved["agent_memory"]
    assert agent_memory["agent_id"] == agent["id"]
    assert agent_memory["status"] == "active"
    assert agent_memory["source"] == f"proposed_memory:{proposed['id']}"
    event_types = [event["event_type"] for event in client.get(f"/runs/{run['id']}/trace").json()]
    assert "proposed_memory_approved" in event_types

    assembled = ContextAssembler(db_session).assemble(agent["id"], "Diagnose again.")
    assert proposed["content"] in assembled.prompt
    assert assembled.metadata["memory_ids"] == [agent_memory["id"]]


def test_rejected_proposed_memory_does_not_create_or_retrieve_agent_memory(client, db_session):
    agent = create_agent(client, "Rejector")
    proposed = client.post(
        f"/agents/{agent['id']}/proposed-memories",
        json={"memory_type": "lesson", "content": "Do not learn this.", "importance": 60},
    ).json()
    assert proposed["agent_id"] == agent["id"]
    assert proposed["status"] == "pending"

    reject_response = client.post(f"/agents/{agent['id']}/proposed-memories/{proposed['id']}/reject")

    assert reject_response.status_code == 200
    assert reject_response.json()["proposed_memory"]["status"] == "rejected"
    memories = client.get(f"/agents/{agent['id']}/memories").json()
    assert memories == []
    assembled = ContextAssembler(db_session).assemble(agent["id"], "Try again.")
    assert "Do not learn this." not in assembled.prompt


def test_feedback_derived_memory_is_not_visible_to_other_agents(client, db_session):
    first_agent = create_agent(client, "Owner")
    second_agent = create_agent(client, "Neighbor")
    proposed = client.post(
        f"/agents/{first_agent['id']}/proposed-memories",
        json={"memory_type": "lesson", "content": "OWNER_ONLY_FEEDBACK_MEMORY", "importance": 75},
    ).json()
    client.post(f"/agents/{first_agent['id']}/proposed-memories/{proposed['id']}/approve")

    owner_context = ContextAssembler(db_session).assemble(first_agent["id"], "Use memory.")
    neighbor_context = ContextAssembler(db_session).assemble(second_agent["id"], "Use memory.")

    assert "OWNER_ONLY_FEEDBACK_MEMORY" in owner_context.prompt
    assert "OWNER_ONLY_FEEDBACK_MEMORY" not in neighbor_context.prompt


def test_proposed_memory_wrong_agent_routes_return_not_found(client):
    first_agent = create_agent(client, "First")
    second_agent = create_agent(client, "Second")
    proposed = client.post(
        f"/agents/{first_agent['id']}/proposed-memories",
        json={"memory_type": "lesson", "content": "Private proposal.", "importance": 75},
    ).json()

    assert client.post(f"/agents/{second_agent['id']}/proposed-memories/{proposed['id']}/approve").status_code == 404
    assert client.post(f"/agents/{second_agent['id']}/proposed-memories/{proposed['id']}/reject").status_code == 404


# ---------------------------------------------------------------------------
# ReflectionService unit tests — real LLM path and fallback
# ---------------------------------------------------------------------------


class FakeRealProvider(ProviderInterface):
    """Simulates a real provider with controlled output."""

    def __init__(self, response_content: str):
        self._response = response_content
        self.last_prompt: str | None = None
        self.last_config: dict | None = None

    def generate(self, prompt: str, config: dict) -> ProviderResponse:
        self.last_prompt = prompt
        self.last_config = config
        return ProviderResponse(content=self._response, metadata={"provider": "test", "model": "test"})


def _create_test_agent_run_feedback(db_session):
    """Create agent, run, and feedback for unit tests. Returns (agent, run, feedback)."""
    agent = Agent(name="LLM Reflect Test Agent", role="worker", system_prompt="Test prompt.")
    db_session.add(agent)
    db_session.commit()
    db_session.refresh(agent)

    run = Run(
        workflow_id=1,
        input={"task": "Test task for reflection."},
        status="completed",
        config_snapshot={"agents": [{"id": agent.id}]},
    )
    db_session.add(run)
    db_session.commit()
    db_session.refresh(run)

    feedback = AgentFeedback(
        run_id=run.id,
        agent_id=agent.id,
        feedback_text="The agent should check internal data before asking customers for files.",
        feedback_type="correction",
        rating=2,
    )
    db_session.add(feedback)
    db_session.commit()
    db_session.refresh(feedback)

    return agent, run, feedback


def test_llm_reflection_produces_proposed_memory_from_valid_json(db_session):
    provider = FakeRealProvider(
        '{"content": "When handling BI tasks, verify internal data sources first.", "rationale": "Reduces unnecessary customer back-and-forth."}'
    )
    service = ReflectionService(db_session, provider)
    agent, run, feedback = _create_test_agent_run_feedback(db_session)

    reflection, proposed = service.reflect(
        run, agent, ReflectionRequest(feedback_id=feedback.id, memory_type="lesson", importance=80)
    )

    assert "verify internal data sources first" in reflection
    assert proposed.content == reflection
    assert proposed.status == "pending"
    assert proposed.importance == 80
    assert "BI" not in provider.last_prompt
    assert "internal data" in provider.last_prompt
    assert provider.last_config["temperature"] == 0.3


def test_llm_reflection_falls_back_to_mock_on_bad_json(db_session):
    provider = FakeRealProvider("not valid json!!!")
    service = ReflectionService(db_session, provider)
    agent, run, feedback = _create_test_agent_run_feedback(db_session)

    reflection, proposed = service.reflect(
        run, agent, ReflectionRequest(feedback_id=feedback.id, memory_type="lesson", importance=70)
    )

    assert len(reflection) > 0
    assert proposed.status == "pending"


def test_llm_reflection_falls_back_to_mock_on_missing_content(db_session):
    provider = FakeRealProvider('{"rationale": "Some rationale but no content field."}')
    service = ReflectionService(db_session, provider)
    agent, run, feedback = _create_test_agent_run_feedback(db_session)

    reflection, proposed = service.reflect(
        run, agent, ReflectionRequest(feedback_id=feedback.id, memory_type="lesson", importance=70)
    )

    assert len(reflection) > 0
    assert proposed.status == "pending"


def test_llm_reflection_falls_back_to_mock_on_empty_content(db_session):
    provider = FakeRealProvider('{"content": "", "rationale": "Empty content."}')
    service = ReflectionService(db_session, provider)
    agent, run, feedback = _create_test_agent_run_feedback(db_session)

    reflection, proposed = service.reflect(
        run, agent, ReflectionRequest(feedback_id=feedback.id, memory_type="lesson", importance=70)
    )

    assert len(reflection) > 0
    assert proposed.status == "pending"


def test_llm_reflection_handles_json_in_code_block(db_session):
    provider = FakeRealProvider(
        '```json\n{"content": "Always check internal logs before escalating.", "rationale": "Saves escalation bandwidth."}\n```'
    )
    service = ReflectionService(db_session, provider)
    agent, run, feedback = _create_test_agent_run_feedback(db_session)

    reflection, proposed = service.reflect(
        run, agent, ReflectionRequest(feedback_id=feedback.id, memory_type="lesson", importance=85)
    )

    assert "check internal logs" in reflection
    assert proposed.status == "pending"


def test_reflection_service_without_provider_uses_mock(db_session):
    service = ReflectionService(db_session)
    agent, run, feedback = _create_test_agent_run_feedback(db_session)

    reflection, proposed = service.reflect(
        run, agent, ReflectionRequest(feedback_id=feedback.id, memory_type="lesson", importance=75)
    )

    assert len(reflection) > 0
    assert proposed.status == "pending"
