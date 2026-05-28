from app.services.demo_service import (
    DEMO_PREFIX, DEMO_WORKFLOW_NAME, AGENT_DEFS, SOUL_DEFS, WORKFLOW_AGENT_NAMES,
)


def _find_by_id(items: list[dict], item_id: int) -> dict:
    for item in items:
        if item["id"] == item_id:
            return item
    raise KeyError(f"item {item_id} not found")


def test_seed_creates_all_souls(client):
    response = client.post("/demo/seed", json={})
    assert response.status_code == 200
    data = response.json()

    soul_names = {s["name"] for s in data["souls"]}
    assert len(data["souls"]) == 4
    for sd in SOUL_DEFS:
        assert sd["name"] in soul_names


def test_seed_creates_all_agents_with_correct_souls(client):
    response = client.post("/demo/seed", json={})
    assert response.status_code == 200
    data = response.json()

    assert len(data["agents"]) == 4

    expected_soul_map = {ad["name"]: ad["soul_name"] for ad in AGENT_DEFS}

    for agent_ref in data["agents"]:
        agent = client.get(f"/agents/{agent_ref['id']}").json()
        expected_soul_name = expected_soul_map[agent["name"]]
        soul = client.get(f"/souls/{agent['soul_id']}").json()
        assert soul["name"] == expected_soul_name


def test_seed_creates_contexts_and_memories(client):
    response = client.post("/demo/seed", json={})
    assert response.status_code == 200
    data = response.json()

    expected_ctx_count = sum(len(ad["initial_contexts"]) for ad in AGENT_DEFS)
    expected_mem_count = sum(len(ad["initial_memories"]) for ad in AGENT_DEFS)
    assert len(data["contexts"]) == expected_ctx_count
    assert len(data["memories"]) == expected_mem_count


def test_workflow_has_three_execution_agents_in_correct_order(client):
    response = client.post("/demo/seed", json={})
    assert response.status_code == 200
    data = response.json()

    wf_ref = data["workflow"]
    assert wf_ref is not None
    workflow = client.get(f"/workflows/{wf_ref['id']}").json()
    assert workflow["name"] == DEMO_WORKFLOW_NAME
    assert workflow["workflow_type"] == "sequential"

    agent_sequence = workflow["graph_config"]["agent_sequence"]
    assert len(agent_sequence) == 3

    for i, agent_id in enumerate(agent_sequence):
        agent = client.get(f"/agents/{agent_id}").json()
        assert agent["name"] == WORKFLOW_AGENT_NAMES[i]


def test_reviewer_agent_not_in_workflow(client):
    response = client.post("/demo/seed", json={})
    assert response.status_code == 200
    data = response.json()

    reviewer_name = f"{DEMO_PREFIX}Escalation Quality Reviewer"
    reviewer_ref = next((a for a in data["agents"] if a["name"] == reviewer_name), None)
    assert reviewer_ref is not None

    wf_ref = data["workflow"]
    workflow = client.get(f"/workflows/{wf_ref['id']}").json()
    agent_sequence = workflow["graph_config"]["agent_sequence"]
    assert reviewer_ref["id"] not in agent_sequence


def test_reviewer_has_quality_reviewer_role(client):
    response = client.post("/demo/seed", json={})
    assert response.status_code == 200
    data = response.json()

    reviewer_name = f"{DEMO_PREFIX}Escalation Quality Reviewer"
    reviewer_ref = next((a for a in data["agents"] if a["name"] == reviewer_name), None)
    assert reviewer_ref is not None

    agent = client.get(f"/agents/{reviewer_ref['id']}").json()
    assert agent["role"] == "quality-reviewer"


def test_repeated_seeding_is_idempotent(client):
    r1 = client.post("/demo/seed", json={})
    assert r1.status_code == 200
    d1 = r1.json()

    r2 = client.post("/demo/seed", json={})
    assert r2.status_code == 200
    d2 = r2.json()

    assert len(d2["souls"]) == len(d1["souls"])
    assert len(d2["agents"]) == len(d1["agents"])
    assert len(d2["contexts"]) == len(d1["contexts"])
    assert len(d2["memories"]) == len(d1["memories"])

    assert {s["id"] for s in d2["souls"]} == {s["id"] for s in d1["souls"]}
    assert {a["id"] for a in d2["agents"]} == {a["id"] for a in d1["agents"]}

    assert all(not s["created"] for s in d2["souls"])
    assert all(not a["created"] for a in d2["agents"])


def test_seed_updates_agent_if_content_differs(client):
    client.post("/demo/seed", json={})

    triage_name = f"{DEMO_PREFIX}Escalation Triage Agent"
    agents = client.get("/agents").json()
    triage = next(a for a in agents if a["name"] == triage_name)
    original_prompt = triage["system_prompt"]
    client.put(f"/agents/{triage['id']}", json={**triage, "system_prompt": "CHANGED PROMPT"})

    r = client.post("/demo/seed", json={})
    assert r.status_code == 200
    updated = client.get(f"/agents/{triage['id']}").json()
    assert updated["system_prompt"] != "CHANGED PROMPT"
    assert updated["system_prompt"] == original_prompt


def test_seed_updates_context_if_content_differs(client):
    client.post("/demo/seed", json={})

    triage_name = f"{DEMO_PREFIX}Escalation Triage Agent"
    agents = client.get("/agents").json()
    triage = next(a for a in agents if a["name"] == triage_name)

    contexts = client.get(f"/agents/{triage['id']}/contexts").json()
    original_ctx = contexts[0]
    client.put(
        f"/agents/{triage['id']}/contexts/{original_ctx['id']}",
        json={"content": "CHANGED CONTEXT"},
    )

    # Re-seed restores
    client.post("/demo/seed", json={})
    restored_contexts = client.get(f"/agents/{triage['id']}/contexts").json()
    restored_ctx = _find_by_id(restored_contexts, original_ctx["id"])
    assert restored_ctx["content"] != "CHANGED CONTEXT"
    assert restored_ctx["content"] == original_ctx["content"]


def test_seed_updates_memory_if_content_differs(client):
    client.post("/demo/seed", json={})

    triage_name = f"{DEMO_PREFIX}Escalation Triage Agent"
    agents = client.get("/agents").json()
    triage = next(a for a in agents if a["name"] == triage_name)

    memories = client.get(f"/agents/{triage['id']}/memories").json()
    original_mem = memories[0]
    client.put(
        f"/agents/{triage['id']}/memories/{original_mem['id']}",
        json={"content": "CHANGED MEMORY"},
    )

    # Re-seed restores
    client.post("/demo/seed", json={})
    restored_memories = client.get(f"/agents/{triage['id']}/memories").json()
    restored_mem = _find_by_id(restored_memories, original_mem["id"])
    assert restored_mem["content"] != "CHANGED MEMORY"
    assert restored_mem["content"] == original_mem["content"]


def test_seed_creates_no_runs(client):
    client.post("/demo/seed", json={})
    agents = client.get("/agents").json()
    demo_agent_ids = [a["id"] for a in agents if a["name"].startswith(DEMO_PREFIX)]

    runs = client.get("/runs").json()
    # No workflow was run, so there should be zero runs overall
    assert len(runs) == 0


def test_seed_creates_no_feedback_evaluations_or_proposed_memories(client):
    client.post("/demo/seed", json={})

    agents = client.get("/agents").json()
    demo_agent_ids = [a["id"] for a in agents if a["name"].startswith(DEMO_PREFIX)]

    for agent_id in demo_agent_ids:
        proposed = client.get(f"/agents/{agent_id}/proposed-memories").json()
        assert len(proposed) == 0, f"Agent {agent_id} has proposed memories, expected none"
