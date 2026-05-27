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
    if soul.is_active:
        raise ValueError("Deactivate this soul before deleting it. Active souls cannot be directly deleted.")
    agents = db.scalars(select(Agent).where(Agent.soul_id == soul.id)).all()
    if agents:
        names = ", ".join(a.name for a in agents)
        raise ValueError(f"This soul is linked to {len(agents)} agent(s): {names}. Reassign or remove the soul from those agents before deleting.")
    db.delete(soul)
    db.commit()
