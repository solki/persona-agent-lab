from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import Run


def list_runs(db: Session) -> list[Run]:
    return list(db.scalars(select(Run).order_by(Run.id)).all())


def get_run(db: Session, run_id: int) -> Run:
    return db.get(Run, run_id)
