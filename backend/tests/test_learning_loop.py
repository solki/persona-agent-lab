from app.runtime.context_assembler import ContextAssembler


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
