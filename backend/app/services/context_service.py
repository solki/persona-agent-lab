from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.context import AgentContext
from app.schemas.contexts import AgentContextCreate, AgentContextUpdate


def list_contexts_for_agent(db: Session, agent_id: int) -> list[AgentContext]:
    statement = select(AgentContext).where(AgentContext.agent_id == agent_id).order_by(AgentContext.priority, AgentContext.id)
    return list(db.scalars(statement).all())


def get_context_for_agent(db: Session, agent_id: int, context_id: int) -> Optional[AgentContext]:
    statement = select(AgentContext).where(AgentContext.agent_id == agent_id, AgentContext.id == context_id)
    return db.scalars(statement).first()


def create_context_for_agent(db: Session, agent_id: int, payload: AgentContextCreate) -> AgentContext:
    context = AgentContext(agent_id=agent_id, **payload.model_dump())
    db.add(context)
    db.commit()
    db.refresh(context)
    return context


def update_context(db: Session, context: AgentContext, payload: AgentContextUpdate) -> AgentContext:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(context, field, value)
    db.commit()
    db.refresh(context)
    return context


def delete_context(db: Session, context: AgentContext) -> None:
    db.delete(context)
    db.commit()
