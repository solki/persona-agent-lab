# Architecture

Agent Swarm Lab is organized around independent agent definitions, explicit workflow composition, policy-checked tools, scoped memory/context services, and reproducible run traces.

## Core Boundaries

- Agent definition: model settings, soul/persona link, system prompt, memory policy, context policy, handoff policy, and active state.
- Workflow definition: ordered or graph-based composition of agents for a task.
- Tool Gateway: the only path for agent tool execution.
- Memory service: persistent and vector-backed memory access scoped by `agent_id`.
- Context service: durable context entries scoped by `agent_id`.
- Runtime session: workflow run, trace events, config snapshot, inputs, outputs, and errors.

## Brain / Hands / Session Separation

- Brain: prompt assembly, model provider calls, and agent output generation.
- Hands: external actions through Tool Gateway wrappers.
- Session: persisted runs, trace events, artifacts, config snapshots, and status transitions.

Agents must not bypass the Tool Gateway or directly access vector database clients.

## MVP Runtime

The first runtime target is mock LLM mode. Mock mode should assemble the same context and memory payloads the real runtime will use, then return deterministic placeholder outputs so the UI can exercise workflows without provider cost.

## Persistence

PostgreSQL stores durable state for agents, souls, tools, contexts, memories, workflows, runs, trace events, experiments, and config snapshots.

Qdrant or a compatible vector store abstraction supports semantic memory retrieval. The application must tolerate unavailable Qdrant during basic startup.
