from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.agents import require_agent
from app.database import get_db
from app.schemas.memories import AgentMemoryCreate, AgentMemoryRead, AgentMemoryUpdate
from app.services import memory_service

router = APIRouter(prefix="/agents/{agent_id}/memories", tags=["memories"])


def require_memory(db: Session, agent_id: int, memory_id: int):
    memory = memory_service.get_memory_for_agent(db, agent_id, memory_id)
    if memory is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent memory not found")
    return memory


@router.get("", response_model=list[AgentMemoryRead])
def list_agent_memories(agent_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    return memory_service.list_memories_for_agent(db, agent_id)


@router.post("", response_model=AgentMemoryRead, status_code=status.HTTP_201_CREATED)
def create_agent_memory(agent_id: int, payload: AgentMemoryCreate, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    return memory_service.create_memory_for_agent(db, agent_id, payload)


@router.put("/{memory_id}", response_model=AgentMemoryRead)
def update_agent_memory(agent_id: int, memory_id: int, payload: AgentMemoryUpdate, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    memory = require_memory(db, agent_id, memory_id)
    return memory_service.update_memory(db, memory, payload)


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent_memory(agent_id: int, memory_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    memory = require_memory(db, agent_id, memory_id)
    memory_service.delete_memory(db, memory)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{memory_id}/approve", response_model=AgentMemoryRead)
def approve_agent_memory(agent_id: int, memory_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    memory = require_memory(db, agent_id, memory_id)
    return memory_service.set_memory_status(db, memory, "active")


@router.post("/{memory_id}/reject", response_model=AgentMemoryRead)
def reject_agent_memory(agent_id: int, memory_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    memory = require_memory(db, agent_id, memory_id)
    return memory_service.set_memory_status(db, memory, "rejected")
