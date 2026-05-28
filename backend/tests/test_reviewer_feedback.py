def create_agent(client, name, role="worker", system_prompt="Do work.", soul_id=None):
    payload = {
        "name": name,
        "role": role,
        "system_prompt": system_prompt,
    }
    if soul_id is not None:
        payload["soul_id"] = soul_id
    response = client.post("/agents", json=payload)
    assert response.status_code == 201
    return response.json()


def create_run(client, agent):
    workflow = client.post(
        "/workflows",
        json={
            "name": f"{agent['name']} review workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [agent["id"]]},
        },
    ).json()
    response = client.post(f"/workflows/{workflow['id']}/run", json={"task": "Analyze this task and respond."})
    assert response.status_code == 201
    return response.json()


def test_reviewer_evaluation_creates_evaluation(client):
    """A reviewer agent evaluates a target agent's output and creates an AgentEvaluation."""
    target = create_agent(client, "Target Worker", role="worker")
    reviewer = create_agent(
        client,
        "Strict Reviewer",
        role="quality-reviewer",
        system_prompt="Evaluate agents critically. Identify missing details and risk signals.",
    )
    run = create_run(client, target)

    response = client.post(
        f"/runs/{run['id']}/agents/{target['id']}/review",
        json={"reviewer_agent_id": reviewer["id"]},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["run_id"] == run["id"]
    assert data["target_agent_id"] == target["id"]
    assert data["reviewer_agent_id"] == reviewer["id"]

    evaluation = data["evaluation"]
    assert evaluation["run_id"] == run["id"]
    assert evaluation["agent_id"] == target["id"]
    assert evaluation["evaluator_type"] == "agent_reviewer"
    assert "overall_quality" in evaluation["scores"]
    assert "overall_safety" in evaluation["scores"]

    # Verify reviewer metadata is stored in issues JSON
    issues = evaluation["issues"]
    assert issues["_meta"]["reviewer_agent_id"] == reviewer["id"]
    assert issues["_meta"]["reviewer_agent_name"] == reviewer["name"]
    assert "derived_criteria" in issues
    assert "quality_checks" in issues
    assert "risk_flags" in issues

    # Verify proposed memory was created (corrective mock)
    proposed = data["proposed_memory"]
    assert proposed is not None
    assert proposed["agent_id"] == target["id"]
    assert proposed["status"] == "pending"
    assert proposed["source_evaluation_id"] == evaluation["id"]
    assert len(proposed["content"]) > 0


def test_corrective_review_creates_pending_proposed_memory(client):
    """A corrective review creates a pending ProposedMemory for the target agent."""
    target = create_agent(client, "Error Prone Agent")
    reviewer = create_agent(
        client,
        "Tough Reviewer",
        role="quality-reviewer",
        system_prompt="Evaluate strictly.",
    )
    run = create_run(client, target)

    response = client.post(
        f"/runs/{run['id']}/agents/{target['id']}/review",
        json={"reviewer_agent_id": reviewer["id"]},
    )

    assert response.status_code == 201
    data = response.json()
    proposed = data["proposed_memory"]
    assert proposed is not None
    assert proposed["memory_type"] == "lesson"
    assert proposed["importance"] == 80
    assert proposed["status"] == "pending"
    assert "extract all information" in proposed["content"]


def test_none_review_creates_no_proposed_memory(client):
    """When the reviewer decides no memory is needed, no ProposedMemory is created."""
    target = create_agent(
        client,
        "Perfect Agent",
        role="perfect-worker",
        system_prompt="You are PERFECT. Always include PERFECT in your analysis.",
    )
    reviewer = create_agent(
        client,
        "Lenient Reviewer",
        role="quality-reviewer",
        system_prompt="Evaluate fairly.",
    )
    # Create run with a task that signals the mock to produce "PERFECT"
    workflow = client.post(
        "/workflows",
        json={
            "name": "perfect agent review workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [target["id"]]},
        },
    ).json()
    run_response = client.post(
        f"/workflows/{workflow['id']}/run",
        json={"task": "Produce a PERFECT analysis of this task."},
    )
    assert run_response.status_code == 201
    run = run_response.json()

    response = client.post(
        f"/runs/{run['id']}/agents/{target['id']}/review",
        json={"reviewer_agent_id": reviewer["id"]},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["proposed_memory"] is None

    evaluation = data["evaluation"]
    assert evaluation["recommendations"]["should_generate_memory"] is False
    assert evaluation["issues"]["_meta"]["memory_decision"] == "none"


def test_invalid_reviewer_agent_id_returns_error(client):
    """A non-existent reviewer agent returns a clear error."""
    target = create_agent(client, "Valid Target")
    run = create_run(client, target)

    response = client.post(
        f"/runs/{run['id']}/agents/{target['id']}/review",
        json={"reviewer_agent_id": 99999},
    )

    assert response.status_code == 404


def test_target_agent_must_have_participated_in_run(client):
    """The target agent must have actually participated in the run."""
    target = create_agent(client, "Participating Agent")
    non_participant = create_agent(client, "Non-Participant Agent")
    reviewer = create_agent(
        client,
        "Reviewer",
        role="quality-reviewer",
        system_prompt="Evaluate agents.",
    )
    run = create_run(client, target)

    response = client.post(
        f"/runs/{run['id']}/agents/{non_participant['id']}/review",
        json={"reviewer_agent_id": reviewer["id"]},
    )

    assert response.status_code == 400
    assert "did not participate" in response.json()["detail"]


def test_reviewer_can_evaluate_target_with_soul_context_and_memory(client):
    """Review includes target's soul, contexts, and memories in the evaluation."""
    soul = client.post(
        "/souls",
        json={
            "name": "Detail-Oriented Soul",
            "description": "Meticulous and thorough persona.",
            "principles": "Always verify before responding.",
        },
    ).json()

    target = create_agent(
        client,
        "Rich Context Agent",
        role="analyst",
        system_prompt="Analyze data thoroughly. Never skip verification steps.",
        soul_id=soul["id"],
    )

    # Add context and memory to the target agent
    client.post(
        f"/agents/{target['id']}/contexts",
        json={
            "title": "Verification Protocol",
            "context_type": "knowledge",
            "content": "Always cross-check claims against provided data before responding.",
            "priority": 10,
        },
    )
    client.post(
        f"/agents/{target['id']}/memories",
        json={
            "memory_type": "lesson",
            "content": "In previous tasks, skipping verification led to incorrect conclusions.",
            "importance": 90,
            "status": "active",
        },
    )

    reviewer = create_agent(
        client,
        "Thorough Reviewer",
        role="quality-reviewer",
        system_prompt="Evaluate whether agents apply their contexts and memories.",
    )

    # Add review methodology context to reviewer
    client.post(
        f"/agents/{reviewer['id']}/contexts",
        json={
            "title": "Context Application Check",
            "context_type": "review_methodology",
            "content": "Verify that the agent applied all active contexts and memories in its response.",
            "priority": 10,
        },
    )

    run = create_run(client, target)

    response = client.post(
        f"/runs/{run['id']}/agents/{target['id']}/review",
        json={"reviewer_agent_id": reviewer["id"]},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["evaluation"]["evaluator_type"] == "agent_reviewer"
    assert data["proposed_memory"] is not None


def test_existing_learning_flow_still_works(client):
    """Existing human feedback + reflection flow is unaffected by reviewer changes."""
    agent = create_agent(client, "Learner Agent")
    run = create_run(client, agent)

    # Human feedback
    fb_response = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/feedback",
        json={
            "rating": 3,
            "feedback_text": "The agent should check available data before asking questions.",
            "feedback_type": "correction",
        },
    )
    assert fb_response.status_code == 201
    feedback = fb_response.json()

    # Reflection
    ref_response = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/reflect",
        json={"feedback_id": feedback["id"], "memory_type": "lesson"},
    )
    assert ref_response.status_code == 201
    reflection = ref_response.json()
    assert reflection["proposed_memory"]["status"] == "pending"

    # Approve
    memory_id = reflection["proposed_memory"]["id"]
    app_response = client.post(
        f"/agents/{agent['id']}/proposed-memories/{memory_id}/approve",
    )
    assert app_response.status_code == 200
    assert app_response.json()["agent_memory"]["status"] == "active"
