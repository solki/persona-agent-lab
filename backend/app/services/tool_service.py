from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.tool import AgentTool, Tool
from app.schemas.tools import ToolCreate, ToolUpdate


def list_tools(db: Session) -> list[Tool]:
    return list(db.scalars(select(Tool).order_by(Tool.id)).all())


def get_tool(db: Session, tool_id: int) -> Optional[Tool]:
    return db.get(Tool, tool_id)


def create_tool(db: Session, payload: ToolCreate) -> Tool:
    tool = Tool(**payload.model_dump())
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


def update_tool(db: Session, tool: Tool, payload: ToolUpdate) -> Tool:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tool, field, value)
    db.commit()
    db.refresh(tool)
    return tool


def delete_tool(db: Session, tool: Tool) -> None:
    db.execute(delete(AgentTool).where(AgentTool.c.tool_id == tool.id))
    db.delete(tool)
    db.commit()
