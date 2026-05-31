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
    assert "force" in detail.lower()

    get_response = client.get(f"/experiments/{experiment['id']}")
    assert get_response.status_code == 200

    runs_response = client.get("/runs")
    runs_after_blocked_delete = {(run["id"], run["status"]) for run in runs_response.json()}
    assert len(runs_after_blocked_delete) > 0


def test_archive_and_activate_experiment_with_runs_preserves_related_runs(client):
    first_agent = create_agent(client, "Archive Experiment Agent A", "ARCHIVE_A")
    second_agent = create_agent(client, "Archive Experiment Agent B", "ARCHIVE_B")

    experiment = client.post(
        "/experiments",
        json={
            "name": "Archivable Experiment",
            "task_prompt": "Archive after running.",
            "agent_ids": [first_agent["id"], second_agent["id"]],
        },
    ).json()
    experiment_run = client.post(f"/experiments/{experiment['id']}/run").json()

    archive_response = client.post(f"/experiments/{experiment['id']}/archive")

    assert archive_response.status_code == 200
    assert archive_response.json()["archived"] is True
    assert archive_response.json()["archived_at"] is not None
    assert "preserved" in archive_response.json()["message"]

    default_list = client.get("/experiments").json()
    assert experiment["id"] not in [item["id"] for item in default_list]

    archived_list = client.get("/experiments?include_archived=true").json()
    archived = next(item for item in archived_list if item["id"] == experiment["id"])
    assert archived["archived_at"] is not None
    for run_id in experiment_run["run_ids"]:
        assert client.get(f"/runs/{run_id}").status_code == 200

    activate_response = client.post(f"/experiments/{experiment['id']}/activate")

    assert activate_response.status_code == 200
    assert activate_response.json()["archived"] is False
    active_list = client.get("/experiments").json()
    assert experiment["id"] in [item["id"] for item in active_list]


# ---------------------------------------------------------------------------
# Soul Behavior Comparison
# ---------------------------------------------------------------------------


def _create_soul(client, name, decision_style="Decisive"):
    resp = client.post("/souls", json={"name": name, "persona": f"{name} persona.", "decision_style": decision_style, "is_active": True})
    assert resp.status_code == 201
    return resp.json()


def _create_supervisor_workflow_for_test(client, supervisor_id, worker_ids):
    resp = client.post(
        "/workflows",
        json={
            "name": "TEST-SoulComp-Workflow",
            "workflow_type": "supervisor",
            "graph_config": {"supervisor_agent_id": supervisor_id, "worker_agent_ids": worker_ids, "max_iterations": 5},
        },
    )
    assert resp.status_code == 201
    return resp.json()


def test_soul_comparison_experiment_creates_variants(client):
    """Run the same supervisor task with two different souls and compare results."""
    soul_a = _create_soul(client, "TEST-Authoritative-Soul", decision_style="Decisive, fast, delegates with short instructions")
    soul_b = _create_soul(client, "TEST-Collaborative-Soul", decision_style="Consensus-seeking, thorough, gives rich instructions")

    supervisor = client.post(
        "/agents",
        json={"name": "TEST-SoulComp-Supervisor", "role": "coordinator", "system_prompt": "Coordinate.", "soul_id": soul_a["id"]},
    ).json()
    worker = client.post(
        "/agents",
        json={"name": "TEST-SoulComp-Worker", "role": "worker", "system_prompt": "Work."},
    ).json()
    workflow = _create_supervisor_workflow_for_test(client, supervisor["id"], [worker["id"]])

    experiment = client.post(
        "/experiments",
        json={
            "name": "TEST Soul Comparison: Authoritative vs Collaborative",
            "task_prompt": "Handle a complex customer complaint.",
            "evaluation_config": {
                "experiment_type": "soul_behavior_comparison",
                "workflow_id": workflow["id"],
                "supervisor_agent_id": supervisor["id"],
                "soul_ids": [soul_a["id"], soul_b["id"]],
            },
        },
    )
    assert experiment.status_code == 201
    exp = experiment.json()

    run_resp = client.post(f"/experiments/{exp['id']}/run")
    assert run_resp.status_code == 201
    exp_run = run_resp.json()
    assert len(exp_run["run_ids"]) == 2

    comparison = exp_run["comparison_result"]
    assert comparison["experiment_type"] == "soul_behavior_comparison"
    assert comparison["supervisor_agent_id"] == supervisor["id"]
    assert len(comparison["variants"]) == 2

    variants = comparison["variants"]
    soul_names = [v["soul_name"] for v in variants]
    assert soul_a["name"] in soul_names
    assert soul_b["name"] in soul_names

    for v in variants:
        assert "run_id" in v
        assert "delegation_count" in v
        assert "worker_order" in v
        assert "total_tokens" in v
        assert "final_output_preview" in v
        assert "full_final_output" in v
        assert "collaboration_graph_url" in v
        assert v["collaboration_graph_url"].startswith("/runs/")

    # Verify both runs exist and are accessible
    for run_id in exp_run["run_ids"]:
        run = client.get(f"/runs/{run_id}")
        assert run.status_code == 200

    # Verify collaboration graph works for both
    for run_id in exp_run["run_ids"]:
        graph = client.get(f"/runs/{run_id}/collaboration-graph")
        assert graph.status_code == 200


def test_soul_comparison_restores_original_supervisor_soul(client):
    """After running soul comparison, the supervisor's original soul_id should be restored."""
    soul_a = _create_soul(client, "TEST-Restore-Soul-A", decision_style="Decisive")
    soul_b = _create_soul(client, "TEST-Restore-Soul-B", decision_style="Collaborative")

    supervisor = client.post(
        "/agents",
        json={"name": "TEST-Restore-Supervisor", "role": "coordinator", "system_prompt": "Coordinate.", "soul_id": soul_a["id"]},
    ).json()
    worker = client.post(
        "/agents",
        json={"name": "TEST-Restore-Worker", "role": "worker", "system_prompt": "Work."},
    ).json()
    workflow = _create_supervisor_workflow_for_test(client, supervisor["id"], [worker["id"]])

    experiment = client.post(
        "/experiments",
        json={
            "name": "TEST Soul Restore Check",
            "task_prompt": "Test soul restoration.",
            "evaluation_config": {
                "experiment_type": "soul_behavior_comparison",
                "workflow_id": workflow["id"],
                "supervisor_agent_id": supervisor["id"],
                "soul_ids": [soul_a["id"], soul_b["id"]],
            },
        },
    ).json()

    client.post(f"/experiments/{experiment['id']}/run")

    # Verify supervisor soul is restored to original
    supervisor_after = client.get(f"/agents/{supervisor['id']}").json()
    assert supervisor_after["soul_id"] == soul_a["id"]


def test_soul_comparison_requires_two_souls(client):
    """Schema validation: soul_comparison needs at least 2 souls."""
    soul = _create_soul(client, "TEST-Single-Soul")
    supervisor = client.post(
        "/agents",
        json={"name": "TEST-Req-Supervisor", "role": "coordinator", "system_prompt": "Coordinate."},
    ).json()
    worker = client.post(
        "/agents",
        json={"name": "TEST-Req-Worker", "role": "worker", "system_prompt": "Work."},
    ).json()
    workflow = _create_supervisor_workflow_for_test(client, supervisor["id"], [worker["id"]])

    resp = client.post(
        "/experiments",
        json={
            "name": "TEST Bad Soul Comp",
            "task_prompt": "Test.",
            "evaluation_config": {
                "experiment_type": "soul_behavior_comparison",
                "workflow_id": workflow["id"],
                "supervisor_agent_id": supervisor["id"],
                "soul_ids": [soul["id"]],  # only 1 soul
            },
        },
    )
    assert resp.status_code == 422


def test_soul_comparison_with_three_souls(client):
    """Should work with 3 or more souls too."""
    souls = [
        _create_soul(client, "TEST-Triple-A", decision_style="A"),
        _create_soul(client, "TEST-Triple-B", decision_style="B"),
        _create_soul(client, "TEST-Triple-C", decision_style="C"),
    ]
    supervisor = client.post(
        "/agents",
        json={"name": "TEST-Triple-Supervisor", "role": "coordinator", "system_prompt": "Coordinate."},
    ).json()
    worker = client.post(
        "/agents",
        json={"name": "TEST-Triple-Worker", "role": "worker", "system_prompt": "Work."},
    ).json()
    workflow = _create_supervisor_workflow_for_test(client, supervisor["id"], [worker["id"]])

    experiment = client.post(
        "/experiments",
        json={
            "name": "TEST Triple Soul Comparison",
            "task_prompt": "Triple comparison.",
            "evaluation_config": {
                "experiment_type": "soul_behavior_comparison",
                "workflow_id": workflow["id"],
                "supervisor_agent_id": supervisor["id"],
                "soul_ids": [s["id"] for s in souls],
            },
        },
    ).json()

    exp_run = client.post(f"/experiments/{experiment['id']}/run").json()
    assert len(exp_run["run_ids"]) == 3
    assert len(exp_run["comparison_result"]["variants"]) == 3


def test_force_delete_succeeds_for_experiment_with_runs(client):
    first_agent = create_agent(client, "Force Delete Agent A", "FORCE_A")
    second_agent = create_agent(client, "Force Delete Agent B", "FORCE_B")

    experiment = client.post(
        "/experiments",
        json={
            "name": "Force Deletable Experiment",
            "task_prompt": "Force delete after running.",
            "agent_ids": [first_agent["id"], second_agent["id"]],
        },
    ).json()

    client.post(f"/experiments/{experiment['id']}/run")

    response = client.delete(f"/experiments/{experiment['id']}?force=true")
    assert response.status_code == 204

    get_response = client.get(f"/experiments/{experiment['id']}")
    assert get_response.status_code == 404

    runs_response = client.get("/runs")
    assert len(runs_response.json()) == 0
