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
