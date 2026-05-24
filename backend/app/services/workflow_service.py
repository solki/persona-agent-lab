from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workflow import Workflow
from app.schemas.workflows import WorkflowCreate, WorkflowUpdate


def list_workflows(db: Session) -> list[Workflow]:
    return list(db.scalars(select(Workflow).order_by(Workflow.id)).all())


def get_workflow(db: Session, workflow_id: int) -> Optional[Workflow]:
    return db.get(Workflow, workflow_id)


def create_workflow(db: Session, payload: WorkflowCreate) -> Workflow:
    workflow = Workflow(**payload.model_dump())
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


def update_workflow(db: Session, workflow: Workflow, payload: WorkflowUpdate) -> Workflow:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(workflow, field, value)
    db.commit()
    db.refresh(workflow)
    return workflow


def delete_workflow(db: Session, workflow: Workflow) -> None:
    db.delete(workflow)
    db.commit()
