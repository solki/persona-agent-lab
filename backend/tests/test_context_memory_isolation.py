def create_agent(client, name):
    response = client.post(
        "/agents",
        json={
            "name": name,
            "role": "worker",
            "system_prompt": "Work only with your own context and memory.",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_context_crud_is_scoped_by_agent_id(client):
    first_agent = create_agent(client, "First Agent")
    second_agent = create_agent(client, "Second Agent")

    first_context = client.post(
        f"/agents/{first_agent['id']}/contexts",
        json={
            "title": "First private context",
            "context_type": "note",
            "content": "Only first agent may see this.",
            "priority": 10,
        },
    ).json()
    second_context = client.post(
        f"/agents/{second_agent['id']}/contexts",
        json={
            "title": "Second private context",
            "context_type": "note",
            "content": "Only second agent may see this.",
            "priority": 10,
        },
    ).json()

    first_list = client.get(f"/agents/{first_agent['id']}/contexts").json()
    assert [item["id"] for item in first_list] == [first_context["id"]]
    assert first_list[0]["content"] == "Only first agent may see this."

    wrong_update = client.put(
        f"/agents/{first_agent['id']}/contexts/{second_context['id']}",
        json={"title": "Leak attempt", "context_type": "note", "content": "Nope"},
    )
    assert wrong_update.status_code == 404

    wrong_delete = client.delete(f"/agents/{first_agent['id']}/contexts/{second_context['id']}")
    assert wrong_delete.status_code == 404
    assert client.get(f"/agents/{second_agent['id']}/contexts").json()[0]["id"] == second_context["id"]


def test_memory_crud_is_scoped_by_agent_id_and_supports_review(client):
    first_agent = create_agent(client, "Memory Owner")
    second_agent = create_agent(client, "Other Agent")

    first_memory = client.post(
        f"/agents/{first_agent['id']}/memories",
        json={
            "memory_type": "lesson",
            "content": "First agent private memory.",
            "source": "manual",
            "importance": 80,
        },
    ).json()
    second_memory = client.post(
        f"/agents/{second_agent['id']}/memories",
        json={
            "memory_type": "lesson",
            "content": "Second agent private memory.",
            "source": "manual",
            "importance": 80,
        },
    ).json()

    assert first_memory["status"] == "pending"
    first_list = client.get(f"/agents/{first_agent['id']}/memories").json()
    assert [item["id"] for item in first_list] == [first_memory["id"]]
    assert first_list[0]["content"] == "First agent private memory."

    wrong_update = client.put(
        f"/agents/{first_agent['id']}/memories/{second_memory['id']}",
        json={"memory_type": "lesson", "content": "Leak attempt", "importance": 20},
    )
    assert wrong_update.status_code == 404

    approve_response = client.post(f"/agents/{first_agent['id']}/memories/{first_memory['id']}/approve")
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "active"

    reject_response = client.post(f"/agents/{second_agent['id']}/memories/{second_memory['id']}/reject")
    assert reject_response.status_code == 200
    assert reject_response.json()["status"] == "rejected"

    wrong_delete = client.delete(f"/agents/{first_agent['id']}/memories/{second_memory['id']}")
    assert wrong_delete.status_code == 404
    assert client.get(f"/agents/{second_agent['id']}/memories").json()[0]["id"] == second_memory["id"]
