from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.learning import AgentEvaluation, AgentFeedback, ProposedMemory
from app.models.memory import AgentMemory
from app.models.observatory import AgentExecution, AgentExecutionEvent, LearningEvent, TokenUsage
from app.models.run import Run


def create_execution(
    db: Session,
    run_id: int,
    agent: Agent,
    sequence_index: int,
    input_payload: dict[str, Any],
    provider: Optional[str] = None,
) -> AgentExecution:
    execution = AgentExecution(
        run_id=run_id,
        agent_id=agent.id,
        agent_name_snapshot=agent.name,
        status="queued",
        sequence_index=sequence_index,
        input_payload=input_payload,
        provider=provider or agent.llm_provider,
        model=agent.model,
        temperature=agent.temperature,
        config_snapshot=_agent_config_snapshot(agent),
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    create_execution_event(db, execution, "agent_queued", {"sequence_index": sequence_index})
    return execution


def start_execution(db: Session, execution: AgentExecution) -> AgentExecution:
    execution.status = "running"
    execution.started_at = datetime.utcnow()
    db.commit()
    db.refresh(execution)
    create_execution_event(db, execution, "agent_started", {"started_at": execution.started_at.isoformat()})
    return execution


def complete_execution(db: Session, execution: AgentExecution, output_payload: dict[str, Any]) -> AgentExecution:
    execution.status = "completed"
    execution.output_payload = output_payload
    execution.ended_at = datetime.utcnow()
    execution.elapsed_ms = _elapsed_ms(execution.started_at, execution.ended_at)
    db.commit()
    db.refresh(execution)
    create_execution_event(db, execution, "agent_completed", {"elapsed_ms": execution.elapsed_ms})
    return execution


def fail_execution(db: Session, execution: AgentExecution, error_message: str) -> AgentExecution:
    execution.status = "failed"
    execution.error_message = error_message
    execution.ended_at = datetime.utcnow()
    execution.elapsed_ms = _elapsed_ms(execution.started_at, execution.ended_at)
    db.commit()
    db.refresh(execution)
    create_execution_event(db, execution, "agent_failed", {"error_message": error_message})
    return execution


def create_execution_event(
    db: Session,
    execution: AgentExecution,
    event_type: str,
    payload: dict[str, Any],
) -> AgentExecutionEvent:
    return create_execution_event_for_ids(db, execution.id, execution.run_id, execution.agent_id, event_type, payload)


def create_execution_event_for_ids(
    db: Session,
    execution_id: int,
    run_id: int,
    agent_id: int,
    event_type: str,
    payload: dict[str, Any],
) -> AgentExecutionEvent:
    event = AgentExecutionEvent(
        execution_id=execution_id,
        run_id=run_id,
        agent_id=agent_id,
        event_type=event_type,
        payload=payload,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def record_token_usage(
    db: Session,
    execution: AgentExecution,
    prompt: str,
    completion: str,
    provider_metadata: dict[str, Any],
) -> TokenUsage:
    raw_usage = _raw_usage(provider_metadata)
    prompt_tokens = int(raw_usage.get("prompt_tokens") or _estimate_tokens(prompt))
    completion_tokens = int(raw_usage.get("completion_tokens") or _estimate_tokens(completion))
    total_tokens = int(raw_usage.get("total_tokens") or prompt_tokens + completion_tokens)
    estimated = not {"prompt_tokens", "completion_tokens", "total_tokens"}.issubset(raw_usage.keys())
    raw_payload = {**raw_usage, "estimated": estimated}
    usage = TokenUsage(
        run_id=execution.run_id,
        execution_id=execution.id,
        agent_id=execution.agent_id,
        provider=provider_metadata.get("provider", execution.provider),
        model=execution.model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        estimated_cost=0.0,
        raw_usage=raw_payload,
    )
    db.add(usage)
    db.commit()
    db.refresh(usage)
    return usage


def create_learning_event(
    db: Session,
    agent_id: int,
    event_type: str,
    source_type: Optional[str] = None,
    source_id: Optional[int] = None,
    content: Optional[str] = None,
    status: Optional[str] = None,
    run_id: Optional[int] = None,
) -> LearningEvent:
    event = LearningEvent(
        run_id=run_id,
        agent_id=agent_id,
        event_type=event_type,
        source_type=source_type,
        source_id=source_id,
        content=content,
        status=status,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_executions_for_run(db: Session, run_id: int) -> list[AgentExecution]:
    statement = select(AgentExecution).where(AgentExecution.run_id == run_id).order_by(AgentExecution.sequence_index, AgentExecution.id)
    return list(db.scalars(statement).all())


def get_execution_for_run(db: Session, run_id: int, execution_id: int) -> Optional[AgentExecution]:
    statement = select(AgentExecution).where(AgentExecution.run_id == run_id, AgentExecution.id == execution_id)
    return db.scalars(statement).first()


def list_execution_events(db: Session, run_id: int, execution_id: int) -> list[AgentExecutionEvent]:
    statement = (
        select(AgentExecutionEvent)
        .where(AgentExecutionEvent.run_id == run_id, AgentExecutionEvent.execution_id == execution_id)
        .order_by(AgentExecutionEvent.id)
    )
    return list(db.scalars(statement).all())


def latest_events_for_run(db: Session, run_id: int, limit: int = 50) -> list[AgentExecutionEvent]:
    statement = (
        select(AgentExecutionEvent)
        .where(AgentExecutionEvent.run_id == run_id)
        .order_by(AgentExecutionEvent.id.desc())
        .limit(limit)
    )
    return list(reversed(list(db.scalars(statement).all())))


def token_usage_for_run(db: Session, run_id: int) -> list[TokenUsage]:
    statement = select(TokenUsage).where(TokenUsage.run_id == run_id).order_by(TokenUsage.id)
    return list(db.scalars(statement).all())


def token_usage_for_execution(db: Session, execution_id: int) -> Optional[TokenUsage]:
    statement = select(TokenUsage).where(TokenUsage.execution_id == execution_id)
    return db.scalars(statement).first()


def token_usage_summary(db: Session, run_id: int) -> dict[str, Any]:
    items = token_usage_for_run(db, run_id)
    by_agent: dict[int, dict[str, Any]] = {}
    for item in items:
        agent_summary = by_agent.setdefault(
            item.agent_id,
            {"agent_id": item.agent_id, "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "estimated_cost": 0.0},
        )
        agent_summary["prompt_tokens"] += item.prompt_tokens
        agent_summary["completion_tokens"] += item.completion_tokens
        agent_summary["total_tokens"] += item.total_tokens
        agent_summary["estimated_cost"] += item.estimated_cost
    return {
        "run_id": run_id,
        "total_prompt_tokens": sum(item.prompt_tokens for item in items),
        "total_completion_tokens": sum(item.completion_tokens for item in items),
        "total_tokens": sum(item.total_tokens for item in items),
        "estimated_cost": sum(item.estimated_cost for item in items),
        "by_agent": list(by_agent.values()),
        "items": items,
    }


def monitor_for_run(db: Session, run: Run) -> dict[str, Any]:
    executions = list_executions_for_run(db, run.id)
    active = next((execution for execution in executions if execution.status in {"queued", "running"}), None)
    latest_events = latest_events_for_run(db, run.id)
    errors = [
        {"execution_id": execution.id, "agent_id": execution.agent_id, "error_message": execution.error_message}
        for execution in executions
        if execution.error_message
    ]
    return {
        "run_id": run.id,
        "run_status": run.status,
        "active_workflow_step": active.sequence_index if active else None,
        "active_agent_execution": active,
        "agent_executions": executions,
        "latest_events": latest_events,
        "current_event_stream": latest_events,
        "started_at": run.started_at,
        "elapsed_ms": _elapsed_ms(run.started_at, run.ended_at or datetime.utcnow()) if run.started_at else None,
        "token_usage_summary": token_usage_summary(db, run.id),
        "learning_event_summary": learning_event_summary_for_run(db, run.id),
        "errors": errors,
    }


def execution_detail(db: Session, execution: AgentExecution) -> dict[str, Any]:
    events = list_execution_events(db, execution.run_id, execution.id)
    return {
        "execution": execution,
        "events": events,
        "token_usage": token_usage_for_execution(db, execution.id),
        "assembled_context": _last_payload(events, "context_assembled"),
        "retrieved_memory": _last_payload(events, "memory_retrieved"),
        "tool_calls": [event for event in events if event.event_type.startswith("tool_call_")],
        "learning_events": learning_events_for_agent(db, execution.agent_id, execution.run_id),
    }


def learning_event_summary_for_run(db: Session, run_id: int) -> dict[str, Any]:
    feedback_count = len(db.scalars(select(AgentFeedback).where(AgentFeedback.run_id == run_id)).all())
    evaluation_count = len(db.scalars(select(AgentEvaluation).where(AgentEvaluation.run_id == run_id)).all())
    learning_events = learning_events_for_run(db, run_id)
    return {
        "feedback_count": feedback_count,
        "evaluation_count": evaluation_count,
        "proposed_memory_count": len([event for event in learning_events if event.event_type == "proposed_memory_created"]),
        "learning_event_count": len(learning_events),
    }


def learning_events_for_run(db: Session, run_id: int) -> list[LearningEvent]:
    statement = select(LearningEvent).where(LearningEvent.run_id == run_id).order_by(LearningEvent.id)
    return list(db.scalars(statement).all())


def learning_events_for_agent(db: Session, agent_id: int, run_id: Optional[int] = None) -> list[LearningEvent]:
    statement = select(LearningEvent).where(LearningEvent.agent_id == agent_id)
    if run_id is not None:
        statement = statement.where(LearningEvent.run_id == run_id)
    return list(db.scalars(statement.order_by(LearningEvent.id)).all())


def evolution_for_agent(db: Session, agent_id: int) -> dict[str, Any]:
    return {
        "agent_id": agent_id,
        "memories": [_model_dict(item) for item in db.scalars(select(AgentMemory).where(AgentMemory.agent_id == agent_id).order_by(AgentMemory.id)).all()],
        "feedback": [_model_dict(item) for item in db.scalars(select(AgentFeedback).where(AgentFeedback.agent_id == agent_id).order_by(AgentFeedback.id)).all()],
        "evaluations": [_model_dict(item) for item in db.scalars(select(AgentEvaluation).where(AgentEvaluation.agent_id == agent_id).order_by(AgentEvaluation.id)).all()],
        "proposed_memories": [_model_dict(item) for item in db.scalars(select(ProposedMemory).where(ProposedMemory.agent_id == agent_id).order_by(ProposedMemory.id)).all()],
        "learning_events": learning_events_for_agent(db, agent_id),
        "executions": executions_for_agent(db, agent_id),
        "token_usage": token_usage_for_agent(db, agent_id),
    }


def performance_summary_for_agent(db: Session, agent_id: int) -> dict[str, Any]:
    executions = executions_for_agent(db, agent_id)
    usage = token_usage_for_agent(db, agent_id)
    elapsed_values = [execution.elapsed_ms for execution in executions if execution.elapsed_ms is not None]
    return {
        "agent_id": agent_id,
        "execution_count": len(executions),
        "completed_count": len([execution for execution in executions if execution.status == "completed"]),
        "failed_count": len([execution for execution in executions if execution.status == "failed"]),
        "average_elapsed_ms": (sum(elapsed_values) / len(elapsed_values)) if elapsed_values else None,
        "total_tokens": sum(item.total_tokens for item in usage),
        "estimated_cost": sum(item.estimated_cost for item in usage),
    }


def executions_for_agent(db: Session, agent_id: int) -> list[AgentExecution]:
    statement = select(AgentExecution).where(AgentExecution.agent_id == agent_id).order_by(AgentExecution.id)
    return list(db.scalars(statement).all())


def token_usage_for_agent(db: Session, agent_id: int) -> list[TokenUsage]:
    statement = select(TokenUsage).where(TokenUsage.agent_id == agent_id).order_by(TokenUsage.id)
    return list(db.scalars(statement).all())


def _agent_config_snapshot(agent: Agent) -> dict[str, Any]:
    return {
        "agent_id": agent.id,
        "agent_name": agent.name,
        "role": agent.role,
        "llm_provider": agent.llm_provider,
        "model": agent.model,
        "temperature": agent.temperature,
        "max_tokens": agent.max_tokens,
        "memory_policy": agent.memory_policy,
        "context_policy": agent.context_policy,
        "handoff_policy": agent.handoff_policy,
    }


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _raw_usage(provider_metadata: dict[str, Any]) -> dict[str, Any]:
    usage = provider_metadata.get("usage")
    return usage if isinstance(usage, dict) else {}


def _elapsed_ms(started_at: Optional[datetime], ended_at: Optional[datetime]) -> Optional[int]:
    if started_at is None or ended_at is None:
        return None
    return int((ended_at - started_at).total_seconds() * 1000)


def _last_payload(events: list[AgentExecutionEvent], event_type: str) -> Optional[dict[str, Any]]:
    for event in reversed(events):
        if event.event_type == event_type:
            return event.payload
    return None


def _model_dict(item: Any) -> dict[str, Any]:
    return {column.name: getattr(item, column.name) for column in item.__table__.columns}
