def create_agent(client, name, system_prompt):
    response = client.post(
        "/agents",
        json={
            "name": name,
            "role": "worker",
            "system_prompt": system_prompt,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_workflow_crud(client):
    create_response = client.post(
        "/workflows",
        json={
            "name": "Troubleshooting Plan Workflow",
            "description": "Sequential troubleshooting flow.",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": []},
        },
    )

    assert create_response.status_code == 201
    workflow = create_response.json()
    assert workflow["name"] == "Troubleshooting Plan Workflow"

    list_response = client.get("/workflows")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [workflow["id"]]

    update_response = client.put(
        f"/workflows/{workflow['id']}",
        json={"name": "Updated Workflow", "workflow_type": "sequential", "graph_config": {"agent_sequence": []}},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Workflow"

    delete_response = client.delete(f"/workflows/{workflow['id']}")
    assert delete_response.status_code == 204
    assert client.get(f"/workflows/{workflow['id']}").status_code == 404


def test_sequential_workflow_run_creates_trace_events_and_snapshot(client):
    first_agent = create_agent(client, "Persistent Troubleshooter", "Find the root cause.")
    second_agent = create_agent(client, "Critical Reviewer", "Review the answer.")
    client.post(
        f"/agents/{first_agent['id']}/contexts",
        json={"title": "First context", "context_type": "note", "content": "FIRST_CONTEXT", "priority": 10},
    )
    client.post(
        f"/agents/{second_agent['id']}/contexts",
        json={"title": "Second context", "context_type": "note", "content": "SECOND_CONTEXT", "priority": 10},
    )
    client.post(
        f"/agents/{first_agent['id']}/memories",
        json={"memory_type": "lesson", "content": "FIRST_MEMORY", "status": "active"},
    )
    client.post(
        f"/agents/{second_agent['id']}/memories",
        json={"memory_type": "lesson", "content": "SECOND_MEMORY", "status": "active"},
    )
    workflow = client.post(
        "/workflows",
        json={
            "name": "Troubleshooting Plan Workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [first_agent["id"], second_agent["id"]]},
        },
    ).json()

    run_response = client.post(f"/workflows/{workflow['id']}/run", json={"task": "Diagnose flaky tests."})

    assert run_response.status_code == 201
    run = run_response.json()
    assert run["status"] == "completed"
    assert run["workflow_id"] == workflow["id"]
    assert run["config_snapshot"]["workflow"]["id"] == workflow["id"]
    assert [agent["id"] for agent in run["config_snapshot"]["agents"]] == [first_agent["id"], second_agent["id"]]
    assert len(run["output"]["agent_outputs"]) == 2

    trace_response = client.get(f"/runs/{run['id']}/trace")
    assert trace_response.status_code == 200
    events = trace_response.json()
    event_types = [event["event_type"] for event in events]
    assert event_types[0] == "run_started"
    assert "workflow_loaded" in event_types
    assert event_types.count("agent_selected") == 2
    assert event_types.count("context_assembled") == 2
    assert event_types.count("memory_retrieved") == 2
    assert event_types.count("llm_request_started") == 2
    assert event_types.count("llm_response_received") == 2
    assert event_types.count("agent_output") == 2
    assert event_types.count("agent_completed") == 2
    assert "run_completed" in event_types

    first_context_event = next(
        event
        for event in events
        if event["event_type"] == "context_assembled" and event["agent_id"] == first_agent["id"]
    )
    assert "FIRST_CONTEXT" in first_context_event["payload"]["prompt"]
    assert "FIRST_MEMORY" in first_context_event["payload"]["prompt"]
    assert "SECOND_CONTEXT" not in first_context_event["payload"]["prompt"]
    assert "SECOND_MEMORY" not in first_context_event["payload"]["prompt"]


def test_runs_list_and_detail(client):
    agent = create_agent(client, "Solo Agent", "Answer deterministically.")
    workflow = client.post(
        "/workflows",
        json={
            "name": "Solo Workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [agent["id"]]},
        },
    ).json()
    run = client.post(f"/workflows/{workflow['id']}/run", json={"task": "Summarize status."}).json()

    list_response = client.get("/runs")
    detail_response = client.get(f"/runs/{run['id']}")

    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [run["id"]]
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == run["id"]
