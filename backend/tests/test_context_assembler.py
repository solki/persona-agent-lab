from app.models.agent import Agent
from app.models.context import AgentContext
from app.models.memory import AgentMemory
from app.models.soul import Soul
from app.runtime.context_assembler import ContextAssembler


def test_context_assembler_includes_only_current_agent_context(db_session):
    first_agent = Agent(name="First", role="solver", system_prompt="Solve carefully.")
    second_agent = Agent(name="Second", role="reviewer", system_prompt="Review carefully.")
    db_session.add_all([first_agent, second_agent])
    db_session.commit()
    db_session.refresh(first_agent)
    db_session.refresh(second_agent)

    db_session.add_all(
        [
            AgentContext(agent_id=first_agent.id, title="First context", context_type="note", content="FIRST_ONLY"),
            AgentContext(agent_id=second_agent.id, title="Second context", context_type="note", content="SECOND_ONLY"),
        ]
    )
    db_session.commit()

    assembled = ContextAssembler(db_session).assemble(first_agent.id, "Plan the task.")

    assert "FIRST_ONLY" in assembled.prompt
    assert "SECOND_ONLY" not in assembled.prompt
    assert assembled.metadata["context_entry_ids"] == [1]


def test_context_assembler_includes_only_current_agent_active_memory(db_session):
    first_agent = Agent(name="First", role="solver", system_prompt="Solve carefully.")
    second_agent = Agent(name="Second", role="reviewer", system_prompt="Review carefully.")
    db_session.add_all([first_agent, second_agent])
    db_session.commit()
    db_session.refresh(first_agent)
    db_session.refresh(second_agent)

    db_session.add_all(
        [
            AgentMemory(agent_id=first_agent.id, memory_type="lesson", content="FIRST_ACTIVE", status="active"),
            AgentMemory(agent_id=first_agent.id, memory_type="lesson", content="FIRST_PENDING", status="pending"),
            AgentMemory(agent_id=second_agent.id, memory_type="lesson", content="SECOND_ACTIVE", status="active"),
        ]
    )
    db_session.commit()

    assembled = ContextAssembler(db_session).assemble(first_agent.id, "Use memory.")

    assert "FIRST_ACTIVE" in assembled.prompt
    assert "FIRST_PENDING" not in assembled.prompt
    assert "SECOND_ACTIVE" not in assembled.prompt
    assert assembled.metadata["memory_ids"] == [1]


def test_context_assembler_is_deterministic_and_inspectable(db_session):
    soul = Soul(
        name="Persistent Problem Solver",
        principles="Verify assumptions.",
        decision_style="Stepwise",
        collaboration_style="Concise",
    )
    db_session.add(soul)
    db_session.commit()
    db_session.refresh(soul)
    agent = Agent(
        name="Planner",
        role="planning",
        soul_id=soul.id,
        system_prompt="Create a plan.",
    )
    db_session.add(agent)
    db_session.commit()
    db_session.refresh(agent)
    db_session.add_all(
        [
            AgentContext(agent_id=agent.id, title="Later", context_type="note", content="Second", priority=20),
            AgentContext(agent_id=agent.id, title="Earlier", context_type="note", content="First", priority=10),
        ]
    )
    db_session.commit()

    first = ContextAssembler(db_session).assemble(agent.id, "Task")
    second = ContextAssembler(db_session).assemble(agent.id, "Task")

    assert first.prompt == second.prompt
    assert first.metadata == second.metadata
    assert first.metadata["agent_id"] == agent.id
    assert first.metadata["context_entry_ids"] == [2, 1]
    assert first.sections[0]["title"] == "Platform safety and execution rules"
    assert "Soul/persona" in [section["title"] for section in first.sections]
