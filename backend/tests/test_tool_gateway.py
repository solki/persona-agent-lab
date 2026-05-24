from app.models.agent import Agent
from app.models.tool import Tool
from app.services.agent_service import assign_tool
from app.tools.gateway import ToolGateway
from app.tools.registry import ToolRegistry
from app.tools.tavily_search import TavilySearchTool


class EchoTool:
    name = "echo"

    def execute(self, payload):
        return {"echo": payload}


def create_agent_and_tool(db_session, tool_name="echo"):
    agent = Agent(name="Tool User", role="operator", system_prompt="Use only assigned tools.")
    tool = Tool(name=tool_name, tool_type="test", description="Test tool")
    db_session.add(agent)
    db_session.add(tool)
    db_session.commit()
    db_session.refresh(agent)
    db_session.refresh(tool)
    return agent, tool


def test_gateway_allows_assigned_tool_and_returns_standard_result(db_session):
    agent, tool = create_agent_and_tool(db_session)
    assign_tool(db_session, agent.id, tool.id)
    registry = ToolRegistry()
    registry.register(EchoTool())

    result = ToolGateway(db_session, registry).execute(agent.id, "echo", {"message": "hello"})

    assert result.allowed is True
    assert result.success is True
    assert result.tool_name == "echo"
    assert result.agent_id == agent.id
    assert result.output == {"echo": {"message": "hello"}}
    assert result.error is None


def test_gateway_denies_unassigned_tool(db_session):
    agent, _tool = create_agent_and_tool(db_session)
    registry = ToolRegistry()
    registry.register(EchoTool())

    result = ToolGateway(db_session, registry).execute(agent.id, "echo", {"message": "hello"})

    assert result.allowed is False
    assert result.success is False
    assert result.error == "Tool is not assigned to this agent."
    assert result.output == {}


def test_gateway_returns_not_found_for_unknown_tool(db_session):
    agent = Agent(name="Tool User", role="operator", system_prompt="Use only assigned tools.")
    db_session.add(agent)
    db_session.commit()
    db_session.refresh(agent)

    result = ToolGateway(db_session, ToolRegistry()).execute(agent.id, "missing_tool", {})

    assert result.allowed is False
    assert result.success is False
    assert result.error == "Tool is not registered."


def test_tavily_missing_api_key_returns_configuration_error():
    result = TavilySearchTool(api_key=None).execute({"query": "agent isolation"})

    assert result["status"] == "configuration_error"
    assert "TAVILY_API_KEY" in result["message"]
