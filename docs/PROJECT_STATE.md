# Project State

Last updated after Milestones 0-8 and the local Qdrant Compose update.

## Project Purpose

Agent Swarm Lab is a configurable platform for creating, editing, deleting, configuring, and composing independent AI agents. Each agent owns its model settings, soul/persona, system prompt, context entries, memory records, tool permissions, and handoff policy. Agents are isolated by default and must not share context, memory, tools, prompts, settings, or hidden runtime state unless explicit workflow output or a permission-checked handoff payload allows it.

Milestone 9 status: not implemented.

Milestone 10 status: not implemented.

## Current Architecture

- Backend: FastAPI, Pydantic settings and schemas, SQLAlchemy models/services, PostgreSQL persistence, Qdrant vector-store abstraction, Tool Gateway, deterministic context assembler, provider factory, workflow runner, and experiment runner.
- Frontend: Next.js App Router, TypeScript, React, Tailwind CSS, typed API client, dashboard, management pages, workflow run pages, trace viewer, and experiment comparison UI.
- Infrastructure: Docker Compose starts PostgreSQL and Qdrant for local development. PostgreSQL uses host port `5433` by default. Qdrant uses `6333` and `6334`.
- Skills: Project-specific skills live under `.skills/`: `agent-lab-planning`, `agent-lab-implementation`, `agent-lab-review`, and `agent-lab-experiment-design`.
- Documentation: Architecture, setup, isolation, memory/context, workflow runtime, and experiment design guides are under `docs/`.

## Current Backend Modules

- `app/main.py`: FastAPI app factory, CORS, router registration, startup table initialization when `CREATE_TABLES_ON_STARTUP=true`.
- `app/config.py`: Pydantic settings for database, CORS, Qdrant, Tavily, and LLM providers.
- `app/database.py`: SQLAlchemy base, engine/session setup, local table initialization, and `postgresql://` to `postgresql+psycopg://` normalization.
- `app/api/`: Routers for health, agents, souls, tools, contexts, memories, workflows, runs, and experiments.
- `app/models/`: SQLAlchemy models for agents, souls, tools, contexts, memories, workflows, runs, trace events, experiments, and experiment runs.
- `app/schemas/`: Pydantic request/response schemas and policy schemas.
- `app/services/`: Persistence and scoped access services for agents, souls, tools, contexts, memories, workflows, runs, trace events, and experiments.
- `app/runtime/`: Context assembler, workflow runner, handoff policy evaluator, mock provider, OpenAI-compatible provider, provider placeholders, provider factory, and provider interface.
- `app/memory/`: Vector store schemas, disabled vector store, and Qdrant adapter shell.
- `app/tools/`: Tool Gateway, local tool registry, and Tavily search wrapper.
- `backend/tests/`: Pytest suite with SQLite-backed API/service/runtime tests and deterministic mock LLM mode.

## Current Frontend Modules

- `app/page.tsx`: Dashboard with navigation cards and isolation summary.
- `app/agents`: Agent list, create page, edit/detail page with context and memory managers.
- `app/souls`: Soul/persona list, create, and edit pages.
- `app/tools`: Tool registry page.
- `app/workflows`: Workflow list, create/edit pages, and workflow run page.
- `app/runs/[id]`: Run trace viewer.
- `app/experiments`: Experiment list, create page, and experiment run/comparison page.
- `components/agents`: Agent form/list/detail, context manager, memory manager.
- `components/souls`: Soul list and form.
- `components/tools`: Tool registry form/list.
- `components/workflows`: Workflow list/form/run panel.
- `components/runs`: Run trace viewer.
- `components/experiments`: Experiment list/form/runner.
- `components/shared`: App shell, field wrapper, page header, and status message.
- `lib/api.ts`: Typed backend API wrapper using `NEXT_PUBLIC_API_BASE_URL`.
- `lib/types.ts`: Frontend TypeScript interfaces matching backend schemas.

## Current Data Models

- `Agent`: `id`, `name`, `description`, `role`, `system_prompt`, `soul_id`, `llm_provider`, `model`, `temperature`, `max_tokens`, `memory_policy`, `context_policy`, `handoff_policy`, `is_active`, timestamps.
- `Soul`: persona fields including principles, decision style, collaboration style, failure handling style, and escalation style.
- `Tool`: name, description, type, JSON config, active flag, timestamps.
- `AgentTool`: many-to-many assignment table between agents and tools.
- `AgentContext`: agent-scoped title, type, content, priority, active flag, timestamps.
- `AgentMemory`: agent-scoped type, content, source, importance, status, timestamps, last accessed timestamp.
- `Workflow`: name, description, type, graph config, active flag, timestamps.
- `Run`: workflow id, input, output, status, config snapshot, started/ended timestamps, creation timestamp.
- `TraceEvent`: run id, event type, optional agent id, payload, timestamp.
- `Experiment`: name, description, task prompt, selected agent ids, evaluation config, timestamps.
- `ExperimentRun`: experiment id, run ids, comparison result, timestamp.

## Current API Endpoints

- Health: `GET /health`
- Agents: `GET /agents`, `POST /agents`, `GET /agents/{agent_id}`, `PUT /agents/{agent_id}`, `DELETE /agents/{agent_id}`
- Agent tools: `GET /agents/{agent_id}/tools`, `POST /agents/{agent_id}/tools/{tool_id}`, `DELETE /agents/{agent_id}/tools/{tool_id}`
- Souls: `GET /souls`, `POST /souls`, `GET /souls/{soul_id}`, `PUT /souls/{soul_id}`, `DELETE /souls/{soul_id}`
- Tools: `GET /tools`, `POST /tools`, `GET /tools/{tool_id}`, `PUT /tools/{tool_id}`, `DELETE /tools/{tool_id}`
- Contexts: `GET /agents/{agent_id}/contexts`, `POST /agents/{agent_id}/contexts`, `PUT /agents/{agent_id}/contexts/{context_id}`, `DELETE /agents/{agent_id}/contexts/{context_id}`
- Memories: `GET /agents/{agent_id}/memories`, `POST /agents/{agent_id}/memories`, `PUT /agents/{agent_id}/memories/{memory_id}`, `DELETE /agents/{agent_id}/memories/{memory_id}`, `POST /agents/{agent_id}/memories/{memory_id}/approve`, `POST /agents/{agent_id}/memories/{memory_id}/reject`
- Workflows: `GET /workflows`, `POST /workflows`, `GET /workflows/{workflow_id}`, `PUT /workflows/{workflow_id}`, `DELETE /workflows/{workflow_id}`, `POST /workflows/{workflow_id}/run`
- Runs: `GET /runs`, `GET /runs/{run_id}`, `GET /runs/{run_id}/trace`
- Experiments: `GET /experiments`, `POST /experiments`, `GET /experiments/{experiment_id}`, `POST /experiments/{experiment_id}/run`

## Current Runtime Flow

1. A workflow run accepts a task via `POST /workflows/{workflow_id}/run`.
2. The MVP runner supports fully functional `sequential` workflows. `supervisor` and `handoff_swarm` remain placeholders.
3. The runner loads active agents from `workflow.graph_config.agent_sequence`.
4. A `Run` is created with status `running`, input task, and a config snapshot of the workflow and participating agents.
5. Trace events record run start and workflow load.
6. For each agent, the runner selects the agent, assembles deterministic context, records context and memory trace events, calls the configured provider, records output, records a memory proposal event, and passes the output as the next sequential task.
7. The run is marked `completed`, output is persisted, and a `run_completed` trace event is written.

## Current Provider Configuration

- Default: `LLM_PROVIDER=mock`.
- Supported selector values: `mock`, `openai_compatible`, `openai`, `anthropic`, `ollama`.
- `mock` uses deterministic placeholder output with prompt digest metadata.
- `openai_compatible` uses the OpenAI Python SDK with configurable `OPENAI_COMPATIBLE_API_KEY`, `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_MODEL`, and optional `OPENAI_COMPATIBLE_PROVIDER_NAME`.
- Standard `openai`, `anthropic`, and `ollama` provider classes are placeholders and raise `NotImplementedError` if used for generation.
- LLM API keys must stay in backend-only environment files or deployment secrets. They must not be added to frontend environment files.

## Current Context And Memory Behavior

- Context entries are stored under `/agents/{agent_id}/contexts` and service queries always filter by `agent_id`.
- Context updates and deletes through the wrong agent route return `404`.
- Memory entries are stored under `/agents/{agent_id}/memories` and service queries always filter by `agent_id`.
- Memory updates, deletes, approve, and reject operations through the wrong agent route return `404`.
- Memory statuses are `active`, `pending`, `rejected`, and `archived`; default created memory is `pending`.
- Agent memory policy defaults to `{"write_mode": "manual_review", "retrieval_enabled": true}`.
- Context assembly includes active context for the current agent and active memory for the current agent only.
- Context assembly is deterministic and traceable through section order and metadata.
- Qdrant access is behind `QdrantVectorStore`. Search and upsert require `agent_id`.
- Vector search and vector upsert are not fully implemented yet because embeddings are not configured.

## Current Workflow And Experiment Behavior

- Workflow definitions are separate from agent definitions.
- Sequential workflows are functional and run agents in `graph_config.agent_sequence`.
- Supervisor and handoff swarm workflow types are accepted by schema but are runtime placeholders.
- Handoff evaluation exists as `HandoffEngine`, but handoff workflows are not implemented.
- Experiments require two or more agent ids.
- Experiment runs create a single-agent sequential workflow per selected agent, run the same task for each selected agent, and persist an `ExperimentRun` with run ids, trace links, outputs, task prompt, and evaluation config.
- Experiments preserve isolation by running each selected agent in its own workflow run.

## Current Test Coverage Summary

- Health endpoint and startup/CORS/table initialization.
- SQLAlchemy model registration and agent default isolation policies.
- Agent, soul, tool CRUD and agent-tool assignment.
- Agent context CRUD scoped by `agent_id`.
- Agent memory CRUD scoped by `agent_id`, including approve/reject review flow.
- Context assembler agent-scoped context and memory injection.
- Tool Gateway allowed, denied, unknown tool, trace persistence, and Tavily missing API key behavior.
- Qdrant config loading, empty API key acceptance, collection prefix naming, and `agent_id` requirement.
- Provider factory selection and OpenAI-compatible validation with mocked SDK calls.
- Workflow CRUD, sequential run trace events, config snapshots, and context/memory isolation in runs.
- Experiment CRUD and experiment run isolation/comparison behavior.
- Frontend has lint and TypeScript typecheck scripts but no frontend test suite yet.

## Current Known Limitations

- Milestone 9 Agent Learning Loop is not implemented.
- Milestone 10 is not implemented and its objective is not yet specified in the repository.
- Vector embedding search and Qdrant upsert are adapter shells, not semantic retrieval.
- Real standard OpenAI, Anthropic, and Ollama providers remain placeholders.
- Supervisor and handoff swarm workflows are placeholders.
- Handoff policy is modeled and has an evaluator, but full handoff runtime integration is not implemented.
- Memory writeback events are recorded as not proposed; no learning loop proposes durable memories yet.
- No Alembic migrations; local startup can create tables automatically for MVP development.
- No authentication, authorization, multi-user isolation, or production deployment setup.
- No frontend automated tests.
- Seed data scripts are not present.

