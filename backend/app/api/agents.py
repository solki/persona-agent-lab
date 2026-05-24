from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.agents import AgentCreate, AgentRead, AgentUpdate
from app.schemas.tools import ToolRead
from app.services import agent_service, tool_service

router = APIRouter(prefix="/agents", tags=["agents"])


def require_agent(db: Session, agent_id: int):
    agent = agent_service.get_agent(db, agent_id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.get("", response_model=list[AgentRead])
def list_agents(db: Session = Depends(get_db)):
    return agent_service.list_agents(db)


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate, db: Session = Depends(get_db)):
    return agent_service.create_agent(db, payload)


@router.get("/{agent_id}", response_model=AgentRead)
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    return require_agent(db, agent_id)


@router.put("/{agent_id}", response_model=AgentRead)
def update_agent(agent_id: int, payload: AgentUpdate, db: Session = Depends(get_db)):
    agent = require_agent(db, agent_id)
    return agent_service.update_agent(db, agent, payload)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = require_agent(db, agent_id)
    agent_service.delete_agent(db, agent)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{agent_id}/tools", response_model=list[ToolRead])
def list_agent_tools(agent_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    return agent_service.list_agent_tools(db, agent_id)


@router.post("/{agent_id}/tools/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def assign_tool_to_agent(agent_id: int, tool_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    if tool_service.get_tool(db, tool_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    agent_service.assign_tool(db, agent_id, tool_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{agent_id}/tools/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_tool_from_agent(agent_id: int, tool_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    if tool_service.get_tool(db, tool_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    removed = agent_service.remove_tool(db, agent_id, tool_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent tool assignment not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
