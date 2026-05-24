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
- Run completed
- Run failed

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
