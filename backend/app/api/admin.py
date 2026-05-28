from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.admin import AdminCleanupResponse
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/cleanup-lab-data", response_model=AdminCleanupResponse)
def cleanup_lab_data(db: Session = Depends(get_db)):
    return admin_service.cleanup_all_lab_data(db)
