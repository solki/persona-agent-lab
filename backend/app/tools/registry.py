from typing import Optional, Protocol


class ExecutableTool(Protocol):
    name: str

    def execute(self, payload: dict):
        ...


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ExecutableTool] = {}

    def register(self, tool: ExecutableTool) -> None:
        self._tools[tool.name] = tool

    def get(self, tool_name: str) -> Optional[ExecutableTool]:
        return self._tools.get(tool_name)
