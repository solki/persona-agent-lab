from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.tool import AgentTool, Tool
from app.models.context import AgentContext
from app.models.experiment import Experiment, ExperimentRun
from app.models.learning import AgentEvaluation, AgentFeedback, ProposedMemory
from app.models.memory import AgentMemory
from app.models.observatory import AgentExecution, AgentExecutionEvent, LearningEvent, TokenUsage
from app.models.run import Run, TraceEvent
from app.models.soul import Soul
from app.models.workflow import Workflow
from app.schemas.admin import AdminCleanupResponse


def _count(table: type, db: Session) -> int:
    return db.query(table).count()


def cleanup_all_lab_data(db: Session) -> AdminCleanupResponse:
    # Count everything before deletion
    counts = {
        "deleted_feedback": _count(AgentFeedback, db),
        "deleted_evaluations": _count(AgentEvaluation, db),
        "deleted_proposed_memories": _count(ProposedMemory, db),
        "deleted_learning_events": _count(LearningEvent, db),
        "deleted_memories": _count(AgentMemory, db),
        "deleted_contexts": _count(AgentContext, db),
        "deleted_agent_tool_assignments": db.query(AgentTool).count(),
        "deleted_trace_events": _count(TraceEvent, db),
        "deleted_agent_execution_events": _count(AgentExecutionEvent, db),
        "deleted_token_usage": _count(TokenUsage, db),
        "deleted_agent_executions": _count(AgentExecution, db),
        "deleted_runs": _count(Run, db),
        "deleted_experiment_runs": _count(ExperimentRun, db),
        "deleted_experiments": _count(Experiment, db),
        "deleted_workflows": _count(Workflow, db),
        "deleted_tools": _count(Tool, db),
        "deleted_agents": _count(Agent, db),
        "deleted_souls": _count(Soul, db),
    }

    # Phase 1: Leaf tables with FK to runs and agents
    db.execute(LearningEvent.__table__.delete())
    db.execute(AgentExecutionEvent.__table__.delete())
    db.execute(TokenUsage.__table__.delete())

    # Phase 2: Tables referencing feedback/evaluations
    db.execute(ProposedMemory.__table__.delete())

    # Phase 3: Tables referencing runs/trace_events
    db.execute(AgentFeedback.__table__.delete())
    db.execute(AgentEvaluation.__table__.delete())
    db.execute(TraceEvent.__table__.delete())
    db.execute(AgentExecution.__table__.delete())

    # Phase 4: Agent-tool assignments
    db.execute(AgentTool.delete())

    # Phase 5: Runs
    db.execute(Run.__table__.delete())

    # Phase 6: Experiment runs and experiments
    db.execute(ExperimentRun.__table__.delete())
    db.execute(Experiment.__table__.delete())

    # Phase 7: Workflows and tools
    db.execute(Workflow.__table__.delete())
    db.execute(Tool.__table__.delete())

    # Phase 8: Agent-owned data
    db.execute(AgentContext.__table__.delete())
    db.execute(AgentMemory.__table__.delete())

    # Phase 9: Unlink souls from agents, then delete both
    db.execute(Agent.__table__.update().values(soul_id=None))
    db.execute(Agent.__table__.delete())
    db.execute(Soul.__table__.delete())

    db.commit()

    return AdminCleanupResponse(**counts)
