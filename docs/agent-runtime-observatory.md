# Agent Runtime Observatory

Milestone 10 adds a runtime monitoring and post-run analysis module for Agent Swarm Lab.

The observatory records each agent step inside a workflow run so users can inspect what happened during execution and compare behavior over time as context, memory, feedback, evaluations, and approved learning updates change.

## Scope

The MVP uses polling. It does not add WebSockets, live infrastructure monitoring, automatic soul/persona rewriting, or provider secret logging.

The observatory is read-only from the frontend. It records and displays:

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

- `/runs/[id]/monitor`
- `/runs/[id]/executions`
- `/runs/[id]/executions/[executionId]`
- `/agents/[id]/evolution`

The monitor page polls the backend every few seconds. The execution detail page shows input, output, context, retrieved memory IDs, LLM event summaries, token usage, tool calls, and learning events for one agent execution. The agent evolution page shows only the selected agent's memories, feedback, evaluations, proposed memories, learning events, executions, and token usage.

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
