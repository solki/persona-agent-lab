# Workflow Runtime

Workflow definitions are separate from agent definitions.

## MVP Workflow Types

- Sequential workflow: fully functional first runtime path.
- Supervisor workflow: placeholder structure for later implementation.
- Handoff swarm workflow: placeholder structure for later implementation.

Milestone 4 implements the sequential workflow runner with mock LLM mode. The runner loads the workflow agent sequence, assembles each agent's prompt using only that agent's context and active memory, records trace events, and saves a config snapshot on the run.

## Run Trace Events

Every run should record:

- Run started
- Workflow loaded
- Agent selected
- Context assembled
- Memory retrieved
- Tool call requested
- Tool call allowed or denied
- Handoff requested
- Handoff allowed or denied
- Agent output
- Memory proposed
- Learning feedback received
- Learning evaluation recorded
- Learning reflection created
- Proposed memory approved or rejected
- Run completed
- Run failed

## Agent Runtime Observatory

Milestone 10 records each sequential workflow step as an `AgentExecution`.

Each execution stores the agent snapshot, sequence index, status, input payload, output payload, provider, model, temperature, timestamps, elapsed milliseconds, and an agent config snapshot. The runner also writes `AgentExecutionEvent` rows for context assembly, memory retrieval, LLM request/response, memory write proposal, completion, and failure.

The monitor endpoint is polling-based:

```http
GET /runs/{run_id}/monitor
```

It returns run status, active execution, all executions, latest execution events, token usage summary, learning event summary, elapsed time, and errors.

The frontend workflow run page uses the monitor-first run endpoint:

```http
POST /workflows/{workflow_id}/run-async
```

This endpoint creates a `Run`, queues one `AgentExecution` for each selected workflow agent, returns the run immediately, and executes the workflow in a background task. The frontend redirects to `/runs/{run_id}/monitor` so users can watch agents move through queued, running, completed, or failed states. The existing synchronous endpoint remains available for backend tests and direct API use:

```http
POST /workflows/{workflow_id}/run
```

The execution detail endpoint:

```http
GET /runs/{run_id}/executions/{execution_id}
```

shows only the context and memory injected into that specific execution. It must not expose another agent's private memory.

## Config Snapshots

Runs should save snapshots of agent definitions, workflow definitions, model settings, soul/persona, system prompt, tool permissions, handoff policy, context assembly metadata, and memory retrieval metadata.

Snapshots make mock and real-provider behavior inspectable and reproducible.

## Mock Provider

The mock provider returns deterministic placeholder responses based on the assembled prompt. It records metadata showing that context and memory were injected, but it does not call external LLM APIs.

## OpenAI-Compatible Provider

The runtime can select `LLM_PROVIDER=openai_compatible` to call any provider that supports the OpenAI chat completions format. The provider reads `OPENAI_COMPATIBLE_API_KEY`, `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_MODEL`, and optional `OPENAI_COMPATIBLE_PROVIDER_NAME` from backend settings.

This provider does not bypass Agent Swarm Lab isolation. It receives only the deterministic assembled prompt for the current agent and returns standard provider metadata for trace inspection. Tool access still goes through Tool Gateway, and memory/context retrieval remains scoped by `agent_id`.

DeepSeek is configured as an OpenAI-compatible endpoint rather than a DeepSeek-specific provider:

```bash
LLM_PROVIDER=openai_compatible
OPENAI_COMPATIBLE_PROVIDER_NAME=deepseek
OPENAI_COMPATIBLE_API_KEY=your_deepseek_api_key
OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com
OPENAI_COMPATIBLE_MODEL=deepseek-v4-flash
```

## Frontend Runtime UI

Milestone 6 adds workflow list, workflow editor, workflow run, and run trace pages. The UI keeps workflow composition separate from agent configuration by editing only workflow metadata and `graph_config.agent_sequence`. Run details expose the saved config snapshot and ordered trace events for inspection.

Milestone 9 extends the run trace page with feedback capture and reflection into proposed memory. Proposed memory approval remains on the agent detail page. Once approved, the memory is retrieved by the same context assembly path used by any other active agent memory.

Milestone 10 adds `/runs/[id]/monitor`, `/runs/[id]/executions`, and `/runs/[id]/executions/[executionId]` for runtime observability. The monitor polls the backend instead of opening a WebSocket stream. The workflow run form now opens the monitor page immediately after starting a run.
