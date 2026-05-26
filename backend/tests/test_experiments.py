def create_agent(client, name, marker):
    agent = client.post(
        "/agents",
        json={
            "name": name,
            "role": "experiment_subject",
            "system_prompt": f"Respond using {marker}.",
        },
    ).json()
    client.post(
        f"/agents/{agent['id']}/contexts",
        json={"title": f"{name} context", "context_type": "note", "content": f"{marker}_CONTEXT", "priority": 10},
    )
    client.post(
        f"/agents/{agent['id']}/memories",
        json={"memory_type": "lesson", "content": f"{marker}_MEMORY", "status": "active"},
    )
    return agent


def test_experiment_crud_requires_two_or_more_agents(client):
    first_agent = create_agent(client, "Persistent Troubleshooter", "PERSISTENT")
    second_agent = create_agent(client, "Collaborative Coordinator", "COLLABORATIVE")

    invalid_response = client.post(
        "/experiments",
        json={
            "name": "Invalid experiment",
            "task_prompt": "Compare behaviour.",
            "agent_ids": [first_agent["id"]],
        },
    )
    assert invalid_response.status_code == 422

    create_response = client.post(
        "/experiments",
        json={
            "name": "Persistent vs Collaborative troubleshooting behaviour",
            "description": "Compare deterministic mock responses.",
            "task_prompt": "Diagnose flaky tests.",
            "agent_ids": [first_agent["id"], second_agent["id"]],
            "evaluation_config": {"rubric": "clarity, isolation, next action"},
        },
    )
    assert create_response.status_code == 201
    experiment = create_response.json()
    assert experiment["agent_ids"] == [first_agent["id"], second_agent["id"]]

    list_response = client.get("/experiments")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [experiment["id"]]

    detail_response = client.get(f"/experiments/{experiment['id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["name"] == "Persistent vs Collaborative troubleshooting behaviour"


def test_experiment_run_creates_comparison_runs_and_trace_links(client):
    first_agent = create_agent(client, "Persistent Troubleshooter", "PERSISTENT")
    second_agent = create_agent(client, "Collaborative Coordinator", "COLLABORATIVE")
    experiment = client.post(
        "/experiments",
        json={
            "name": "Persistent vs Collaborative troubleshooting behaviour",
            "description": "Compare deterministic mock responses.",
            "task_prompt": "Diagnose flaky tests.",
            "agent_ids": [first_agent["id"], second_agent["id"]],
            "evaluation_config": {"hypothesis": "Personas produce different response framing."},
        },
    ).json()

    run_response = client.post(f"/experiments/{experiment['id']}/run")

    assert run_response.status_code == 201
    experiment_run = run_response.json()
    assert len(experiment_run["run_ids"]) == 2
    comparison = experiment_run["comparison_result"]
    assert comparison["task_prompt"] == "Diagnose flaky tests."
    assert [item["agent_id"] for item in comparison["agent_results"]] == [first_agent["id"], second_agent["id"]]
    assert all(item["trace_url"].startswith("/runs/") for item in comparison["agent_results"])

    first_run_id = experiment_run["run_ids"][0]
    second_run_id = experiment_run["run_ids"][1]
    first_trace = client.get(f"/runs/{first_run_id}/trace").json()
    second_trace = client.get(f"/runs/{second_run_id}/trace").json()

    first_context_event = next(event for event in first_trace if event["event_type"] == "context_assembled")
    second_context_event = next(event for event in second_trace if event["event_type"] == "context_assembled")
    assert "PERSISTENT_CONTEXT" in first_context_event["payload"]["prompt"]
    assert "PERSISTENT_MEMORY" in first_context_event["payload"]["prompt"]
    assert "COLLABORATIVE_CONTEXT" not in first_context_event["payload"]["prompt"]
    assert "COLLABORATIVE_MEMORY" not in first_context_event["payload"]["prompt"]
    assert "COLLABORATIVE_CONTEXT" in second_context_event["payload"]["prompt"]
    assert "COLLABORATIVE_MEMORY" in second_context_event["payload"]["prompt"]
    assert "PERSISTENT_CONTEXT" not in second_context_event["payload"]["prompt"]
    assert "PERSISTENT_MEMORY" not in second_context_event["payload"]["prompt"]

    first_run = client.get(f"/runs/{first_run_id}").json()
    assert first_run["config_snapshot"]["workflow"]["graph_config"]["experiment_id"] == experiment["id"]
    assert first_run["config_snapshot"]["agents"][0]["id"] == first_agent["id"]


def test_delete_succeeds_for_experiment_without_runs(client):
    first_agent = create_agent(client, "Delete Safe Agent A", "DELETE_A")
    second_agent = create_agent(client, "Delete Safe Agent B", "DELETE_B")

    experiment = client.post(
        "/experiments",
        json={
            "name": "Deletable Experiment",
            "task_prompt": "Safe to delete.",
            "agent_ids": [first_agent["id"], second_agent["id"]],
        },
    ).json()

    response = client.delete(f"/experiments/{experiment['id']}")
    assert response.status_code == 204

    list_response = client.get("/experiments")
    assert experiment["id"] not in [e["id"] for e in list_response.json()]


def test_delete_nonexistent_experiment_returns_404(client):
    response = client.delete("/experiments/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_delete_blocked_when_experiment_has_runs_returns_409(client):
    first_agent = create_agent(client, "Blocked Delete Agent A", "BLOCKED_A")
    second_agent = create_agent(client, "Blocked Delete Agent B", "BLOCKED_B")

    experiment = client.post(
        "/experiments",
        json={
            "name": "Blocked Experiment",
            "task_prompt": "Cannot be deleted after running.",
            "agent_ids": [first_agent["id"], second_agent["id"]],
        },
    ).json()

    client.post(f"/experiments/{experiment['id']}/run")

    response = client.delete(f"/experiments/{experiment['id']}")
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert experiment["name"] in detail
    assert "experiment run" in detail.lower()

    get_response = client.get(f"/experiments/{experiment['id']}")
    assert get_response.status_code == 200

    runs_response = client.get("/runs")
    runs_after_blocked_delete = {(run["id"], run["status"]) for run in runs_response.json()}
    assert len(runs_after_blocked_delete) > 0
