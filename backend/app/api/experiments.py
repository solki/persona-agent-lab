from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analysis import ExperimentAnalysisRequest, ExperimentAnalysisResponse
from app.schemas.experiments import ExperimentArchiveResponse, ExperimentCreate, ExperimentRead, ExperimentRunRead, ExperimentUpdate
from app.services import experiment_analysis_service, experiment_service

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


@router.put("/{experiment_id}", response_model=ExperimentRead)
def update_experiment(experiment_id: int, payload: ExperimentUpdate, db: Session = Depends(get_db)):
    experiment = require_experiment(db, experiment_id)
    return experiment_service.update_experiment(db, experiment, payload)


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


@router.get("/{experiment_id}/runs", response_model=list[ExperimentRunRead])
def list_experiment_runs(experiment_id: int, db: Session = Depends(get_db)):
    require_experiment(db, experiment_id)
    return experiment_service.list_experiment_runs(db, experiment_id)


@router.post("/{experiment_id}/run", response_model=ExperimentRunRead, status_code=status.HTTP_201_CREATED)
def run_experiment(experiment_id: int, db: Session = Depends(get_db)):
    experiment = require_experiment(db, experiment_id)
    try:
        return experiment_service.run_experiment(db, experiment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{experiment_id}/analyze", response_model=ExperimentAnalysisResponse)
def analyze_experiment(experiment_id: int, payload: ExperimentAnalysisRequest = ExperimentAnalysisRequest(), db: Session = Depends(get_db)):
    experiment = require_experiment(db, experiment_id)
    try:
        request_config = payload.model_dump(exclude_none=True)
        # Remove api_key from any error logging context by handling it here
        return experiment_analysis_service.analyze_experiment(db, experiment, request_config)
    except experiment_analysis_service.ExperimentAnalysisError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
