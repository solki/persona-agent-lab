from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.learning import AgentEvaluation, AgentFeedback, ProposedMemory
from app.models.memory import AgentMemory
from app.models.run import Run, TraceEvent
from app.schemas.learning import (
    AgentEvaluationCreate,
    AgentFeedbackCreate,
    ProposedMemoryCreate,
    ReflectionRequest,
)
from app.services.trace_service import create_trace_event
from app.services.observatory_service import create_learning_event


def list_feedback_for_agent(db: Session, agent_id: int) -> list[AgentFeedback]:
    statement = select(AgentFeedback).where(AgentFeedback.agent_id == agent_id).order_by(AgentFeedback.id)
    return list(db.scalars(statement).all())


def create_feedback(db: Session, run: Run, agent: Agent, payload: AgentFeedbackCreate) -> AgentFeedback:
    _validate_agent_participated(db, run, agent.id)
    _validate_trace_event(db, run.id, agent.id, payload.trace_event_id)
    feedback = AgentFeedback(run_id=run.id, agent_id=agent.id, **payload.model_dump())
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    create_trace_event(
        db,
        run.id,
        "learning_feedback_received",
        {"feedback_id": feedback.id, "feedback_type": feedback.feedback_type, "rating": feedback.rating},
        agent.id,
    )
    create_learning_event(
        db,
        agent.id,
        "feedback_added",
        source_type="feedback",
        source_id=feedback.id,
        content=feedback.feedback_text,
        status="created",
        run_id=run.id,
    )
    return feedback


def create_evaluation(db: Session, run: Run, agent: Agent, payload: AgentEvaluationCreate) -> AgentEvaluation:
    _validate_agent_participated(db, run, agent.id)
    evaluation = AgentEvaluation(run_id=run.id, agent_id=agent.id, **payload.model_dump())
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    create_trace_event(
        db,
        run.id,
        "learning_evaluation_recorded",
        {"evaluation_id": evaluation.id, "evaluator_type": evaluation.evaluator_type, "scores": evaluation.scores},
        agent.id,
    )
    create_learning_event(
        db,
        agent.id,
        "evaluation_created",
        source_type="evaluation",
        source_id=evaluation.id,
        content=str(evaluation.recommendations),
        status="created",
        run_id=run.id,
    )
    return evaluation


def list_evaluations_for_run(db: Session, run_id: int) -> list[AgentEvaluation]:
    statement = select(AgentEvaluation).where(AgentEvaluation.run_id == run_id).order_by(AgentEvaluation.id)
    return list(db.scalars(statement).all())


def list_proposed_memories_for_agent(db: Session, agent_id: int) -> list[ProposedMemory]:
    statement = select(ProposedMemory).where(ProposedMemory.agent_id == agent_id).order_by(ProposedMemory.id)
    return list(db.scalars(statement).all())


def get_proposed_memory_for_agent(db: Session, agent_id: int, memory_id: int) -> Optional[ProposedMemory]:
    statement = select(ProposedMemory).where(ProposedMemory.agent_id == agent_id, ProposedMemory.id == memory_id)
    return db.scalars(statement).first()


def create_proposed_memory(db: Session, agent: Agent, payload: ProposedMemoryCreate) -> ProposedMemory:
    _validate_proposed_sources(db, agent.id, payload.source_feedback_id, payload.source_evaluation_id)
    proposed_memory = ProposedMemory(agent_id=agent.id, status="pending", **payload.model_dump())
    db.add(proposed_memory)
    db.commit()
    db.refresh(proposed_memory)
    _trace_proposed_memory(db, proposed_memory, "memory_proposed")
    run_id = _source_run_id(db, proposed_memory)
    create_learning_event(
        db,
        agent.id,
        "proposed_memory_created",
        source_type="proposed_memory",
        source_id=proposed_memory.id,
        content=proposed_memory.content,
        status=proposed_memory.status,
        run_id=run_id,
    )
    return proposed_memory


def approve_proposed_memory(db: Session, proposed_memory: ProposedMemory) -> tuple[ProposedMemory, AgentMemory]:
    if proposed_memory.status == "rejected":
        raise ValueError("Rejected proposed memories cannot be approved.")
    if proposed_memory.status == "approved":
        existing = _agent_memory_for_proposed_memory(db, proposed_memory.id)
        if existing is not None:
            return proposed_memory, existing
    proposed_memory.status = "approved"
    proposed_memory.approved_at = datetime.utcnow()
    agent_memory = AgentMemory(
        agent_id=proposed_memory.agent_id,
        memory_type=proposed_memory.memory_type,
        content=proposed_memory.content,
        source=f"proposed_memory:{proposed_memory.id}",
        importance=proposed_memory.importance,
        status="active",
    )
    db.add(agent_memory)
    db.commit()
    db.refresh(proposed_memory)
    db.refresh(agent_memory)
    _trace_proposed_memory(db, proposed_memory, "proposed_memory_approved", {"agent_memory_id": agent_memory.id})
    run_id = _source_run_id(db, proposed_memory)
    create_learning_event(
        db,
        proposed_memory.agent_id,
        "memory_approved",
        source_type="proposed_memory",
        source_id=proposed_memory.id,
        content=proposed_memory.content,
        status=proposed_memory.status,
        run_id=run_id,
    )
    create_learning_event(
        db,
        proposed_memory.agent_id,
        "memory_activated",
        source_type="agent_memory",
        source_id=agent_memory.id,
        content=agent_memory.content,
        status=agent_memory.status,
        run_id=run_id,
    )
    return proposed_memory, agent_memory


def reject_proposed_memory(db: Session, proposed_memory: ProposedMemory) -> ProposedMemory:
    if proposed_memory.status == "approved":
        raise ValueError("Approved proposed memories cannot be rejected.")
    proposed_memory.status = "rejected"
    proposed_memory.rejected_at = datetime.utcnow()
    db.commit()
    db.refresh(proposed_memory)
    _trace_proposed_memory(db, proposed_memory, "proposed_memory_rejected")
    create_learning_event(
        db,
        proposed_memory.agent_id,
        "memory_rejected",
        source_type="proposed_memory",
        source_id=proposed_memory.id,
        content=proposed_memory.content,
        status=proposed_memory.status,
        run_id=_source_run_id(db, proposed_memory),
    )
    return proposed_memory


class ReflectionService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def reflect(self, run: Run, agent: Agent, payload: ReflectionRequest) -> tuple[str, ProposedMemory]:
        _validate_agent_participated(self.db, run, agent.id)
        feedback = self._feedback(run.id, agent.id, payload.feedback_id) if payload.feedback_id else None
        evaluation = self._evaluation(run.id, agent.id, payload.evaluation_id) if payload.evaluation_id else None
        if feedback is None and evaluation is None:
            raise ValueError("Reflection requires feedback_id or evaluation_id.")

        reflection = self._mock_reflection(feedback, evaluation)
        proposed = create_proposed_memory(
            self.db,
            agent,
            ProposedMemoryCreate(
                source_feedback_id=feedback.id if feedback else None,
                source_evaluation_id=evaluation.id if evaluation else None,
                memory_type=payload.memory_type,
                content=reflection,
                importance=payload.importance,
            ),
        )
        create_trace_event(
            self.db,
            run.id,
            "learning_reflection_created",
            {"proposed_memory_id": proposed.id, "reflection": reflection},
            agent.id,
        )
        create_learning_event(
            self.db,
            agent.id,
            "reflection_created",
            source_type="proposed_memory",
            source_id=proposed.id,
            content=reflection,
            status=proposed.status,
            run_id=run.id,
        )
        return reflection, proposed

    def _feedback(self, run_id: int, agent_id: int, feedback_id: int) -> AgentFeedback:
        feedback = self.db.get(AgentFeedback, feedback_id)
        if feedback is None or feedback.run_id != run_id or feedback.agent_id != agent_id:
            raise ValueError("Feedback does not belong to this agent.")
        return feedback

    def _evaluation(self, run_id: int, agent_id: int, evaluation_id: int) -> AgentEvaluation:
        evaluation = self.db.get(AgentEvaluation, evaluation_id)
        if evaluation is None or evaluation.run_id != run_id or evaluation.agent_id != agent_id:
            raise ValueError("Evaluation does not belong to this agent.")
        return evaluation

    def _mock_reflection(self, feedback: Optional[AgentFeedback], evaluation: Optional[AgentEvaluation]) -> str:
        source_text = " ".join(
            part
            for part in [
                feedback.feedback_text if feedback else "",
                _evaluation_recommendation_text(evaluation) if evaluation else "",
            ]
            if part
        )
        lower_text = source_text.lower()
        if "dashboard filters" in lower_text and "etl" in lower_text:
            return (
                "In BI discrepancy tasks, first check dashboard filters, date range, metric definition, "
                "refresh timestamp, and ETL logic internally before asking the customer for files."
            )
        if source_text:
            return f"When handling similar tasks, apply this feedback: {source_text.strip()}"
        return "When handling similar tasks, review prior feedback before responding."


def _validate_agent_participated(db: Session, run: Run, agent_id: int) -> None:
    snapshot_agent_ids = [agent.get("id") for agent in run.config_snapshot.get("agents", [])]
    if agent_id in snapshot_agent_ids:
        return
    trace_match = db.scalars(
        select(TraceEvent).where(TraceEvent.run_id == run.id, TraceEvent.agent_id == agent_id)
    ).first()
    if trace_match is None:
        raise ValueError("Agent did not participate in this run.")


def _validate_trace_event(db: Session, run_id: int, agent_id: int, trace_event_id: Optional[int]) -> None:
    if trace_event_id is None:
        return
    event = db.get(TraceEvent, trace_event_id)
    if event is None or event.run_id != run_id or event.agent_id != agent_id:
        raise ValueError("Trace event does not belong to this run and agent.")


def _validate_proposed_sources(
    db: Session,
    agent_id: int,
    feedback_id: Optional[int],
    evaluation_id: Optional[int],
) -> None:
    if feedback_id is not None:
        feedback = db.get(AgentFeedback, feedback_id)
        if feedback is None or feedback.agent_id != agent_id:
            raise ValueError("Feedback does not belong to this agent.")
    if evaluation_id is not None:
        evaluation = db.get(AgentEvaluation, evaluation_id)
        if evaluation is None or evaluation.agent_id != agent_id:
            raise ValueError("Evaluation does not belong to this agent.")


def _agent_memory_for_proposed_memory(db: Session, proposed_memory_id: int) -> Optional[AgentMemory]:
    statement = select(AgentMemory).where(AgentMemory.source == f"proposed_memory:{proposed_memory_id}")
    return db.scalars(statement).first()


def _trace_proposed_memory(
    db: Session,
    proposed_memory: ProposedMemory,
    event_type: str,
    extra_payload: Optional[dict] = None,
) -> None:
    run_id = _source_run_id(db, proposed_memory)
    if run_id is None:
        return
    payload = {
        "proposed_memory_id": proposed_memory.id,
        "status": proposed_memory.status,
        "source_feedback_id": proposed_memory.source_feedback_id,
        "source_evaluation_id": proposed_memory.source_evaluation_id,
    }
    payload.update(extra_payload or {})
    create_trace_event(db, run_id, event_type, payload, proposed_memory.agent_id)


def _source_run_id(db: Session, proposed_memory: ProposedMemory) -> Optional[int]:
    if proposed_memory.source_feedback_id is not None:
        feedback = db.get(AgentFeedback, proposed_memory.source_feedback_id)
        return feedback.run_id if feedback else None
    if proposed_memory.source_evaluation_id is not None:
        evaluation = db.get(AgentEvaluation, proposed_memory.source_evaluation_id)
        return evaluation.run_id if evaluation else None
    return None


def _evaluation_recommendation_text(evaluation: AgentEvaluation) -> str:
    if not evaluation.recommendations:
        return ""
    return " ".join(str(value) for value in evaluation.recommendations.values())
