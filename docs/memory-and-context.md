# Memory and Context

Memory and context are separate concepts in Agent Swarm Lab.

## Context

Context entries are user-managed reference material attached to one agent. Context retrieval must always filter by `agent_id`.

Context assembly must be deterministic and inspectable. Trace events should show which entries were eligible, selected, ordered, and injected.

The context API is scoped under `/agents/{agent_id}/contexts`. A context record cannot be updated or deleted through another agent's route.

## Memory

Memory items are learned or recorded observations attached to one agent. Memory retrieval and writeback must always use the current `agent_id`.

Supported memory statuses:

- `active`
- `pending`
- `rejected`
- `archived`

Supported memory write modes:

- `off`
- `manual_review`
- `auto`

The default write mode is `manual_review`. Pending memory must be visible and can be approved or rejected.

The memory API is scoped under `/agents/{agent_id}/memories`. A memory record cannot be updated, deleted, approved, or rejected through another agent's route.

## Vector Store

Qdrant is accessed through a vector store abstraction. Agents must not directly access the Qdrant client.

If Qdrant is unavailable, vector search should return a clear unavailable status and basic app startup should continue.
