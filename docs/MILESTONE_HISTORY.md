# Milestone History

This file summarizes repository state through Milestones 0-8 and the follow-up infrastructure/provider hardening work. It is intended to help a fresh Codex session continue without relying on long conversation history.

## Completed Milestones 0-8

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

## Follow-Up Work Completed After Milestone 8

- Added a generic OpenAI-compatible LLM provider using the OpenAI Python SDK.
- Added provider factory selection for `mock`, `openai_compatible`, `openai`, `anthropic`, and `ollama`.
- Documented DeepSeek as an example of the generic OpenAI-compatible provider.
- Added tests for provider configuration and mocked SDK calls.
- Made local development self-contained by adding Qdrant to Docker Compose.
- Updated PostgreSQL defaults to use host port `5433` and database `agent_swarm_lab`.
- Added Qdrant configuration tests and documented Qdrant startup and dashboard access.

## What Remains Incomplete

- Agent Learning Loop is not implemented.
- Vector embedding search and Qdrant upsert are not fully implemented.
- Real standard OpenAI, Anthropic, and Ollama providers are placeholders.
- Supervisor workflow runtime is not implemented.
- Handoff swarm runtime is not implemented.
- Handoff policy is not integrated into a full workflow execution path.
- Memory writeback proposal and review loop is not automated.
- Frontend has no automated tests.
- Database migrations are not set up.
- Authentication and production deployment are not implemented.
- Seed data scripts are not present.

## Milestone 9 Planned Objective

Milestone 9 should implement the Agent Learning Loop only.

Expected focus:

- Propose memory writebacks from run outputs or runtime observations.
- Respect each agent's `memory_policy.write_mode`.
- Default to manual review for proposed memories.
- Persist pending memory proposals under the current `agent_id`.
- Prevent cross-agent memory writeback.
- Add trace events for learning proposals and review outcomes where runtime behavior changes.
- Add tests for off/manual_review/auto modes, agent scoping, and no private memory leakage.
- Update documentation after implementation.

Do not implement Milestone 10 as part of Milestone 9.

## Milestone 10 Planned Objective

Milestone 10 is not implemented and the repository does not yet define a concrete objective for it. Treat it as a future milestone to be planned after Milestone 9 is complete and reviewed.

