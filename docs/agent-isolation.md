# Agent Isolation

Agent isolation is the default security and product model for Agent Swarm Lab.

## Isolation Rules

- No hidden shared global context.
- No hidden shared global memory.
- No hidden shared global tools.
- No hidden shared global model settings.
- No implicit prompt inheritance across agents.
- No private sender memory or context in receiver input during handoff.

Each agent owns:

- LLM provider
- Model
- Temperature
- Max tokens
- System prompt
- Soul/persona
- Context entries
- Memory store
- Tool permissions
- Handoff policy

## Allowed Sharing

Sharing is allowed only when represented by explicit workflow configuration or a permission-checked handoff payload.

Allowed shared data must be inspectable in trace events and reproducible from the saved config snapshot.

## Review Focus

Any implementation that can read another agent's memory, context, tools, or private prompt material without explicit policy is a high-priority defect.
