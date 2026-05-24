from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.agents import require_agent
from app.database import get_db
from app.schemas.contexts import AgentContextCreate, AgentContextRead, AgentContextUpdate
from app.services import context_service

router = APIRouter(prefix="/agents/{agent_id}/contexts", tags=["contexts"])


def require_context(db: Session, agent_id: int, context_id: int):
    context = context_service.get_context_for_agent(db, agent_id, context_id)
    if context is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent context not found")
    return context


@router.get("", response_model=list[AgentContextRead])
def list_agent_contexts(agent_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    return context_service.list_contexts_for_agent(db, agent_id)


@router.post("", response_model=AgentContextRead, status_code=status.HTTP_201_CREATED)
def create_agent_context(agent_id: int, payload: AgentContextCreate, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    return context_service.create_context_for_agent(db, agent_id, payload)


@router.put("/{context_id}", response_model=AgentContextRead)
def update_agent_context(agent_id: int, context_id: int, payload: AgentContextUpdate, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    context = require_context(db, agent_id, context_id)
    return context_service.update_context(db, context, payload)


@router.delete("/{context_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent_context(agent_id: int, context_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    context = require_context(db, agent_id, context_id)
    context_service.delete_context(db, context)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
