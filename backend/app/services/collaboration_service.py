"""Build collaboration graph from trace events and execution records.

Derives supervisor delegation trees and handoff chains from existing
trace event data without requiring new persistent graph tables.
"""

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.observatory import AgentExecution
from app.models.run import Run as RunModel, TraceEvent
from app.services import observatory_service, trace_service


def build_collaboration_graph(db: Session, run_id: int) -> dict[str, Any]:
    """Build a collaboration graph for a run from trace events and executions.

    For sequential runs, returns a minimal graph with nodes only.
    For supervisor runs, returns nodes + delegation/response edges.
    """
    run = db.get(RunModel, run_id)
    if run is None:
        raise ValueError("Run not found.")

    trace_events = trace_service.list_trace_events(db, run_id)
    executions = observatory_service.list_executions_for_run(db, run_id)

    workflow_type = run.config_snapshot.get("workflow", {}).get("workflow_type", "sequential")

    nodes = _build_nodes(executions)
    edges = _build_edges(trace_events, executions)

    return {
        "run_id": run_id,
        "workflow_type": workflow_type,
        "nodes": nodes,
        "edges": edges,
        "chain_summary": _build_chain_summary(workflow_type, trace_events, nodes, edges),
    }


def _build_nodes(executions: list[AgentExecution]) -> list[dict[str, Any]]:
    # Deduplicate by agent_id — one node per unique agent
    seen: set[int] = set()
    nodes: list[dict[str, Any]] = []
    for ex in executions:
        if ex.agent_id in seen:
            continue
        seen.add(ex.agent_id)
        agent_execs = [e for e in executions if e.agent_id == ex.agent_id]
        statuses = [e.status for e in agent_execs]
        nodes.append({
            "agent_id": ex.agent_id,
            "agent_name": ex.agent_name_snapshot,
            "role": _role_from_snapshot(agent_execs),
            "execution_count": len(agent_execs),
            "execution_ids": [e.id for e in agent_execs],
            "status_summary": {
                "completed": statuses.count("completed"),
                "failed": statuses.count("failed"),
                "running": statuses.count("running"),
                "queued": statuses.count("queued"),
            },
        })
    return nodes


def _build_edges(trace_events: list[TraceEvent], executions: list[AgentExecution]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    exec_by_agent: dict[int, list[AgentExecution]] = {}
    for ex in executions:
        exec_by_agent.setdefault(ex.agent_id, []).append(ex)

    for i, event in enumerate(trace_events):
        payload = event.payload or {}

        if event.event_type == "supervisor_delegated":
            from_id = payload.get("from_agent_id")
            to_id = payload.get("to_agent_id")
            if from_id and to_id:
                edges.append({
                    "from_agent_id": from_id,
                    "to_agent_id": to_id,
                    "type": "delegation",
                    "iteration": payload.get("iteration"),
                    "instruction": payload.get("instruction", "")[:200],
                    "full_instruction": payload.get("instruction", ""),
                    "source_trace_event_id": event.id,
                })

        elif event.event_type == "worker_responded":
            from_id = payload.get("from_agent_id")
            to_id = payload.get("to_agent_id")
            if from_id and to_id:
                # Find the corresponding worker execution for elapsed_ms
                elapsed_ms = None
                worker_execs = exec_by_agent.get(from_id, [])
                if worker_execs:
                    completed_execs = [e for e in worker_execs if e.status == "completed"]
                    if completed_execs:
                        elapsed_ms = completed_execs[-1].elapsed_ms

                edges.append({
                    "from_agent_id": from_id,
                    "to_agent_id": to_id,
                    "type": "response",
                    "iteration": payload.get("iteration"),
                    "content_preview": (payload.get("content_preview") or "")[:200],
                    "full_content": payload.get("content_preview", ""),
                    "elapsed_ms": elapsed_ms,
                    "source_trace_event_id": event.id,
                })

    return edges


def _build_chain_summary(
    workflow_type: str,
    trace_events: list[TraceEvent],
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> dict[str, Any]:
    supervisor_events = [e for e in trace_events if e.event_type == "supervisor_decision"]
    delegation_edges = [e for e in edges if e["type"] == "delegation"]

    last_decision = None
    if supervisor_events:
        last_payload = supervisor_events[-1].payload or {}
        last_decision = last_payload.get("decision", {}).get("action")

    supervisor_node = None
    for node in nodes:
        exec_count = node.get("execution_count", 0)
        if exec_count > 0 and workflow_type == "supervisor":
            if supervisor_node is None or node["agent_id"] == _find_supervisor_id(trace_events):
                supervisor_node = node

    return {
        "supervisor_agent_id": supervisor_node["agent_id"] if supervisor_node else None,
        "supervisor_agent_name": supervisor_node["agent_name"] if supervisor_node else None,
        "supervisor_iterations": len(supervisor_events),
        "worker_count": len(nodes) - 1 if supervisor_node else 0,
        "delegation_count": len(delegation_edges),
        "final_decision": last_decision,
        "status": "completed" if last_decision == "finish" else "in_progress",
    }


def _find_supervisor_id(trace_events: list[TraceEvent]) -> Optional[int]:
    for event in trace_events:
        if event.event_type == "workflow_loaded":
            sid = (event.payload or {}).get("supervisor_agent_id")
            if sid is not None:
                return sid
    return None


def _role_from_snapshot(executions: list[AgentExecution]) -> str:
    for ex in executions:
        snap = ex.config_snapshot or {}
        role = snap.get("role")
        if role:
            return role
    return "unknown"
