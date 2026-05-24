from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.experiments import ExperimentCreate, ExperimentRead, ExperimentRunRead
from app.services import experiment_service

router = APIRouter(prefix="/experiments", tags=["experiments"])


def require_experiment(db: Session, experiment_id: int):
    experiment = experiment_service.get_experiment(db, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
    return experiment


@router.get("", response_model=list[ExperimentRead])
def list_experiments(db: Session = Depends(get_db)):
    return experiment_service.list_experiments(db)


@router.post("", response_model=ExperimentRead, status_code=status.HTTP_201_CREATED)
def create_experiment(payload: ExperimentCreate, db: Session = Depends(get_db)):
    return experiment_service.create_experiment(db, payload)


@router.get("/{experiment_id}", response_model=ExperimentRead)
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    return require_experiment(db, experiment_id)


@router.post("/{experiment_id}/run", response_model=ExperimentRunRead, status_code=status.HTTP_201_CREATED)
def run_experiment(experiment_id: int, db: Session = Depends(get_db)):
    experiment = require_experiment(db, experiment_id)
    try:
        return experiment_service.run_experiment(db, experiment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
