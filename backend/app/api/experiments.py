from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.experiments import ExperimentArchiveResponse, ExperimentCreate, ExperimentRead, ExperimentRunRead
from app.services import experiment_service

router = APIRouter(prefix="/experiments", tags=["experiments"])


def require_experiment(db: Session, experiment_id: int):
    experiment = experiment_service.get_experiment(db, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
    return experiment


@router.get("", response_model=list[ExperimentRead])
def list_experiments(include_archived: bool = False, db: Session = Depends(get_db)):
    return experiment_service.list_experiments(db, include_archived=include_archived)


@router.post("", response_model=ExperimentRead, status_code=status.HTTP_201_CREATED)
def create_experiment(payload: ExperimentCreate, db: Session = Depends(get_db)):
    return experiment_service.create_experiment(db, payload)


@router.get("/{experiment_id}", response_model=ExperimentRead)
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    return require_experiment(db, experiment_id)


@router.delete("/{experiment_id}")
def delete_experiment(experiment_id: int, force: bool = False, db: Session = Depends(get_db)):
    experiment = require_experiment(db, experiment_id)
    result = experiment_service.delete_experiment(db, experiment, force=force)
    if result["blocked"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=result["message"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{experiment_id}/archive", response_model=ExperimentArchiveResponse)
def archive_experiment(experiment_id: int, db: Session = Depends(get_db)):
    experiment = require_experiment(db, experiment_id)
    archived = experiment_service.archive_experiment(db, experiment)
    return {
        "id": archived.id,
        "archived": True,
        "archived_at": archived.archived_at,
        "message": "Experiment archived successfully. Related runs and learning records were preserved.",
    }


@router.post("/{experiment_id}/activate", response_model=ExperimentArchiveResponse)
def activate_experiment(experiment_id: int, db: Session = Depends(get_db)):
    experiment = require_experiment(db, experiment_id)
    activated = experiment_service.activate_experiment(db, experiment)
    return {
        "id": activated.id,
        "archived": False,
        "archived_at": None,
        "message": "Experiment activated successfully. Related runs remain inspectable.",
    }


@router.post("/{experiment_id}/run", response_model=ExperimentRunRead, status_code=status.HTTP_201_CREATED)
def run_experiment(experiment_id: int, db: Session = Depends(get_db)):
    experiment = require_experiment(db, experiment_id)
    try:
        return experiment_service.run_experiment(db, experiment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
