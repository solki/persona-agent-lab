from sqlalchemy import select

from app.models.agent import Agent
from app.models.learning import AgentFeedback, ProposedMemory
from app.models.memory import AgentMemory
from app.models.observatory import AgentExecution, AgentExecutionEvent, LearningEvent, TokenUsage
from app.models.run import TraceEvent
from app.models.workflow import Workflow
from app.runtime.runner_factory import create_runner
from app.runtime.workflow_runner import SequentialRunner
from app.services import observatory_service


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


def test_workflow_start_creates_run_and_queued_executions_before_completion(client, db_session):
    first_agent = create_agent(client, "Queued First", "Run after monitor opens.")
    second_agent = create_agent(client, "Queued Second", "Run second after monitor opens.")
    workflow = client.post(
        "/workflows",
        json={
            "name": "Monitor-first Workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [first_agent["id"], second_agent["id"]]},
        },
    ).json()

    started_run = create_runner(db_session, db_session.get(Workflow, workflow["id"])).start(
        db_session.get(Workflow, workflow["id"]), "Start with monitor."
    )

    assert started_run.status == "running"
    executions = observatory_service.list_executions_for_run(db_session, started_run.id)
    assert [execution.agent_id for execution in executions] == [first_agent["id"], second_agent["id"]]
    assert [execution.status for execution in executions] == ["queued", "queued"]
    monitor = observatory_service.monitor_for_run(db_session, started_run)
    assert monitor["active_agent_execution"].agent_id == first_agent["id"]

    completed_run = create_runner(db_session, db_session.get(Workflow, workflow["id"])).execute_run(started_run.id)
    assert completed_run.status == "completed"


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


def test_archive_run_without_learning_records_hides_from_default_list(client):
    agent = create_agent(client, "Archive Basic Agent", "Keep run records.")
    workflow = client.post(
        "/workflows",
        json={
            "name": "Archive Basic Workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [agent["id"]]},
        },
    ).json()
    run = client.post(f"/workflows/{workflow['id']}/run", json={"task": "Archive this run."}).json()

    archive_response = client.post(f"/runs/{run['id']}/archive")

    assert archive_response.status_code == 200
    assert archive_response.json()["status"] == "archived"
    assert archive_response.json()["archived"] is True
    assert "Learning records were preserved" in archive_response.json()["message"]
    assert client.get("/runs").json() == []
    archived_list = client.get("/runs?include_archived=true").json()
    assert [item["id"] for item in archived_list] == [run["id"]]
    archived_detail = client.get(f"/runs/{run['id']}").json()
    assert archived_detail["status"] == "archived"
    assert archived_detail["archived_at"] is not None

    activate_response = client.post(f"/runs/{run['id']}/activate")

    assert activate_response.status_code == 200
    assert activate_response.json()["status"] == "completed"
    assert activate_response.json()["archived"] is False
    assert activate_response.json()["archived_at"] is None
    assert "Learning records were preserved" in activate_response.json()["message"]
    assert [item["id"] for item in client.get("/runs").json()] == [run["id"]]
    activated_detail = client.get(f"/runs/{run['id']}").json()
    assert activated_detail["status"] == "completed"
    assert activated_detail["archived_at"] is None


def test_archive_then_activate_preserves_learning_records_and_configuration(client, db_session):
    agent = create_agent(client, "Cleanup Agent", "Keep configuration.")
    workflow = client.post(
        "/workflows",
        json={
            "name": "Cleanup Workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [agent["id"]]},
        },
    ).json()
    run = client.post(f"/workflows/{workflow['id']}/run", json={"task": "Create cleanup records."}).json()
    feedback = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/feedback",
        json={"feedback_text": "Remember cleanup evidence.", "feedback_type": "coaching"},
    ).json()
    proposal = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/reflect",
        json={"feedback_id": feedback["id"]},
    ).json()["proposed_memory"]
    approved = client.post(f"/agents/{agent['id']}/proposed-memories/{proposal['id']}/approve").json()
    active_memory_id = approved["agent_memory"]["id"]
    pending_feedback = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/feedback",
        json={"feedback_text": "Pending cleanup evidence.", "feedback_type": "coaching"},
    ).json()
    pending_proposal = client.post(
        f"/runs/{run['id']}/agents/{agent['id']}/reflect",
        json={"feedback_id": pending_feedback["id"]},
    ).json()["proposed_memory"]

    archive_response = client.delete(f"/runs/{run['id']}")

    assert archive_response.status_code == 200
    assert archive_response.json()["status"] == "archived"
    assert client.get(f"/runs/{run['id']}").json()["status"] == "archived"
    assert client.get("/runs").json() == []
    assert client.get(f"/workflows/{workflow['id']}").status_code == 200
    assert client.get(f"/agents/{agent['id']}").status_code == 200
    assert db_session.get(Agent, agent["id"]) is not None
    assert db_session.get(Workflow, workflow["id"]) is not None
    assert db_session.get(AgentMemory, active_memory_id) is not None
    assert db_session.scalars(select(TraceEvent).where(TraceEvent.run_id == run["id"])).all() != []
    assert db_session.scalars(select(AgentExecution).where(AgentExecution.run_id == run["id"])).all() != []
    assert db_session.scalars(select(AgentExecutionEvent).where(AgentExecutionEvent.run_id == run["id"])).all() != []
    assert db_session.scalars(select(TokenUsage).where(TokenUsage.run_id == run["id"])).all() != []
    assert db_session.scalars(select(AgentFeedback).where(AgentFeedback.run_id == run["id"])).all() != []
    assert db_session.scalars(select(LearningEvent).where(LearningEvent.run_id == run["id"])).all() != []
    approved_proposal = db_session.get(ProposedMemory, proposal["id"])
    assert approved_proposal is not None
    assert approved_proposal.source_feedback_id == feedback["id"]
    assert approved_proposal.source_evaluation_id is None
    pending = db_session.get(ProposedMemory, pending_proposal["id"])
    assert pending is not None
    assert pending.source_feedback_id == pending_feedback["id"]

    activate_response = client.post(f"/runs/{run['id']}/activate")

    assert activate_response.status_code == 200
    assert activate_response.json()["status"] == "completed"
    assert client.get(f"/runs/{run['id']}").json()["status"] == "completed"
    assert [item["id"] for item in client.get("/runs").json()] == [run["id"]]
    assert db_session.get(Agent, agent["id"]) is not None
    assert db_session.get(Workflow, workflow["id"]) is not None
    assert db_session.get(AgentMemory, active_memory_id) is not None
    assert db_session.scalars(select(TraceEvent).where(TraceEvent.run_id == run["id"])).all() != []
    assert db_session.scalars(select(AgentExecution).where(AgentExecution.run_id == run["id"])).all() != []
    assert db_session.scalars(select(AgentExecutionEvent).where(AgentExecutionEvent.run_id == run["id"])).all() != []
    assert db_session.scalars(select(TokenUsage).where(TokenUsage.run_id == run["id"])).all() != []
    assert db_session.scalars(select(AgentFeedback).where(AgentFeedback.run_id == run["id"])).all() != []
    assert db_session.scalars(select(LearningEvent).where(LearningEvent.run_id == run["id"])).all() != []
    assert db_session.get(ProposedMemory, proposal["id"]).source_feedback_id == feedback["id"]
    assert db_session.get(ProposedMemory, pending_proposal["id"]).source_feedback_id == pending_feedback["id"]

    archive_again_response = client.post(f"/runs/{run['id']}/archive")
    assert archive_again_response.status_code == 200
    blocked_delete = client.delete(f"/runs/{run['id']}/hard-delete")
    assert blocked_delete.status_code == 409
    assert "learning history" in blocked_delete.json()["detail"]
    assert client.get(f"/runs/{run['id']}").status_code == 200


def test_archive_missing_run_returns_404(client):
    response = client.post("/runs/9999/archive")

    assert response.status_code == 404
    assert client.post("/runs/9999/activate").status_code == 404
    assert client.delete("/runs/9999/hard-delete").status_code == 404
    assert client.delete("/runs/9999").status_code == 404


def test_hard_delete_archived_run_without_learning_removes_run_local_records(client, db_session):
    agent = create_agent(client, "Permanent Delete Agent", "Disposable run.")
    workflow = client.post(
        "/workflows",
        json={
            "name": "Permanent Delete Workflow",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [agent["id"]]},
        },
    ).json()
    run = client.post(f"/workflows/{workflow['id']}/run", json={"task": "Disposable run."}).json()
    assert client.post(f"/runs/{run['id']}/archive").status_code == 200

    delete_response = client.delete(f"/runs/{run['id']}/hard-delete")

    assert delete_response.status_code == 200
    assert delete_response.json()["deleted"] is True
    assert client.get(f"/runs/{run['id']}").status_code == 404
    assert client.get(f"/workflows/{workflow['id']}").status_code == 200
    assert client.get(f"/agents/{agent['id']}").status_code == 200
    assert db_session.scalars(select(TraceEvent).where(TraceEvent.run_id == run["id"])).all() == []
    assert db_session.scalars(select(AgentExecution).where(AgentExecution.run_id == run["id"])).all() == []
    assert db_session.scalars(select(AgentExecutionEvent).where(AgentExecutionEvent.run_id == run["id"])).all() == []
    assert db_session.scalars(select(TokenUsage).where(TokenUsage.run_id == run["id"])).all() == []


def test_workflow_delete_is_blocked_while_runs_exist(client):
    agent = create_agent(client, "Workflow Delete Agent", "Create workflow history.")
    workflow = client.post(
        "/workflows",
        json={
            "name": "Workflow With History",
            "workflow_type": "sequential",
            "graph_config": {"agent_sequence": [agent["id"]]},
        },
    ).json()
    run_response = client.post(f"/workflows/{workflow['id']}/run", json={"task": "Create history."})
    assert run_response.status_code == 201

    delete_response = client.delete(f"/workflows/{workflow['id']}")

    assert delete_response.status_code == 409
    assert "Deactivate this workflow" in delete_response.json()["detail"]
    assert client.get(f"/workflows/{workflow['id']}").status_code == 200
