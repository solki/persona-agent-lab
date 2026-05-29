from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent
from app.models.run import Run
from app.schemas.learning import (
    AgentEvaluationCreate,
    AgentEvaluationRead,
    AgentFeedbackCreate,
    AgentFeedbackRead,
    ProposedMemoryApproveResponse,
    ProposedMemoryCreate,
    ProposedMemoryNotificationSummary,
    ProposedMemoryRead,
    ProposedMemoryRejectResponse,
    ReflectionRequest,
    ReflectionResponse,
    ReviewRequest,
    ReviewResponse,
)
from app.config import get_settings
from app.runtime.provider_factory import create_provider
from app.services import agent_service, learning_service, review_service, run_service

router = APIRouter(tags=["learning"])


def require_run(db: Session, run_id: int) -> Run:
    run = run_service.get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


def require_agent(db: Session, agent_id: int) -> Agent:
    agent = agent_service.get_agent(db, agent_id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


def require_proposed_memory(db: Session, agent_id: int, memory_id: int):
    proposed_memory = learning_service.get_proposed_memory_for_agent(db, agent_id, memory_id)
    if proposed_memory is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposed memory not found")
    return proposed_memory


@router.post(
    "/runs/{run_id}/agents/{agent_id}/feedback",
    response_model=AgentFeedbackRead,
    status_code=status.HTTP_201_CREATED,
)
def create_agent_feedback(
    run_id: int,
    agent_id: int,
    payload: AgentFeedbackCreate,
    db: Session = Depends(get_db),
):
    run = require_run(db, run_id)
    agent = require_agent(db, agent_id)
    try:
        return learning_service.create_feedback(db, run, agent, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/agents/{agent_id}/feedback", response_model=list[AgentFeedbackRead])
def list_agent_feedback(agent_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    return learning_service.list_feedback_for_agent(db, agent_id)


@router.get("/proposed-memory-notifications", response_model=ProposedMemoryNotificationSummary)
def proposed_memory_notification_summary(db: Session = Depends(get_db)):
    return learning_service.proposed_memory_notification_summary(db)


@router.post(
    "/runs/{run_id}/agents/{agent_id}/evaluate",
    response_model=AgentEvaluationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_agent_evaluation(
    run_id: int,
    agent_id: int,
    payload: AgentEvaluationCreate,
    db: Session = Depends(get_db),
):
    run = require_run(db, run_id)
    agent = require_agent(db, agent_id)
    try:
        return learning_service.create_evaluation(db, run, agent, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/runs/{run_id}/evaluations", response_model=list[AgentEvaluationRead])
def list_run_evaluations(run_id: int, db: Session = Depends(get_db)):
    require_run(db, run_id)
    return learning_service.list_evaluations_for_run(db, run_id)


@router.post(
    "/agents/{agent_id}/proposed-memories",
    response_model=ProposedMemoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_proposed_memory(agent_id: int, payload: ProposedMemoryCreate, db: Session = Depends(get_db)):
    agent = require_agent(db, agent_id)
    try:
        return learning_service.create_proposed_memory(db, agent, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/agents/{agent_id}/proposed-memories", response_model=list[ProposedMemoryRead])
def list_agent_proposed_memories(agent_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    return learning_service.list_proposed_memories_for_agent(db, agent_id)


@router.post(
    "/agents/{agent_id}/proposed-memories/{memory_id}/approve",
    response_model=ProposedMemoryApproveResponse,
)
def approve_proposed_memory(agent_id: int, memory_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    proposed_memory = require_proposed_memory(db, agent_id, memory_id)
    try:
        proposed_memory, agent_memory = learning_service.approve_proposed_memory(db, proposed_memory)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"proposed_memory": proposed_memory, "agent_memory": agent_memory}


@router.post(
    "/agents/{agent_id}/proposed-memories/{memory_id}/reject",
    response_model=ProposedMemoryRejectResponse,
)
def reject_proposed_memory(agent_id: int, memory_id: int, db: Session = Depends(get_db)):
    require_agent(db, agent_id)
    proposed_memory = require_proposed_memory(db, agent_id, memory_id)
    try:
        proposed_memory = learning_service.reject_proposed_memory(db, proposed_memory)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"proposed_memory": proposed_memory}


@router.post(
    "/runs/{run_id}/agents/{agent_id}/reflect",
    response_model=ReflectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def reflect_on_feedback(
    run_id: int,
    agent_id: int,
    payload: ReflectionRequest,
    db: Session = Depends(get_db),
):
    run = require_run(db, run_id)
    agent = require_agent(db, agent_id)
    try:
        settings = get_settings()
        provider = create_provider(settings)
        reflection, proposed_memory = learning_service.ReflectionService(db, provider).reflect(run, agent, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"run_id": run.id, "agent_id": agent.id, "reflection": reflection, "proposed_memory": proposed_memory}


@router.post(
    "/runs/{run_id}/agents/{target_agent_id}/review",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def review_agent_output(
    run_id: int,
    target_agent_id: int,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
):
    run = require_run(db, run_id)
    target_agent = require_agent(db, target_agent_id)
    reviewer_agent = require_agent(db, payload.reviewer_agent_id)
    try:
        settings = get_settings()
        provider = create_provider(settings)
        result = review_service.ReviewService(db, provider).review(
            run=run,
            target_agent=target_agent,
            reviewer_agent=reviewer_agent,
            trace_event_id=payload.trace_event_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return result
