from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.workflow import Workflow
from app.runtime.provider_factory import create_provider
from app.runtime.handoff_swarm_runner import HandoffSwarmRunner
from app.runtime.supervisor_runner import SupervisorRunner
from app.runtime.workflow_runner import SequentialRunner


def create_runner(db: Session, workflow: Workflow):
    """Return the appropriate runner for the workflow's type.

    Raises ValueError for unknown workflow types.
    """
    settings = get_settings()
    provider = create_provider(settings)

    if workflow.workflow_type == "sequential":
        return SequentialRunner(db, provider, settings)
    if workflow.workflow_type == "supervisor":
        return SupervisorRunner(db, provider, settings)
    if workflow.workflow_type == "handoff_swarm":
        return HandoffSwarmRunner(db, provider, settings)
    raise ValueError(f"Unsupported workflow type: {workflow.workflow_type}")
