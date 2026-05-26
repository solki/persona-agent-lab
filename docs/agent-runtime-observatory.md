# Agent Runtime Observatory

Milestone 10 adds a runtime monitoring and post-run analysis module for Agent Swarm Lab.

The observatory records each agent step inside a workflow run so users can inspect what happened during execution and compare behavior over time as context, memory, feedback, evaluations, and approved learning updates change.

## Scope

The MVP uses polling. It does not add WebSockets, live infrastructure monitoring, automatic soul/persona rewriting, or provider secret logging.

The observatory records and displays:

- run status
- active workflow step
- active agent execution
- agent execution status cards
- execution event timeline
- injected context and retrieved memory for one execution
- model request/response summaries
- token usage
- learning events
- execution errors

Run management is available from the frontend and through the API. Users can list active or archived runs, open monitor, trace, executions, and token usage pages, archive old runs, activate archived runs, and attempt guarded permanent delete after in-app confirmation.

## Execution Records

Every sequential workflow agent step creates an `AgentExecution` row with:

- run and agent ids
- agent name snapshot
- sequence index
- status
- start/end timestamps and elapsed milliseconds
- input and output payloads
- provider, model, and temperature
- agent config snapshot
- error message, if any

Execution details are scoped to a single `execution_id`. The detail view shows only context and memory that were injected into that specific execution. It does not show another agent's private memory.

## Execution Events

Each execution writes `AgentExecutionEvent` rows for the runtime phases:

- `agent_queued`
- `agent_started`
- `context_assembly_started`
- `context_assembled`
- `memory_retrieval_started`
- `memory_retrieved`
- `llm_request_started`
- `llm_response_received`
- `memory_write_proposed`
- `agent_completed`
- `agent_failed`

Tool and handoff event names are reserved for the same table. Future tool or handoff runtime paths should write `tool_call_*` and `handoff_*` execution events without bypassing Tool Gateway or handoff policy checks.

## Token Usage

`TokenUsage` stores provider, model, prompt tokens, completion tokens, total tokens, estimated cost, and raw usage payload.

If the provider returns token usage metadata, the observatory stores it. In mock mode, token usage is estimated from prompt and completion text length and marked with:

```json
{"estimated": true}
```

Mock estimated cost is `0.0`.

## Learning Events

Milestone 10 adds `LearningEvent` as an observability timeline over the existing Milestone 9 learning models.

Learning events are written when feedback, evaluations, reflections, proposed memories, approvals, rejections, and active memory writebacks occur. Events are scoped by `agent_id` and, when available, `run_id`.

Supported event types include:

- `feedback_added`
- `evaluation_created`
- `reflection_created`
- `proposed_memory_created`
- `memory_approved`
- `memory_rejected`
- `memory_activated`
- `persona_change_proposed`
- `persona_change_approved`
- `persona_change_rejected`

Milestone 10 does not automatically change soul/persona. Persona event names are reserved for future explicit proposal workflows.

## API

Runtime monitor:

```http
GET /runs
GET /runs/{run_id}
POST /runs/{run_id}/archive
POST /runs/{run_id}/activate
DELETE /runs/{run_id}/hard-delete
DELETE /runs/{run_id}
GET /runs/{run_id}/monitor
```

Agent executions:

```http
GET /runs/{run_id}/executions
GET /runs/{run_id}/executions/{execution_id}
GET /runs/{run_id}/executions/{execution_id}/events
```

Token usage:

```http
GET /runs/{run_id}/token-usage
```

Agent evolution and performance:

```http
GET /agents/{agent_id}/evolution
GET /agents/{agent_id}/performance-summary
```

## Frontend

Frontend routes:

- `/runs`
- `/runs/[id]`
- `/runs/[id]/monitor`
- `/runs/[id]/executions`
- `/runs/[id]/executions/[executionId]`
- `/runs/[id]/token-usage`
- `/agents/[id]/evolution`

The monitor page polls the backend every second. Event rows are collapsed by default and show event type, agent, time, and step metadata. Use **Expand** to inspect formatted JSON payloads, or **Expand all** and **Collapse all** for bulk inspection. Filters support agent, event category, and text search. Long payloads are wrapped inside scrollable code blocks so monitor and trace pages stay readable on laptop screens.

The Runs page is the observability entry point. It shows run status, workflow, input preview, monitor, trace, executions, token usage, and archive or activate actions. Archive and activate actions require confirmation, show loading state, surface backend errors, and refresh the list after success. Active runs are shown by default; use the archive filter to view archived or all runs. Archived rows show **Activate** and, when appropriate, **Delete**. The execution detail page shows input, output, context, retrieved memory IDs, LLM event summaries, token usage, tool calls, and learning events for one agent execution. The agent evolution page shows only the selected agent's memories, feedback, evaluations, proposed memories, learning events, executions, and token usage.

## Run Archive

Run cleanup uses soft archive by default. `POST /runs/{run_id}/archive` marks the run as archived and sets `archived_at`. `POST /runs/{run_id}/activate` restores an archived run to the default Active runs list and clears `archived_at`. `DELETE /runs/{run_id}` is retained for compatibility but performs the same archive operation.

Archive preserves:

- trace events
- agent executions
- execution events
- token usage
- feedback and evaluations linked to the run
- proposed memories sourced from that run's feedback or evaluations
- learning events linked to the run
- active `AgentMemory` rows created from approved proposed memories
- the run record

Archive does not delete agents, workflows, souls, tools, contexts, active `AgentMemory` records, or `ProposedMemory` records. Hard delete is unsafe when feedback and proposed memories exist because `ProposedMemory.source_feedback_id` and `source_evaluation_id` preserve learning-loop lineage.

Permanent delete is intentionally limited. `DELETE /runs/{run_id}/hard-delete` only deletes already archived runs that do not have feedback, evaluations, learning events, or experiment result references. If the backend safety check fails, the API returns `409` and the frontend opens a warning dialog telling the user to keep the run archived.

Workflow deletion is separate from run archive. A workflow that still has run records is blocked with a clear error.

## Privacy And Isolation

The observatory preserves Agent Swarm Lab's isolation rules:

- Memory and context are still retrieved by `agent_id`.
- Execution details show only context and memory injected into that execution.
- Handoff payloads should be shown separately from private context when handoff runtime is implemented.
- API keys and provider secrets are not stored in execution payloads.
- Token usage stores provider metadata only, not credentials.

## Before/After Analysis

Use the observatory with Milestone 9 learning:

1. Run a workflow and open `/runs/{run_id}/monitor`.
2. Inspect each execution detail for context, memory, output, and token usage.
3. Add feedback and generate a proposed memory from the run trace.
4. Approve the proposed memory on the agent detail page.
5. Re-run the workflow.
6. Compare executions, token usage, learning events, and outputs across runs.

This helps evaluate whether approved memory and feedback improve performance over time without changing soul/persona automatically.
