from typing import Optional

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.soul import Soul
from app.schemas.souls import SoulCreate, SoulUpdate


def list_souls(db: Session) -> list[Soul]:
    return list(db.scalars(select(Soul).order_by(Soul.id)).all())


def get_soul(db: Session, soul_id: int) -> Optional[Soul]:
    return db.get(Soul, soul_id)


def create_soul(db: Session, payload: SoulCreate) -> Soul:
    soul = Soul(**payload.model_dump())
    db.add(soul)
    db.commit()
    db.refresh(soul)
    return soul


def update_soul(db: Session, soul: Soul, payload: SoulUpdate) -> Soul:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(soul, field, value)
    db.commit()
    db.refresh(soul)
    return soul


def delete_soul(db: Session, soul: Soul) -> None:
    if db.scalar(select(exists().where(Agent.soul_id == soul.id))):
        raise ValueError("Deactivate this soul instead. It is still referenced by one or more agents.")
    db.delete(soul)
    db.commit()
