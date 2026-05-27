from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.demo import DemoCleanupResponse, DemoSeedResponse
from app.services import demo_service

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/seed", response_model=DemoSeedResponse)
def seed_demo(db: Session = Depends(get_db)):
    return demo_service.seed_demo(db)


@router.delete("/seed", response_model=DemoCleanupResponse)
def cleanup_demo(db: Session = Depends(get_db)):
    return demo_service.cleanup_demo(db)
