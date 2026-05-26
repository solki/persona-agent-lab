from typing import Any, Optional

from sqlalchemy import delete, exists, insert, select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.context import AgentContext
from app.models.learning import AgentEvaluation, AgentFeedback, ProposedMemory
from app.models.memory import AgentMemory
from app.models.observatory import AgentExecution, AgentExecutionEvent, LearningEvent, TokenUsage
from app.models.run import TraceEvent
from app.models.tool import AgentTool, Tool
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


def _has_agent_runtime_history(db: Session, agent_id: int) -> bool:
    runtime_models = (
        TraceEvent,
        AgentExecution,
        AgentExecutionEvent,
        TokenUsage,
        AgentFeedback,
        AgentEvaluation,
        LearningEvent,
    )
    return any(db.scalar(select(exists().where(model.agent_id == agent_id))) for model in runtime_models)


def delete_agent(db: Session, agent: Agent) -> None:
    if _has_agent_runtime_history(db, agent.id):
        raise ValueError("Delete related runs and learning records before deleting this agent, or deactivate it instead.")

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
