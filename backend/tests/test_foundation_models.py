from app.database import Base
from app.models.agent import Agent
from app.schemas.agents import AgentCreate


def test_required_tables_are_registered_in_metadata():
    assert {
        "agents",
        "souls",
        "tools",
        "agent_tools",
        "agent_contexts",
        "agent_memories",
        "agent_feedback",
        "agent_evaluations",
        "proposed_memories",
        "learning_events",
        "agent_executions",
        "agent_execution_events",
        "token_usage",
        "workflows",
        "runs",
        "trace_events",
        "experiments",
        "experiment_runs",
    }.issubset(Base.metadata.tables.keys())


def test_agent_model_defaults_are_isolated_by_default():
    agent = Agent(
        name="Isolated Agent",
        role="solver",
        system_prompt="Solve one task at a time.",
    )

    assert agent.llm_provider == "mock"
    assert agent.model == "mock-deterministic"
    assert agent.temperature == 0.2
    assert agent.max_tokens == 1024
    assert agent.memory_policy == {"write_mode": "manual_review", "retrieval_enabled": True}
    assert agent.context_policy == {"include_active_context": True}
    assert agent.handoff_policy == {"allow_handoff": False, "allowed_agent_ids": []}
    assert agent.is_active is True


def test_agent_create_schema_keeps_soul_separate_from_system_prompt():
    payload = AgentCreate(
        name="Planner",
        role="planning",
        soul_id=123,
        system_prompt="Create a concise plan.",
    )

    assert payload.soul_id == 123
    assert payload.system_prompt == "Create a concise plan."
    assert payload.llm_provider == "mock"
    assert payload.model == "mock-deterministic"
    assert payload.memory_policy.write_mode == "manual_review"
    assert payload.handoff_policy.allow_handoff is False
