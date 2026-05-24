from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.memory import AgentMemory
from app.schemas.memories import AgentMemoryCreate, AgentMemoryUpdate


def list_memories_for_agent(db: Session, agent_id: int) -> list[AgentMemory]:
    statement = select(AgentMemory).where(AgentMemory.agent_id == agent_id).order_by(AgentMemory.id)
    return list(db.scalars(statement).all())


def get_memory_for_agent(db: Session, agent_id: int, memory_id: int) -> Optional[AgentMemory]:
    statement = select(AgentMemory).where(AgentMemory.agent_id == agent_id, AgentMemory.id == memory_id)
    return db.scalars(statement).first()


def create_memory_for_agent(db: Session, agent_id: int, payload: AgentMemoryCreate) -> AgentMemory:
    memory = AgentMemory(agent_id=agent_id, **payload.model_dump())
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


def update_memory(db: Session, memory: AgentMemory, payload: AgentMemoryUpdate) -> AgentMemory:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(memory, field, value)
    db.commit()
    db.refresh(memory)
    return memory


def set_memory_status(db: Session, memory: AgentMemory, status: str) -> AgentMemory:
    memory.status = status
    db.commit()
    db.refresh(memory)
    return memory


def delete_memory(db: Session, memory: AgentMemory) -> None:
    db.delete(memory)
    db.commit()
