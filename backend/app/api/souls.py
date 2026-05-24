from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.souls import SoulCreate, SoulRead, SoulUpdate
from app.services import soul_service

router = APIRouter(prefix="/souls", tags=["souls"])


def require_soul(db: Session, soul_id: int):
    soul = soul_service.get_soul(db, soul_id)
    if soul is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soul not found")
    return soul


@router.get("", response_model=list[SoulRead])
def list_souls(db: Session = Depends(get_db)):
    return soul_service.list_souls(db)


@router.post("", response_model=SoulRead, status_code=status.HTTP_201_CREATED)
def create_soul(payload: SoulCreate, db: Session = Depends(get_db)):
    return soul_service.create_soul(db, payload)


@router.get("/{soul_id}", response_model=SoulRead)
def get_soul(soul_id: int, db: Session = Depends(get_db)):
    return require_soul(db, soul_id)


@router.put("/{soul_id}", response_model=SoulRead)
def update_soul(soul_id: int, payload: SoulUpdate, db: Session = Depends(get_db)):
    soul = require_soul(db, soul_id)
    return soul_service.update_soul(db, soul, payload)


@router.delete("/{soul_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_soul(soul_id: int, db: Session = Depends(get_db)):
    soul = require_soul(db, soul_id)
    soul_service.delete_soul(db, soul)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
