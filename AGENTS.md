# Agent Swarm Lab Rules

- All documentation must be written in English.
- All code comments must be written in English.
- Do not commit `.env` files or secrets.
- Use Git for all changes.
- Use project-specific skills under `.skills/`.
- Agent isolation is the default.
- No hidden shared global context.
- No hidden shared global memory.
- Context retrieval must be scoped by `agent_id`.
- Memory retrieval must be scoped by `agent_id`.
- Tool access must go through Tool Gateway.
- Agent-to-agent information transfer must happen only through explicit workflow output or handoff payload.
- Receiving agents must not receive private context or private memory from sending agents.
- Every runtime or backend behavior change must include or update tests.
- Run relevant tests before committing.
- Do not start implementing Milestone 9 unless the task explicitly asks for Milestone 9 implementation.

