from typing import Any, Optional

from sqlalchemy import delete, exists, insert, select, union
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.context import AgentContext
from app.models.learning import AgentEvaluation, AgentFeedback, ProposedMemory
from app.models.memory import AgentMemory
from app.models.observatory import AgentExecution, AgentExecutionEvent, LearningEvent, TokenUsage
from app.models.run import Run, TraceEvent
from app.models.tool import AgentTool, Tool
from app.models.workflow import Workflow
from app.schemas.agents import AgentCreate, AgentUpdate


def _agent_payload(data: dict[str, Any]) -> dict[str, Any]:
    for policy_field in ("memory_policy", "context_policy", "handoff_policy"):
        value = data.get(policy_field)
        if hasattr(value, "model_dump"):
            data[policy_field] = value.model_dump()
    return data


def list_agents(db: Session) -> list[Agent]:
    return list(db.scalars(select(Agent).order_by(Agent.id)).all())


def get_agent(db: Session, agent_id: int) -> Optional[Agent]:
    return db.get(Agent, agent_id)


def create_agent(db: Session, payload: AgentCreate) -> Agent:
    agent = Agent(**_agent_payload(payload.model_dump()))
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def update_agent(db: Session, agent: Agent, payload: AgentUpdate) -> Agent:
    for field, value in _agent_payload(payload.model_dump(exclude_unset=True)).items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent


def blocking_runs_for_agent(db: Session, agent_id: int) -> list[dict[str, Any]]:
    run_id_queries = [
        select(TraceEvent.run_id).where(TraceEvent.agent_id == agent_id),
        select(AgentExecution.run_id).where(AgentExecution.agent_id == agent_id),
        select(AgentExecutionEvent.run_id).where(AgentExecutionEvent.agent_id == agent_id),
        select(TokenUsage.run_id).where(TokenUsage.agent_id == agent_id),
        select(AgentFeedback.run_id).where(AgentFeedback.agent_id == agent_id),
        select(AgentEvaluation.run_id).where(AgentEvaluation.agent_id == agent_id),
        select(LearningEvent.run_id).where(LearningEvent.agent_id == agent_id, LearningEvent.run_id.is_not(None)),
    ]
    distinct_run_ids = db.scalars(select(union(*run_id_queries).subquery().c.run_id).order_by("run_id")).all()
    if not distinct_run_ids:
        return []

    runs = db.scalars(
        select(Run).where(Run.id.in_(distinct_run_ids)).order_by(Run.id)
    ).all()
    workflow_ids = {run.workflow_id for run in runs}
    workflows = {
        wf.id: wf.name
        for wf in db.scalars(select(Workflow).where(Workflow.id.in_(workflow_ids))).all()
    }
    return [
        {
            "run_id": run.id,
            "status": run.status,
            "workflow_name": workflows.get(run.workflow_id, f"Workflow #{run.workflow_id}"),
            "created_at": run.created_at.isoformat() if run.created_at else None,
        }
        for run in runs
    ]


def delete_agent(db: Session, agent: Agent) -> None:
    blocking_runs = blocking_runs_for_agent(db, agent.id)
    if blocking_runs:
        raise ValueError(
            f"Agent has {len(blocking_runs)} related run(s) with runtime history. "
            "Archive and deactivate the agent instead, or delete the runs first."
        )

    db.execute(delete(AgentTool).where(AgentTool.c.agent_id == agent.id))
    db.execute(delete(AgentContext).where(AgentContext.agent_id == agent.id))
    db.execute(delete(AgentMemory).where(AgentMemory.agent_id == agent.id))
    db.execute(delete(ProposedMemory).where(ProposedMemory.agent_id == agent.id))
    db.delete(agent)
    db.commit()


def list_agent_tools(db: Session, agent_id: int) -> list[Tool]:
    statement = (
        select(Tool)
        .join(AgentTool, Tool.id == AgentTool.c.tool_id)
        .where(AgentTool.c.agent_id == agent_id)
        .order_by(Tool.id)
    )
    return list(db.scalars(statement).all())


def assign_tool(db: Session, agent_id: int, tool_id: int) -> None:
    exists = db.execute(
        select(AgentTool).where(AgentTool.c.agent_id == agent_id, AgentTool.c.tool_id == tool_id)
    ).first()
    if exists:
        return
    db.execute(insert(AgentTool).values(agent_id=agent_id, tool_id=tool_id))
    db.commit()


def remove_tool(db: Session, agent_id: int, tool_id: int) -> bool:
    result = db.execute(delete(AgentTool).where(AgentTool.c.agent_id == agent_id, AgentTool.c.tool_id == tool_id))
    db.commit()
    return bool(result.rowcount)
