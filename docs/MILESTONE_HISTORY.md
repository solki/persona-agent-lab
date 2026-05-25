# Milestone History

This file summarizes repository state through Milestones 0-10 and the follow-up infrastructure/provider hardening work. It is intended to help a fresh Codex session continue without relying on long conversation history.

## Completed Milestones 0-10

### Milestone 0: Project Scaffold And Planning

- Created the initial repository structure.
- Added project-specific skills under `.skills/`.
- Added README and documentation skeletons.
- Added root, backend, and frontend environment examples.
- Added Docker Compose foundation.
- Initialized Git workflow and baseline documentation.

### Milestone 1: Backend Foundation

- Added FastAPI application structure.
- Added Pydantic settings.
- Added SQLAlchemy database setup and model metadata.
- Added health endpoint.
- Added backend requirements and basic backend tests.

### Milestone 2: Core CRUD And Isolation-Safe Services

- Added CRUD APIs for agents, souls, tools, agent context, and agent memory.
- Added agent-tool assignment endpoints.
- Added Pydantic schemas for core resources.
- Added `agent_id`-scoped context and memory services.
- Added tests for context and memory isolation.

### Milestone 3: Tool Gateway And Vector Store Boundary

- Added Tool Gateway with registry lookup, active tool validation, and agent assignment checks.
- Added standard `ToolResult` schema.
- Added Tavily search wrapper with clear missing-key behavior.
- Added Qdrant vector store abstraction and adapter shell.
- Added tests for allowed and denied Tool Gateway calls and vector memory scope requirements.

### Milestone 4: Runtime Foundation

- Added deterministic context assembler.
- Added mock LLM provider.
- Added provider interface.
- Added sequential workflow runner.
- Added run and trace persistence.
- Added config snapshots for workflow runs.
- Added tests for workflow traces, config snapshots, and context/memory isolation during runtime.

### Milestone 5: Frontend Foundation And Agent Management

- Added Next.js, TypeScript, React, and Tailwind frontend.
- Added dashboard layout and shared components.
- Added agent list, create/edit, detail, context manager, and memory manager pages/components.
- Added soul/persona management pages.
- Added tool registry page.
- Added typed API client and frontend types.

### Milestone 6: Workflow And Run UI

- Added workflow list and workflow create/edit pages.
- Added workflow run page.
- Added run trace viewer.
- Exposed config snapshots and ordered trace events in the frontend.

### Milestone 7: Experiment Module

- Added experiment models, schemas, services, and API routes.
- Added experiment list, create, and run/comparison frontend pages.
- Implemented experiment runs by creating isolated single-agent sequential workflows for each selected agent.
- Added tests for experiment validation and cross-agent context/memory isolation in experiment traces.

### Milestone 8: Review And Hardening

- Performed Agent Lab review focused on isolation, traceability, startup readiness, and documentation.
- Added local CORS configuration for frontend development.
- Added local table initialization for MVP startup.
- Added Tool Gateway trace events for allowed and denied calls.
- Updated documentation for review status and runtime behavior.

### Milestone 9: Agent Learning Loop

- Added agent-scoped feedback, evaluation, and proposed-memory persistence.
- Added feedback and evaluation APIs linked to a specific `run_id` and participating `agent_id`.
- Added reflection API and deterministic mock reflection service for local learning proposals.
- Added proposed-memory approve/reject APIs.
- Approval creates active `AgentMemory` for the same agent; rejection creates no active memory.
- Added run trace learning events for feedback, evaluation, reflection, proposal, approval, and rejection.
- Added run trace frontend feedback/reflection UI.
- Added agent detail proposed-memory review UI.
- Added tests for feedback scoping, evaluation score validation, reflection, proposal defaults, approval writeback, rejection behavior, and cross-agent memory isolation.

### Milestone 10: Agent Runtime Observatory

- Added persistent agent execution records for each sequential workflow step.
- Added agent execution events for queued, started, context assembly, memory retrieval, LLM request/response, memory write proposal, completion, and failure phases.
- Added token usage persistence with mock-provider estimates.
- Added learning event persistence integrated with feedback, evaluations, reflection, proposed memories, approval, rejection, and memory activation.
- Added monitor, execution list/detail, token usage, agent evolution, and performance summary APIs.
- Added frontend pages for run monitor, run executions, execution detail, and agent evolution.
- Added tests for execution/event creation, mock token usage, monitor output, memory isolation in execution details, learning-event scoping, and performance aggregation.

## Follow-Up Work Completed After Milestone 8

- Added a generic OpenAI-compatible LLM provider using the OpenAI Python SDK.
- Added provider factory selection for `mock`, `openai_compatible`, `openai`, `anthropic`, and `ollama`.
- Documented DeepSeek as an example of the generic OpenAI-compatible provider.
- Added tests for provider configuration and mocked SDK calls.
- Made local development self-contained by adding Qdrant to Docker Compose.
- Updated PostgreSQL defaults to use host port `5433` and database `agent_swarm_lab`.
- Added Qdrant configuration tests and documented Qdrant startup and dashboard access.

## What Remains Incomplete

- Vector embedding search and Qdrant upsert are not fully implemented.
- Real standard OpenAI, Anthropic, and Ollama providers are placeholders.
- Supervisor workflow runtime is not implemented.
- Handoff swarm runtime is not implemented.
- Handoff policy is not integrated into a full workflow execution path.
- Before/after learning comparison is manual through run traces and repeated workflow runs.
- Learning updates only agent memory; soul/persona is not rewritten automatically.
- Runtime monitoring is polling-based; WebSocket streaming is not implemented.
- Frontend has no automated tests.
- Database migrations are not set up.
- Authentication and production deployment are not implemented.
- Seed data scripts are not present.

## Milestone 9 Completed Objective

Milestone 9 implements the Agent Learning Loop only.

Implemented focus:

- Propose memory writebacks from run-specific human feedback or optional evaluations.
- Default to manual review for proposed memories.
- Persist pending memory proposals under the current `agent_id`.
- Prevent cross-agent memory writeback.
- Add trace events for learning proposals and review outcomes where runtime behavior changes.
- Add tests for agent scoping, score validation, approval/rejection, and no private memory leakage.
- Update documentation after implementation.

Do not implement Milestone 10 as part of Milestone 9.

## Milestone 10 Completed Objective

Milestone 10 implements the Agent Runtime Observatory.

Implemented focus:

- Polling-based run monitor.
- Per-agent execution records and event timelines.
- Mock token usage estimates and token usage summaries.
- Agent evolution timeline from memory, feedback, evaluations, proposed memories, learning events, executions, and token usage.
- Post-run execution detail views that show only context and memory injected into that execution.
- Documentation for monitoring, token usage, learning events, persona observation, and polling limitations.
