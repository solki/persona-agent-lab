from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tool import AgentTool, Tool
from app.schemas.tools import ToolResult
from app.services.observatory_service import create_execution_event_for_ids
from app.services.trace_service import create_trace_event
from app.tools.registry import ToolRegistry


class ToolGateway:
    def __init__(self, db: Session, registry: ToolRegistry) -> None:
        self.db = db
        self.registry = registry

    def execute(self, agent_id: int, tool_name: str, payload: dict, run_id: int = None, execution_id: int = None) -> ToolResult:
        self._trace(run_id, "tool_call_requested", agent_id, {"tool_name": tool_name, "payload": payload}, execution_id)
        executable = self.registry.get(tool_name)
        if executable is None:
            self._trace(run_id, "tool_call_denied", agent_id, {"tool_name": tool_name, "reason": "Tool is not registered."}, execution_id)
            return ToolResult(
                tool_name=tool_name,
                agent_id=agent_id,
                allowed=False,
                success=False,
                error="Tool is not registered.",
            )

        tool = self.db.scalars(select(Tool).where(Tool.name == tool_name, Tool.is_active.is_(True))).first()
        if tool is None:
            self._trace(run_id, "tool_call_denied", agent_id, {"tool_name": tool_name, "reason": "Tool is not registered."}, execution_id)
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
            self._trace(run_id, "tool_call_denied", agent_id, {"tool_name": tool_name, "reason": "Tool is not assigned to this agent."}, execution_id)
            return ToolResult(
                tool_name=tool_name,
                agent_id=agent_id,
                allowed=False,
                success=False,
                error="Tool is not assigned to this agent.",
            )

        try:
            self._trace(run_id, "tool_call_allowed", agent_id, {"tool_name": tool_name}, execution_id)
            output = executable.execute(payload)
        except Exception as exc:
            self._trace(run_id, "tool_call_result", agent_id, {"tool_name": tool_name, "success": False, "error": str(exc)}, execution_id)
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
        self._trace(run_id, "tool_call_result", agent_id, result.model_dump(), execution_id)
        return result

    def _trace(self, run_id: int, event_type: str, agent_id: int, payload: dict, execution_id: int = None) -> None:
        if run_id is not None:
            create_trace_event(self.db, run_id, event_type, payload, agent_id)
        if run_id is not None and execution_id is not None:
            execution_event_type = "tool_call_completed" if event_type == "tool_call_result" else event_type
            create_execution_event_for_ids(self.db, execution_id, run_id, agent_id, execution_event_type, payload)
