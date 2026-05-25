# Memory and Context

Memory and context are separate concepts in Agent Swarm Lab.

## Context

Context entries are user-managed reference material attached to one agent. Context retrieval must always filter by `agent_id`.

Context assembly must be deterministic and inspectable. Trace events should show which entries were eligible, selected, ordered, and injected.

The context API is scoped under `/agents/{agent_id}/contexts`. A context record cannot be updated or deleted through another agent's route.

The frontend agent detail page exposes context create, edit, delete, priority, type, content, and active/inactive controls. Inactive context remains stored but is excluded from active context assembly.

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

The frontend agent detail page exposes memory create, edit, delete, source, importance, status, approve, and reject controls. Status changes affect future retrieval through the normal active-memory path; pending, rejected, and archived records are visible for review but not injected into future runs.

## Proposed Memory Review

Milestone 9 adds proposed memories as the review layer between feedback and active memory.

Proposed memories are scoped under:

```text
/agents/{agent_id}/proposed-memories
```

A proposed memory always starts as `pending`. Approving it creates a normal active `AgentMemory` for the same `agent_id`. Rejecting it marks the proposal as `rejected` and does not create an `AgentMemory`.

Only active `AgentMemory` rows are retrieved by context assembly. Pending, rejected, and archived memories are not injected into future runs.

Feedback-derived memory therefore follows this path:

```text
run feedback -> reflection -> pending proposed memory -> approval -> active AgentMemory -> future context assembly
```

This milestone does not rewrite soul/persona fields automatically. Any persona update should be handled as a separate explicit user action in a later milestone.

## Observatory Memory Inspection

Milestone 10 adds execution detail views that show the context and memory injected into one agent execution.

The observatory does not perform new memory retrieval. It records what the existing context assembler selected for the current `agent_id`. This means:

- An execution detail can show only the memory injected into that execution.
- Another agent's private memory must not appear unless it was explicitly included by an authorized future handoff path.
- Rejected proposed memories remain absent because they never become active `AgentMemory` rows.
- Approved feedback-derived memory appears only through the normal active memory retrieval path for the same agent.

## Vector Store

Qdrant is accessed through a vector store abstraction. Agents must not directly access the Qdrant client.

If Qdrant is unavailable, vector search should return a clear unavailable status and basic app startup should continue.

Milestone 3 adds the vector abstraction and Qdrant adapter shell. Both search and upsert require `agent_id` before any vector-store operation can run, preserving memory isolation by default.
