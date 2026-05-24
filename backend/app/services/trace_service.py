from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import TraceEvent


def create_trace_event(db: Session, run_id: int, event_type: str, payload: dict, agent_id: int = None) -> TraceEvent:
    event = TraceEvent(run_id=run_id, event_type=event_type, agent_id=agent_id, payload=payload)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_trace_events(db: Session, run_id: int) -> list[TraceEvent]:
    statement = select(TraceEvent).where(TraceEvent.run_id == run_id).order_by(TraceEvent.id)
    return list(db.scalars(statement).all())
