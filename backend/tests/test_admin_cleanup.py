def test_admin_cleanup_removes_all_records(client):
    # Create test data across multiple tables
    soul = client.post("/souls", json={"name": "Test Soul", "description": "desc"}).json()
    agent1 = client.post(
        "/agents",
        json={
            "name": "Test Agent 1",
            "role": "operator",
            "system_prompt": "Do work.",
            "soul_id": soul["id"],
        },
    ).json()
    agent2 = client.post(
        "/agents",
        json={
            "name": "Test Agent 2",
            "role": "operator",
            "system_prompt": "Review work.",
            "soul_id": soul["id"],
        },
    ).json()
    tool = client.post(
        "/tools",
        json={
            "name": "test_tool",
            "tool_type": "internal_reference",
            "config": {"mode": "mock"},
        },
    ).json()
    client.post(f"/agents/{agent1['id']}/tools/{tool['id']}")
    client.post(
        f"/agents/{agent1['id']}/contexts",
        json={
            "title": "Test Context",
            "context_type": "knowledge",
            "content": "Test content",
            "priority": 5,
        },
    )
    client.post(
        f"/agents/{agent1['id']}/memories",
        json={
            "memory_type": "lesson",
            "content": "Test memory",
            "importance": 50,
            "status": "active",
        },
    )
    workflow = client.post(
        "/workflows",
        json={
            "name": "Test Workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [agent1["id"]]},
        },
    ).json()
    run = client.post(f"/workflows/{workflow['id']}/run", json={"task": "hello"}).json()
    fb = client.post(
        f"/runs/{run['id']}/agents/{agent1['id']}/feedback",
        json={
            "feedback_text": "needs work",
            "feedback_type": "correction",
            "rating": 2,
        },
    ).json()
    client.post(
        f"/runs/{run['id']}/agents/{agent1['id']}/reflect",
        json={"feedback_id": fb["id"]},
    )
    experiment = client.post(
        "/experiments",
        json={
            "name": "Test Experiment",
            "description": "desc",
            "task_prompt": "test task",
            "agent_ids": [agent1["id"], agent2["id"]],
            "evaluation_config": {"rubric": "clarity"},
        },
    ).json()
    client.post(f"/experiments/{experiment['id']}/run")

    # Verify data exists before cleanup
    assert len(client.get("/souls").json()) >= 1
    assert len(client.get("/agents").json()) >= 2
    assert len(client.get("/tools").json()) >= 1
    assert len(client.get("/workflows").json()) >= 1
    assert len(client.get("/runs").json()) >= 1
    assert len(client.get("/experiments").json()) >= 1

    # Perform admin cleanup
    response = client.post("/admin/cleanup-lab-data", json={})
    assert response.status_code == 200
    result = response.json()

    # Verify counts are non-zero (data was actually deleted)
    assert result["deleted_souls"] >= 1
    assert result["deleted_agents"] >= 2
    assert result["deleted_tools"] >= 1
    assert result["deleted_workflows"] >= 1
    assert result["deleted_runs"] >= 1
    assert result["deleted_experiments"] >= 1
    assert result["deleted_contexts"] >= 1
    assert result["deleted_memories"] >= 1
    assert result["deleted_feedback"] >= 1
    assert result["deleted_proposed_memories"] >= 1
    assert result["deleted_agent_tool_assignments"] >= 1
    assert result["deleted_trace_events"] >= 1
    assert result["deleted_agent_executions"] >= 1
    assert result["deleted_experiment_runs"] >= 1

    # Verify all data is gone
    assert client.get("/souls").json() == []
    assert client.get("/agents").json() == []
    assert client.get("/tools").json() == []
    assert client.get("/workflows").json() == []
    assert client.get("/runs").json() == []
    assert client.get("/experiments").json() == []


def test_admin_cleanup_works_on_empty_database(client):
    response = client.post("/admin/cleanup-lab-data", json={})
    assert response.status_code == 200
    result = response.json()

    # All counts should be zero
    for key, value in result.items():
        assert value == 0, f"Expected {key} to be 0 on empty DB, got {value}"


def test_admin_cleanup_preserves_schema(client):
    """After cleanup, all API endpoints should still work (schema is preserved)."""
    # Clean up (even if empty)
    client.post("/admin/cleanup-lab-data", json={})

    # Verify we can still create entities after cleanup
    soul = client.post("/souls", json={"name": "After Cleanup Soul"}).json()
    assert soul["id"] > 0

    agent = client.post(
        "/agents",
        json={
            "name": "After Cleanup Agent",
            "role": "operator",
            "system_prompt": "Hello.",
            "soul_id": soul["id"],
        },
    ).json()
    assert agent["id"] > 0

    # Verify they are retrievable
    assert len(client.get("/souls").json()) == 1
    assert len(client.get("/agents").json()) == 1
