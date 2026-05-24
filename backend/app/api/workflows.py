from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.runtime.workflow_runner import WorkflowRunner
from app.schemas.runs import RunRead, WorkflowRunRequest
from app.schemas.workflows import WorkflowCreate, WorkflowRead, WorkflowUpdate
from app.services import workflow_service

router = APIRouter(prefix="/workflows", tags=["workflows"])


def require_workflow(db: Session, workflow_id: int):
    workflow = workflow_service.get_workflow(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow


@router.get("", response_model=list[WorkflowRead])
def list_workflows(db: Session = Depends(get_db)):
    return workflow_service.list_workflows(db)


@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
def create_workflow(payload: WorkflowCreate, db: Session = Depends(get_db)):
    return workflow_service.create_workflow(db, payload)


@router.get("/{workflow_id}", response_model=WorkflowRead)
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    return require_workflow(db, workflow_id)


@router.put("/{workflow_id}", response_model=WorkflowRead)
def update_workflow(workflow_id: int, payload: WorkflowUpdate, db: Session = Depends(get_db)):
    workflow = require_workflow(db, workflow_id)
    return workflow_service.update_workflow(db, workflow, payload)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    workflow = require_workflow(db, workflow_id)
    workflow_service.delete_workflow(db, workflow)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{workflow_id}/run", response_model=RunRead, status_code=status.HTTP_201_CREATED)
def run_workflow(workflow_id: int, payload: WorkflowRunRequest, db: Session = Depends(get_db)):
    workflow = require_workflow(db, workflow_id)
    try:
        return WorkflowRunner(db).run(workflow, payload.task)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
