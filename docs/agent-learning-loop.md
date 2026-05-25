# Agent Learning Loop

Milestone 9 adds a feedback-driven learning loop that changes future agent behavior through agent-specific memory only.

The loop is:

```text
Run output
-> human feedback
-> optional evaluation
-> reflection
-> proposed memory
-> manual approval
-> active memory
-> future run behavior change
```

## Scope

Learning is scoped by `agent_id`. Feedback and evaluations are linked to a specific run and a specific participating agent. A proposed memory cannot become active until a user approves it.

Milestone 9 does not implement Agent Runtime Observatory, live monitoring, token usage dashboards, automatic soul/persona rewriting, or automatic agent configuration mutation. Soul/persona updates remain a future enhancement and should require an explicit user action.

## Data Model

`AgentFeedback` stores human feedback for one `run_id` and one `agent_id`. It can optionally point at a trace event and include a rating.

`AgentEvaluation` stores a manually submitted rubric evaluation for one `run_id` and one `agent_id`. Scores use the default 1-5 rubric:

- `task_completion`
- `persistence`
- `collaboration`
- `evidence_discipline`
- `tool_usage_quality`
- `handoff_quality`
- `customer_readiness`
- `safety`
- `clarity`

`ProposedMemory` stores a pending memory suggestion for one `agent_id`. It can reference source feedback, source evaluation, or both. Approved proposed memories create normal active `AgentMemory` records for the same agent.

## API Flow

Submit feedback:

```http
POST /runs/{run_id}/agents/{agent_id}/feedback
```

Submit an evaluation:

```http
POST /runs/{run_id}/agents/{agent_id}/evaluate
```

Reflect feedback or evaluation into a pending memory:

```http
POST /runs/{run_id}/agents/{agent_id}/reflect
```

Review proposed memories:

```http
GET /agents/{agent_id}/proposed-memories
POST /agents/{agent_id}/proposed-memories/{memory_id}/approve
POST /agents/{agent_id}/proposed-memories/{memory_id}/reject
```

Approving a proposed memory:

- sets `ProposedMemory.status` to `approved`
- sets `approved_at`
- creates an active `AgentMemory` for the same `agent_id`
- records the `AgentMemory.source` as `proposed_memory:{id}`

Rejecting a proposed memory:

- sets `ProposedMemory.status` to `rejected`
- sets `rejected_at`
- does not create an `AgentMemory`

Rejected proposed memories are not retrieved in future runs because context assembly only reads active `AgentMemory` rows.

## Reflection

`ReflectionService` converts feedback or evaluation into a proposed memory. In mock mode, reflection is deterministic so local tests and experiments do not require an LLM API key.

Example feedback:

```text
This agent asked the customer for the Excel file too early. It should first check dashboard filters, date range, metric definition, refresh timestamp, and ETL logic.
```

Mock proposed memory:

```text
In BI discrepancy tasks, first check dashboard filters, date range, metric definition, refresh timestamp, and ETL logic internally before asking the customer for files.
```

The service does not call external LLM APIs directly. Future provider-backed reflection should go through the existing provider abstraction.

## Frontend Flow

On a run trace page:

1. Select the participating agent.
2. Enter human feedback and optional rating.
3. Save feedback.
4. Generate a proposed memory.

On an agent detail page:

1. Review pending proposed memories.
2. Approve or reject each proposal.
3. Approved proposals become active memory for that agent.

After approving a proposed memory, re-run the same task to compare behavior.

## Before/After Learning Experiment

Use this manual experiment flow:

1. Run a workflow task and save the baseline output.
2. Open the run trace.
3. Submit feedback for the agent output.
4. Generate a proposed memory.
5. Open the agent detail page.
6. Approve the proposed memory.
7. Re-run the same workflow task.
8. Compare the original output, new output, trace events, and retrieved memory IDs.

Expected isolation assertions:

- The approved memory appears only in future runs for the same `agent_id`.
- Other agents do not retrieve the feedback-derived memory.
- Rejected proposed memories never appear in context assembly.
- Soul/persona fields are unchanged.
