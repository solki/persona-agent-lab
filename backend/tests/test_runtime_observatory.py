def create_agent(client, name, marker):
    response = client.post(
        "/agents",
        json={
            "name": name,
            "role": "worker",
            "system_prompt": f"Use marker {marker}.",
        },
    )
    assert response.status_code == 201
    agent = response.json()
    client.post(
        f"/agents/{agent['id']}/contexts",
        json={"title": f"{name} context", "context_type": "note", "content": f"{marker}_CONTEXT", "priority": 10},
    )
    client.post(
        f"/agents/{agent['id']}/memories",
        json={"memory_type": "lesson", "content": f"{marker}_MEMORY", "status": "active", "importance": 80},
    )
    return agent


def create_run(client, agents):
    workflow = client.post(
        "/workflows",
        json={
            "name": "Observable Workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [agent["id"] for agent in agents]},
        },
    ).json()
    response = client.post(f"/workflows/{workflow['id']}/run", json={"task": "Diagnose a production issue."})
    assert response.status_code == 201
    return response.json()


def test_workflow_run_creates_agent_executions_events_and_token_usage(client):
    first_agent = create_agent(client, "First Observer", "FIRST")
    second_agent = create_agent(client, "Second Observer", "SECOND")
    run = create_run(client, [first_agent, second_agent])

    executions_response = client.get(f"/runs/{run['id']}/executions")

    assert executions_response.status_code == 200
    executions = executions_response.json()
    assert [execution["agent_id"] for execution in executions] == [first_agent["id"], second_agent["id"]]
    assert [execution["sequence_index"] for execution in executions] == [0, 1]
    assert all(execution["status"] == "completed" for execution in executions)
    assert all(execution["elapsed_ms"] is not None for execution in executions)
    assert executions[0]["provider"] == "mock"
    assert executions[0]["model"] == "mock-deterministic"
    assert executions[0]["config_snapshot"]["memory_policy"]["write_mode"] == "manual_review"

    events_response = client.get(f"/runs/{run['id']}/executions/{executions[0]['id']}/events")
    assert events_response.status_code == 200
    event_types = [event["event_type"] for event in events_response.json()]
    assert "agent_queued" in event_types
    assert "agent_started" in event_types
    assert "context_assembly_started" in event_types
    assert "context_assembled" in event_types
    assert "memory_retrieval_started" in event_types
    assert "memory_retrieved" in event_types
    assert "llm_request_started" in event_types
    assert "llm_response_received" in event_types
    assert "memory_write_proposed" in event_types
    assert "agent_completed" in event_types

    token_response = client.get(f"/runs/{run['id']}/token-usage")
    assert token_response.status_code == 200
    token_summary = token_response.json()
    assert token_summary["run_id"] == run["id"]
    assert token_summary["total_tokens"] > 0
    assert len(token_summary["items"]) == 2
    assert all(item["raw_usage"]["estimated"] is True for item in token_summary["items"])


def test_monitor_endpoint_returns_completed_executions_events_token_and_learning_summary(client):
    agent = create_agent(client, "Monitor Agent", "MONITOR")
    run = create_run(client, [agent])
    feedback = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/feedback",
        json={"feedback_text": "Use more evidence next time.", "feedback_type": "coaching", "rating": 4},
    ).json()
    client.post(f"/runs/{run['id']}/agents/{agent['id']}/reflect", json={"feedback_id": feedback["id"]})

    response = client.get(f"/runs/{run['id']}/monitor")

    assert response.status_code == 200
    monitor = response.json()
    assert monitor["run_id"] == run["id"]
    assert monitor["run_status"] == "completed"
    assert monitor["active_agent_execution"] is None
    assert len(monitor["agent_executions"]) == 1
    assert monitor["latest_events"]
    assert monitor["token_usage_summary"]["total_tokens"] > 0
    assert monitor["learning_event_summary"]["feedback_count"] == 1
    assert monitor["learning_event_summary"]["proposed_memory_count"] == 1
    assert monitor["errors"] == []


def test_execution_detail_shows_only_context_and_memory_for_that_execution(client):
    first_agent = create_agent(client, "Private First", "FIRST_PRIVATE")
    second_agent = create_agent(client, "Private Second", "SECOND_PRIVATE")
    run = create_run(client, [first_agent, second_agent])
    executions = client.get(f"/runs/{run['id']}/executions").json()

    detail_response = client.get(f"/runs/{run['id']}/executions/{executions[0]['id']}")

    assert detail_response.status_code == 200
    detail = detail_response.json()
    serialized_detail = str(detail)
    assert "FIRST_PRIVATE_CONTEXT" in serialized_detail
    assert "FIRST_PRIVATE_MEMORY" in serialized_detail
    assert "SECOND_PRIVATE_CONTEXT" not in serialized_detail
    assert "SECOND_PRIVATE_MEMORY" not in serialized_detail


def test_agent_evolution_is_scoped_to_one_agent_learning_and_memory(client):
    first_agent = create_agent(client, "Evolving First", "FIRST_EVOLVE")
    second_agent = create_agent(client, "Evolving Second", "SECOND_EVOLVE")
    first_run = create_run(client, [first_agent])
    second_run = create_run(client, [second_agent])
    first_feedback = client.post(
        f"/runs/{first_run['id']}/agents/{first_agent['id']}/feedback",
        json={"feedback_text": "First agent feedback.", "feedback_type": "coaching"},
    ).json()
    first_proposal = client.post(
        f"/runs/{first_run['id']}/agents/{first_agent['id']}/reflect",
        json={"feedback_id": first_feedback["id"]},
    ).json()["proposed_memory"]
    client.post(f"/agents/{first_agent['id']}/proposed-memories/{first_proposal['id']}/approve")
    client.post(
        f"/runs/{second_run['id']}/agents/{second_agent['id']}/feedback",
        json={"feedback_text": "Second agent feedback.", "feedback_type": "coaching"},
    )

    evolution_response = client.get(f"/agents/{first_agent['id']}/evolution")

    assert evolution_response.status_code == 200
    evolution = evolution_response.json()
    assert evolution["agent_id"] == first_agent["id"]
    serialized_evolution = str(evolution)
    assert "First agent feedback." in serialized_evolution
    assert "Second agent feedback." not in serialized_evolution
    assert all(item["agent_id"] == first_agent["id"] for item in evolution["learning_events"])
    assert all(item["agent_id"] == first_agent["id"] for item in evolution["memories"])


def test_agent_performance_summary_aggregates_agent_runs_and_tokens(client):
    first_agent = create_agent(client, "Performance First", "PERF_FIRST")
    second_agent = create_agent(client, "Performance Second", "PERF_SECOND")
    create_run(client, [first_agent])
    create_run(client, [first_agent])
    create_run(client, [second_agent])

    response = client.get(f"/agents/{first_agent['id']}/performance-summary")

    assert response.status_code == 200
    summary = response.json()
    assert summary["agent_id"] == first_agent["id"]
    assert summary["execution_count"] == 2
    assert summary["completed_count"] == 2
    assert summary["total_tokens"] > 0
    assert summary["estimated_cost"] == 0.0
