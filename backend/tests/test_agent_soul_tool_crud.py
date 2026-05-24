def test_soul_crud(client):
    create_response = client.post(
        "/souls",
        json={
            "name": "Persistent Problem Solver",
            "description": "Works through problems carefully.",
            "principles": "Stay focused and verify assumptions.",
            "decision_style": "Evidence-based",
            "collaboration_style": "Direct and calm",
            "failure_handling_style": "Recover with a smaller step",
            "escalation_style": "Escalate blocked dependencies",
        },
    )

    assert create_response.status_code == 201
    soul = create_response.json()
    assert soul["id"] == 1
    assert soul["name"] == "Persistent Problem Solver"

    list_response = client.get("/souls")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [soul["id"]]

    update_response = client.put(
        f"/souls/{soul['id']}",
        json={"name": "Persistent Solver", "decision_style": "Stepwise"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Persistent Solver"
    assert update_response.json()["decision_style"] == "Stepwise"

    get_response = client.get(f"/souls/{soul['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Persistent Solver"

    delete_response = client.delete(f"/souls/{soul['id']}")
    assert delete_response.status_code == 204
    assert client.get(f"/souls/{soul['id']}").status_code == 404


def test_agent_crud_preserves_isolated_defaults(client):
    create_response = client.post(
        "/agents",
        json={
            "name": "Persistent Troubleshooter",
            "description": "Solves hard technical problems.",
            "role": "troubleshooter",
            "system_prompt": "Investigate the task carefully.",
        },
    )

    assert create_response.status_code == 201
    agent = create_response.json()
    assert agent["llm_provider"] == "mock"
    assert agent["model"] == "mock-deterministic"
    assert agent["memory_policy"]["write_mode"] == "manual_review"
    assert agent["context_policy"]["include_active_context"] is True
    assert agent["handoff_policy"]["allow_handoff"] is False
    assert agent["handoff_policy"]["allowed_agent_ids"] == []

    update_response = client.put(
        f"/agents/{agent['id']}",
        json={
            "name": "Persistent Troubleshooter",
            "role": "debugger",
            "temperature": 0.1,
            "system_prompt": "Debug with clear evidence.",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["role"] == "debugger"
    assert update_response.json()["temperature"] == 0.1

    list_response = client.get("/agents")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [agent["id"]]

    delete_response = client.delete(f"/agents/{agent['id']}")
    assert delete_response.status_code == 204
    assert client.get(f"/agents/{agent['id']}").status_code == 404


def test_tool_crud_and_agent_assignment(client):
    agent = client.post(
        "/agents",
        json={
            "name": "Tool Operator",
            "role": "operator",
            "system_prompt": "Use only assigned tools.",
        },
    ).json()
    tool = client.post(
        "/tools",
        json={
            "name": "tavily_search",
            "description": "Search through the Tool Gateway.",
            "tool_type": "search",
            "config": {"requires_api_key": True},
        },
    ).json()

    assign_response = client.post(f"/agents/{agent['id']}/tools/{tool['id']}")
    assert assign_response.status_code == 204

    agent_tools_response = client.get(f"/agents/{agent['id']}/tools")
    assert agent_tools_response.status_code == 200
    assert agent_tools_response.json()[0]["name"] == "tavily_search"

    remove_response = client.delete(f"/agents/{agent['id']}/tools/{tool['id']}")
    assert remove_response.status_code == 204
    assert client.get(f"/agents/{agent['id']}/tools").json() == []

    update_response = client.put(
        f"/tools/{tool['id']}",
        json={"name": "tavily_search", "tool_type": "search", "is_active": False},
    )
    assert update_response.status_code == 200
    assert update_response.json()["is_active"] is False

    delete_response = client.delete(f"/tools/{tool['id']}")
    assert delete_response.status_code == 204
    assert client.get(f"/tools/{tool['id']}").status_code == 404
