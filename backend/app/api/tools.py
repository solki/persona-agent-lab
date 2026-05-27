from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.tools import ToolCreate, ToolRead, ToolUpdate
from app.services import tool_service

router = APIRouter(prefix="/tools", tags=["tools"])


def require_tool(db: Session, tool_id: int):
    tool = tool_service.get_tool(db, tool_id)
    if tool is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    return tool


@router.get("", response_model=list[ToolRead])
def list_tools(db: Session = Depends(get_db)):
    return tool_service.list_tools(db)


@router.post("", response_model=ToolRead, status_code=status.HTTP_201_CREATED)
def create_tool(payload: ToolCreate, db: Session = Depends(get_db)):
    return tool_service.create_tool(db, payload)


@router.get("/{tool_id}", response_model=ToolRead)
def get_tool(tool_id: int, db: Session = Depends(get_db)):
    return require_tool(db, tool_id)


@router.put("/{tool_id}", response_model=ToolRead)
def update_tool(tool_id: int, payload: ToolUpdate, db: Session = Depends(get_db)):
    tool = require_tool(db, tool_id)
    return tool_service.update_tool(db, tool, payload)


@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tool(tool_id: int, db: Session = Depends(get_db)):
    tool = require_tool(db, tool_id)
    try:
        tool_service.delete_tool(db, tool)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
