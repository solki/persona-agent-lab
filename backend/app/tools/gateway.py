from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tool import AgentTool, Tool
from app.schemas.tools import ToolResult
from app.services.trace_service import create_trace_event
from app.tools.registry import ToolRegistry


class ToolGateway:
    def __init__(self, db: Session, registry: ToolRegistry) -> None:
        self.db = db
        self.registry = registry

    def execute(self, agent_id: int, tool_name: str, payload: dict, run_id: int = None) -> ToolResult:
        self._trace(run_id, "tool_call_requested", agent_id, {"tool_name": tool_name, "payload": payload})
        executable = self.registry.get(tool_name)
        if executable is None:
            self._trace(run_id, "tool_call_denied", agent_id, {"tool_name": tool_name, "reason": "Tool is not registered."})
            return ToolResult(
                tool_name=tool_name,
                agent_id=agent_id,
                allowed=False,
                success=False,
                error="Tool is not registered.",
            )

        tool = self.db.scalars(select(Tool).where(Tool.name == tool_name, Tool.is_active.is_(True))).first()
        if tool is None:
            self._trace(run_id, "tool_call_denied", agent_id, {"tool_name": tool_name, "reason": "Tool is not registered."})
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
            self._trace(run_id, "tool_call_denied", agent_id, {"tool_name": tool_name, "reason": "Tool is not assigned to this agent."})
            return ToolResult(
                tool_name=tool_name,
                agent_id=agent_id,
                allowed=False,
                success=False,
                error="Tool is not assigned to this agent.",
            )

        try:
            self._trace(run_id, "tool_call_allowed", agent_id, {"tool_name": tool_name})
            output = executable.execute(payload)
        except Exception as exc:
            self._trace(run_id, "tool_call_result", agent_id, {"tool_name": tool_name, "success": False, "error": str(exc)})
            return ToolResult(
                tool_name=tool_name,
                agent_id=agent_id,
                allowed=True,
                success=False,
                error=str(exc),
            )

        result = ToolResult(
            tool_name=tool_name,
            agent_id=agent_id,
            allowed=True,
            success=True,
            output=output or {},
        )
        self._trace(run_id, "tool_call_result", agent_id, result.model_dump())
        return result

    def _trace(self, run_id: int, event_type: str, agent_id: int, payload: dict) -> None:
        if run_id is not None:
            create_trace_event(self.db, run_id, event_type, payload, agent_id)
