# Next Session Prompt

Use this prompt to start a fresh Codex session for Milestone 9.

```text
We are continuing the Agent Swarm Lab project.

Before coding:
1. Read AGENTS.md.
2. Read docs/PROJECT_STATE.md.
3. Read docs/MILESTONE_HISTORY.md.
4. Inspect the repository directly, including README.md, docs/, backend/app, backend/tests, frontend/app, frontend/components, docker-compose.yml, and .env.example files.
5. Confirm the current state in a concise summary.
6. Use the project-specific skills under .skills/, especially agent-lab-planning before planning and agent-lab-implementation when coding.

Task:
Plan Milestone 9 before coding.

Milestone 9 objective:
Implement the Agent Learning Loop only.

Important constraints:
- Do not implement Milestone 10 yet.
- Preserve agent isolation by default.
- No hidden shared global context.
- No hidden shared global memory.
- Context retrieval must be scoped by agent_id.
- Memory retrieval and writeback must be scoped by agent_id.
- Tool access must go through Tool Gateway.
- Agent-to-agent information transfer must happen only through explicit workflow output or handoff payload.
- Receiving agents must not receive private context or private memory from sending agents.
- All documentation and code comments must be English.
- Do not commit .env files or secrets.
- Add or update tests for every runtime or backend behavior change.
- Run relevant tests before committing.

Milestone 9 scope:
- Add a learning loop that can propose memory writebacks from run outputs or runtime observations.
- Respect each agent's memory_policy.write_mode values: off, manual_review, auto.
- Keep manual_review as the default.
- Persist proposed memories under the current agent_id only.
- Make pending memories visible through existing memory APIs.
- Ensure auto mode never writes to another agent's memory.
- Add trace events for learning proposals and writeback decisions when runtime behavior changes.
- Update documentation after implementation.
```

