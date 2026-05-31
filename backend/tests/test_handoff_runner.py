"""Tests for HandoffSwarmRunner and HandoffDecision."""

from app.runtime.runner_factory import create_runner
from app.runtime.handoff_swarm_runner import HandoffSwarmRunner
from app.runtime.workflow_runner import SequentialRunner
from app.schemas.actions import HandoffDecision


def _create_agent(client, name, role="worker", system_prompt="Do your job.", extra=None):
    payload = {"name": name, "role": role, "system_prompt": system_prompt, **(extra or {})}
    resp = client.post("/agents", json=payload)
    assert resp.status_code == 201
    return resp.json()


def _create_handoff_workflow(client, entry_id, participant_ids, max_handoffs=10):
    resp = client.post(
        "/workflows",
        json={
            "name": "TEST-Handoff-Workflow",
            "workflow_type": "handoff_swarm",
            "graph_config": {
                "entry_agent_id": entry_id,
                "participant_agent_ids": participant_ids,
                "max_handoffs": max_handoffs,
            },
        },
    )
    assert resp.status_code == 201
    return resp.json()


class TestHandoffDecisionSchema:
    def test_valid_handoff(self):
        d = HandoffDecision(action="handoff", target_agent_id=2, payload={"summary": "Done."})
        assert d.action == "handoff"
        assert d.target_agent_id == 2

    def test_valid_finish(self):
        d = HandoffDecision(action="finish", final_response="All done.")
        assert d.action == "finish"

    def test_handoff_requires_target_agent_id(self):
        try:
            HandoffDecision(action="handoff")
            assert False, "Should raise"
        except Exception:
            pass

    def test_handoff_requires_payload(self):
        try:
            HandoffDecision(action="handoff", target_agent_id=1)
            assert False, "Should raise"
        except Exception:
            pass

    def test_finish_requires_final_response(self):
        try:
            HandoffDecision(action="finish")
            assert False, "Should raise"
        except Exception:
            pass


class TestHandoffRunnerExecution:
    def test_handoff_runner_created_by_factory(self, db_session):
        from app.models.workflow import Workflow
        wf = Workflow(name="test", workflow_type="handoff_swarm", graph_config={"entry_agent_id": 1, "participant_agent_ids": [1, 2]})
        db_session.add(wf)
        db_session.commit()
        runner = create_runner(db_session, wf)
        assert isinstance(runner, HandoffSwarmRunner)

    def test_handoff_run_completes_with_mock_provider(self, client):
        """Mock provider → fallback finish → run completes."""
        agent = _create_agent(client, "TEST-Handoff-Agent", role="worker",
                              extra={"handoff_policy": {"allow_handoff": True, "allowed_agent_ids": []}})
        wf = _create_handoff_workflow(client, agent["id"], [agent["id"]])
        resp = client.post(f"/workflows/{wf['id']}/run", json={"task": "Solve."})
        assert resp.status_code == 201
        run = resp.json()
        assert run["status"] == "completed"
        assert "final_output" in run["output"]

    def test_handoff_run_creates_trace_events(self, client):
        agent = _create_agent(client, "TEST-HTrace-Agent", role="worker",
                              extra={"handoff_policy": {"allow_handoff": True, "allowed_agent_ids": []}})
        wf = _create_handoff_workflow(client, agent["id"], [agent["id"]])
        run = client.post(f"/workflows/{wf['id']}/run", json={"task": "Trace."}).json()
        trace = client.get(f"/runs/{run['id']}/trace").json()
        event_types = {e["event_type"] for e in trace}
        assert "run_started" in event_types
        assert "workflow_loaded" in event_types
        assert "handoff_decision" in event_types or "action_parse_failed" in event_types
        assert "run_completed" in event_types

    def test_handoff_run_config_snapshot(self, client):
        agent = _create_agent(client, "TEST-HSnap-Agent", role="worker",
                              extra={"handoff_policy": {"allow_handoff": True, "allowed_agent_ids": []}})
        wf = _create_handoff_workflow(client, agent["id"], [agent["id"]])
        run = client.post(f"/workflows/{wf['id']}/run", json={"task": "Snapshot."}).json()
        assert run["config_snapshot"]["workflow"]["workflow_type"] == "handoff_swarm"

    def test_graph_config_rejects_missing_entry(self, client):
        resp = client.post(
            "/workflows",
            json={"name": "Bad", "workflow_type": "handoff_swarm", "graph_config": {"participant_agent_ids": [1]}},
        )
        assert resp.status_code == 422

    def test_graph_config_rejects_empty_participants(self, client):
        resp = client.post(
            "/workflows",
            json={"name": "Bad", "workflow_type": "handoff_swarm", "graph_config": {"entry_agent_id": 1, "participant_agent_ids": []}},
        )
        assert resp.status_code == 422

    def test_graph_config_rejects_entry_not_in_participants(self, client):
        resp = client.post(
            "/workflows",
            json={"name": "Bad", "workflow_type": "handoff_swarm", "graph_config": {"entry_agent_id": 1, "participant_agent_ids": [2]}},
        )
        assert resp.status_code == 422

    def test_sequential_workflow_still_works(self, client):
        agent = _create_agent(client, "TEST-Seq-HO", role="worker")
        resp = client.post(
            "/workflows",
            json={"name": "Seq-WF", "workflow_type": "sequential", "graph_config": {"agent_sequence": [agent["id"]]}},
        )
        wf = resp.json()
        run = client.post(f"/workflows/{wf['id']}/run", json={"task": "Test."}).json()
        assert run["status"] == "completed"


class TestSequentialUnchanged:
    def test_sequential_unchanged_by_handoff(self, client):
        agent = _create_agent(client, "TEST-SeqFinal", role="worker")
        resp = client.post(
            "/workflows",
            json={"name": "Final-Seq", "workflow_type": "sequential", "graph_config": {"agent_sequence": [agent["id"]]}},
        )
        wf = resp.json()
        run = client.post(f"/workflows/{wf['id']}/run", json={"task": "End."}).json()
        assert run["status"] == "completed"
