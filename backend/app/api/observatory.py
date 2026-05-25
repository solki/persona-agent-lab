from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.observatory import (
    AgentEvolutionRead,
    AgentExecutionDetail,
    AgentExecutionEventRead,
    AgentExecutionRead,
    AgentPerformanceSummary,
    RunMonitorRead,
    TokenUsageSummary,
)
from app.services import agent_service, observatory_service, run_service

router = APIRouter(tags=["observatory"])


def require_run(db: Session, run_id: int):
    run = run_service.get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


def require_agent(db: Session, agent_id: int):
    agent = agent_service.get_agent(db, agent_id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


def require_execution(db: Session, run_id: int, execution_id: int):
    execution = observatory_service.get_execution_for_run(db, run_id, execution_id)
    if execution is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent execution not found")
    return execution


@router.get("/runs/{run_id}/monitor", response_model=RunMonitorRead)
def get_run_monitor(run_id: int, db: Session = Depends(get_db)):
    run = require_run(db, run_id)
    return observatory_service.monitor_for_run(db, run)


@router.get("/runs/{run_id}/executions", response_model=list[AgentExecutionRead])
def list_run_executions(run_id: int, db: Session = Depends(get_db)):
    require_run(db, run_id)
    return observatory_service.list_executions_for_run(db, run_id)


@router.get("/runs/{run_id}/executions/{execution_id}", response_model=AgentExecutionDetail)
def get_run_execution(run_id: int, execution_id: int, db: Session = Depends(get_db)):
    require_run(db, run_id)
    execution = require_execution(db, run_id, execution_id)
    return observatory_service.execution_detail(db, execution)


@router.get("/runs/{run_id}/executions/{execution_id}/events", response_model=list[AgentExecutionEventRead])
def list_run_execution_events(run_id: int, execution_id: int, db: Session = Depends(get_db)):
    require_run(db, run_id)
    require_execution(db, run_id, execution_id)
    return observatory_service.list_execution_events(db, run_id, execution_id)


@router.get("/runs/{run_id}/token-usage", response_model=TokenUsageSummary)
def get_run_token_usage(run_id: int, db: Session = Depends(get_db)):
    require_run(db, run_id)
    return observatory_service.token_usage_summary(db, run_id)


@router.get("/agents/{agent_id}/evolution", response_model=AgentEvolutionRead)
def get_agent_evolution(agent_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    return observatory_service.evolution_for_agent(db, agent_id)


@router.get("/agents/{agent_id}/performance-summary", response_model=AgentPerformanceSummary)
def get_agent_performance_summary(agent_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    return observatory_service.performance_summary_for_agent(db, agent_id)
