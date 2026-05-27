from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.experiment import ExperimentRun
from app.models.learning import AgentEvaluation, AgentFeedback
from app.models.observatory import AgentExecution, AgentExecutionEvent, LearningEvent, TokenUsage
from app.models.run import Run
from app.models.run import TraceEvent


class RunHardDeleteBlocked(ValueError):
    pass


def list_runs(db: Session, include_archived: bool = False) -> list[Run]:
    statement = select(Run)
    if not include_archived:
        statement = statement.where(Run.status != "archived")
    return list(db.scalars(statement.order_by(Run.id.desc())).all())


def get_run(db: Session, run_id: int) -> Run:
    return db.get(Run, run_id)


def archive_run(db: Session, run: Run) -> Run:
    if run.status != "archived":
        run.status = "archived"
        run.archived_at = datetime.utcnow()
    elif run.archived_at is None:
        run.archived_at = datetime.utcnow()
    db.commit()
    db.refresh(run)
    return run


def delete_run(db: Session, run: Run) -> Run:
    return archive_run(db, run)


def activate_run(db: Session, run: Run) -> Run:
    changed = False
    if run.status == "archived":
        run.status = "completed"
        changed = True
    if run.archived_at is not None:
        run.archived_at = None
        changed = True
    if changed:
        db.commit()
        db.refresh(run)
    return run


def hard_delete_archived_run(db: Session, run: Run) -> None:
    _assert_hard_delete_allowed(db, run)
    db.execute(delete(TokenUsage).where(TokenUsage.run_id == run.id))
    db.execute(delete(AgentExecutionEvent).where(AgentExecutionEvent.run_id == run.id))
    db.execute(delete(AgentExecution).where(AgentExecution.run_id == run.id))
    db.execute(delete(TraceEvent).where(TraceEvent.run_id == run.id))
    db.delete(run)
    db.commit()


def _assert_hard_delete_allowed(db: Session, run: Run) -> None:
    if run.status != "archived":
        raise RunHardDeleteBlocked("Archive this run before deleting it permanently.")
    if db.scalar(select(AgentFeedback.id).where(AgentFeedback.run_id == run.id).limit(1)) is not None:
        raise RunHardDeleteBlocked("This run has feedback and cannot be permanently deleted. Keep it archived to preserve learning history.")
    if db.scalar(select(AgentEvaluation.id).where(AgentEvaluation.run_id == run.id).limit(1)) is not None:
        raise RunHardDeleteBlocked("This run has evaluations and cannot be permanently deleted. Keep it archived to preserve learning history.")
    if db.scalar(select(LearningEvent.id).where(LearningEvent.run_id == run.id).limit(1)) is not None:
        raise RunHardDeleteBlocked("This run has learning events and cannot be permanently deleted. Keep it archived to preserve learning history.")
    experiment_runs = db.scalars(select(ExperimentRun)).all()
    if any(run.id in (experiment_run.run_ids or []) for experiment_run in experiment_runs):
        raise RunHardDeleteBlocked(
            "This run belongs to an experiment result and cannot be permanently deleted. "
            "Delete the parent experiment with force=true to remove this run and its experiment link."
        )
