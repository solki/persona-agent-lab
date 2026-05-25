from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.models.learning import AgentEvaluation, AgentFeedback, ProposedMemory
from app.models.observatory import AgentExecution, AgentExecutionEvent, LearningEvent, TokenUsage
from app.models.run import Run
from app.models.run import TraceEvent


def list_runs(db: Session) -> list[Run]:
    return list(db.scalars(select(Run).order_by(Run.id.desc())).all())


def get_run(db: Session, run_id: int) -> Run:
    return db.get(Run, run_id)


def delete_run(db: Session, run: Run) -> None:
    feedback_ids = list(db.scalars(select(AgentFeedback.id).where(AgentFeedback.run_id == run.id)).all())
    evaluation_ids = list(db.scalars(select(AgentEvaluation.id).where(AgentEvaluation.run_id == run.id)).all())

    proposed_filters = []
    if feedback_ids:
        proposed_filters.append(ProposedMemory.source_feedback_id.in_(feedback_ids))
    if evaluation_ids:
        proposed_filters.append(ProposedMemory.source_evaluation_id.in_(evaluation_ids))
    if proposed_filters:
        proposed_memories = list(db.scalars(select(ProposedMemory).where(or_(*proposed_filters))).all())
        for proposed_memory in proposed_memories:
            if proposed_memory.status == "approved":
                proposed_memory.source_feedback_id = None
                proposed_memory.source_evaluation_id = None
            else:
                db.delete(proposed_memory)

    db.execute(delete(LearningEvent).where(LearningEvent.run_id == run.id))
    db.execute(delete(AgentFeedback).where(AgentFeedback.run_id == run.id))
    db.execute(delete(AgentEvaluation).where(AgentEvaluation.run_id == run.id))
    db.execute(delete(TokenUsage).where(TokenUsage.run_id == run.id))
    db.execute(delete(AgentExecutionEvent).where(AgentExecutionEvent.run_id == run.id))
    db.execute(delete(AgentExecution).where(AgentExecution.run_id == run.id))
    db.execute(delete(TraceEvent).where(TraceEvent.run_id == run.id))
    db.delete(run)
    db.commit()
