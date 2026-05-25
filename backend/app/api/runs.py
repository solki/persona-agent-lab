from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.runs import RunRead, TraceEventRead
from app.services import run_service, trace_service

router = APIRouter(prefix="/runs", tags=["runs"])


def require_run(db: Session, run_id: int):
    run = run_service.get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@router.get("", response_model=list[RunRead])
def list_runs(db: Session = Depends(get_db)):
    return run_service.list_runs(db)


@router.get("/{run_id}", response_model=RunRead)
def get_run(run_id: int, db: Session = Depends(get_db)):
    return require_run(db, run_id)


@router.get("/{run_id}/trace", response_model=list[TraceEventRead])
def get_run_trace(run_id: int, db: Session = Depends(get_db)):
    require_run(db, run_id)
    return trace_service.list_trace_events(db, run_id)


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_run(run_id: int, db: Session = Depends(get_db)):
    run = require_run(db, run_id)
    run_service.delete_run(db, run)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
