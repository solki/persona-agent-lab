from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tool import AgentTool, Tool
from app.schemas.tools import ToolResult
from app.tools.registry import ToolRegistry


class ToolGateway:
    def __init__(self, db: Session, registry: ToolRegistry) -> None:
        self.db = db
        self.registry = registry

    def execute(self, agent_id: int, tool_name: str, payload: dict) -> ToolResult:
        executable = self.registry.get(tool_name)
        if executable is None:
            return ToolResult(
                tool_name=tool_name,
                agent_id=agent_id,
                allowed=False,
                success=False,
                error="Tool is not registered.",
            )

        tool = self.db.scalars(select(Tool).where(Tool.name == tool_name, Tool.is_active.is_(True))).first()
        if tool is None:
            return ToolResult(
                tool_name=tool_name,
                agent_id=agent_id,
                allowed=False,
                success=False,
                error="Tool is not registered.",
            )

        assigned = self.db.execute(
            select(AgentTool).where(AgentTool.c.agent_id == agent_id, AgentTool.c.tool_id == tool.id)
        ).first()
        if assigned is None:
            return ToolResult(
                tool_name=tool_name,
                agent_id=agent_id,
                allowed=False,
                success=False,
                error="Tool is not assigned to this agent.",
            )

        try:
            output = executable.execute(payload)
        except Exception as exc:
            return ToolResult(
                tool_name=tool_name,
                agent_id=agent_id,
                allowed=True,
                success=False,
                error=str(exc),
            )

        return ToolResult(
            tool_name=tool_name,
            agent_id=agent_id,
            allowed=True,
            success=True,
            output=output or {},
        )
