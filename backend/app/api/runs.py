from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.runs import (
    CollaborationGraphResponse,
    RunActivateResponse,
    RunArchiveResponse,
    RunDeleteResponse,
    RunRead,
    TraceEventRead,
)
from app.services import collaboration_service, run_service, trace_service

router = APIRouter(prefix="/runs", tags=["runs"])


def require_run(db: Session, run_id: int):
    run = run_service.get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


def archive_response(run) -> dict:
    return {
        "id": run.id,
        "status": run.status,
        "archived": True,
        "archived_at": run.archived_at,
        "message": "Run archived successfully. Learning records were preserved.",
    }


def activate_response(run) -> dict:
    return {
        "id": run.id,
        "status": run.status,
        "archived": False,
        "archived_at": run.archived_at,
        "message": "Run activated successfully. Learning records were preserved.",
    }


def delete_response(run_id: int) -> dict:
    return {
        "id": run_id,
        "deleted": True,
        "message": "Archived run deleted permanently.",
    }


@router.get("", response_model=list[RunRead])
def list_runs(include_archived: bool = Query(False), db: Session = Depends(get_db)):
    return run_service.list_runs(db, include_archived=include_archived)


@router.get("/{run_id}", response_model=RunRead)
def get_run(run_id: int, db: Session = Depends(get_db)):
    return require_run(db, run_id)


@router.get("/{run_id}/trace", response_model=list[TraceEventRead])
def get_run_trace(run_id: int, db: Session = Depends(get_db)):
    require_run(db, run_id)
    return trace_service.list_trace_events(db, run_id)


@router.get("/{run_id}/collaboration-graph", response_model=CollaborationGraphResponse)
def get_collaboration_graph(run_id: int, db: Session = Depends(get_db)):
    require_run(db, run_id)
    try:
        return collaboration_service.build_collaboration_graph(db, run_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{run_id}/archive", response_model=RunArchiveResponse)
def archive_run(run_id: int, db: Session = Depends(get_db)):
    run = require_run(db, run_id)
    archived_run = run_service.archive_run(db, run)
    return archive_response(archived_run)


@router.post("/{run_id}/activate", response_model=RunActivateResponse)
def activate_run(run_id: int, db: Session = Depends(get_db)):
    run = require_run(db, run_id)
    activated_run = run_service.activate_run(db, run)
    return activate_response(activated_run)


@router.delete("/{run_id}/hard-delete", response_model=RunDeleteResponse)
def hard_delete_run(run_id: int, db: Session = Depends(get_db)):
    run = require_run(db, run_id)
    try:
        run_service.hard_delete_archived_run(db, run)
    except run_service.RunHardDeleteBlocked as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return delete_response(run_id)


@router.delete("/{run_id}", response_model=RunArchiveResponse)
def delete_run(run_id: int, db: Session = Depends(get_db)):
    run = require_run(db, run_id)
    archived_run = run_service.delete_run(db, run)
    return archive_response(archived_run)
