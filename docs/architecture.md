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

## Backend Foundation and CRUD

The backend is a FastAPI application with Pydantic settings and SQLAlchemy metadata. Milestone 1 registers the required MVP tables and exposes `GET /health`.

Milestone 2 adds service-backed CRUD APIs for agents, souls, tools, agent-tool assignment, agent context, and agent memory. Context and memory services always filter by `agent_id`; update and delete operations on another agent's records return `404`.

Runtime execution, Tool Gateway execution, and vector memory integration are added in later milestones.

## Tool Gateway

Milestone 3 introduces the Tool Gateway boundary. Tools are registered in a local registry, but execution must pass through `ToolGateway`, which checks that the requested tool exists, is active, and is assigned to the requesting agent before calling the wrapper.

Tavily search is represented as a Tool Gateway wrapper. If `TAVILY_API_KEY` is missing, the wrapper returns a configuration error instead of crashing.

Tool Gateway calls can attach to a run id. When a run id is provided, the gateway persists `tool_call_requested`, `tool_call_allowed`, `tool_call_denied`, and `tool_call_result` trace events so tool decisions are auditable.

## Runtime Foundation

Milestone 4 adds workflow and run APIs, deterministic context assembly, mock LLM generation, sequential workflow execution, run trace events, and config snapshots. Context and memory are assembled per agent; private context or memory from another agent is not injected into the active agent's prompt.

## Milestone 8 Review Fixes

The review pass added local CORS configuration for the frontend, startup table initialization for local development, and trace persistence for Tool Gateway decisions.
