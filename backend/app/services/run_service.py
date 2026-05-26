from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import Run


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
