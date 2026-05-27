# Project State

Last updated after promoting frontend-v2 to the official frontend.

## Project Purpose

Agent Swarm Lab is a configurable platform for creating, editing, deleting, configuring, and composing independent AI agents. Each agent owns its model settings, soul/persona, system prompt, context entries, memory records, tool permissions, and handoff policy. Agents are isolated by default and must not share context, memory, tools, prompts, settings, or hidden runtime state unless explicit workflow output or a permission-checked handoff payload allows it.

Milestone 9 status: implemented.

Milestone 10 status: implemented.

Phase 2 Milestone 1 (Real LLM Hardening): implemented.

Phase 2 Milestone 2 (Frontend Learning Loop): implemented.

Phase 2 Milestone 3 (LLM Reflection): implemented.

Phase 2 Milestone 4 (Customer Escalation Learning Demo): implemented.

## Current Architecture

- Backend: FastAPI, Pydantic settings and schemas, SQLAlchemy models/services, PostgreSQL persistence, Qdrant vector-store abstraction, Tool Gateway, deterministic context assembler, provider factory, workflow runner, experiment runner, feedback-driven learning loop, and runtime observatory.
- Frontend: Vite, React, TypeScript, Tailwind CSS, shadcn/ui primitives, typed API client with Vite dev proxy, dashboard, and complete configuration management for souls, agents, tools, workflows, runs, experiments, agent-tool assignment, and policy-aware CRUD lifecycle actions. Playwright E2E coverage.
- Infrastructure: Docker Compose starts PostgreSQL and Qdrant for local development. PostgreSQL uses host port `5433` by default. Qdrant uses `6333` and `6334`. A seed script at `backend/scripts/seed_demo.py` creates the Customer Escalation Recovery demo agents and workflow.
- Skills: Project-specific skills live under `.skills/`: `agent-lab-planning`, `agent-lab-implementation`, `agent-lab-review`, and `agent-lab-experiment-design`.
- Documentation: Architecture, setup, isolation, memory/context, workflow runtime, and experiment design guides are under `docs/`.

## Current Backend Modules

- `app/main.py`: FastAPI app factory, CORS, router registration, startup table initialization when `CREATE_TABLES_ON_STARTUP=true`.
- `app/config.py`: Pydantic settings for database, CORS, Qdrant, Tavily, and LLM providers.
- `app/database.py`: SQLAlchemy base, engine/session setup, local table initialization, and `postgresql://` to `postgresql+psycopg://` normalization.
- `app/api/`: Routers for health, agents, souls, tools, contexts, memories, workflows, runs, experiments, learning, and observatory.
- `app/models/`: SQLAlchemy models for agents, souls, tools, contexts, memories, learning feedback/evaluations/proposed memories/events, observatory execution records/events/token usage, workflows, runs, trace events, experiments, and experiment runs.
- `app/schemas/`: Pydantic request/response schemas and policy schemas.
- `app/services/`: Persistence and scoped access services for agents, souls, tools, contexts, memories, learning, observatory, workflows, runs, trace events, and experiments.
- `app/runtime/`: Context assembler, workflow runner, handoff policy evaluator, mock provider, OpenAI-compatible provider, provider placeholders, provider factory, and provider interface.
- `app/memory/`: Vector store schemas, disabled vector store, and Qdrant adapter shell.
- `app/tools/`: Tool Gateway, local tool registry, and Tavily search wrapper.
- `backend/tests/`: Pytest suite with SQLite-backed API/service/runtime tests and deterministic mock LLM mode.

## Current Frontend Modules

- `src/App.tsx`: App root with refine resource registration, React Router routes, NotificationProvider wrapper, and dashboard Overview component.
- `src/pages/AgentsPage.tsx`: Agent list (`AgentsPage`), create/edit form (`AgentFormPage`), detail page with soul selection, active flag, policy JSON editors, agent-tool assignments, context CRUD, proposed-memory review, feedback-derived approval badges, and memory CRUD (`AgentDetailPage`).
- `src/pages/SoulsPage.tsx`: Soul/persona list (`SoulsPage`), create and edit form (`SoulFormPage`) with confirmed delete support and blocked-delete error display.
- `src/pages/ToolsPage.tsx`: Tool registry list (`ToolsPage`), create and edit form (`ToolFormPage`) with config JSON editor and active flag controls.
- `src/pages/WorkflowsPage.tsx`: Workflow list (`WorkflowsPage`), create/edit form with agent picker (`WorkflowFormPage`), and workflow run panel with confirmed delete and sequence removal.
- `src/pages/RunsPage.tsx`: Run list (`RunsPage`) with active/archived/status/workflow filters, archiving, activation, guarded permanent delete; run detail viewer (`RunDetailPage`) with collapsible input/output/config, trace events, learning feedback panel, token usage, and execution detail; live monitor page (`RunMonitorPage`) with polling-based status updates, agent execution cards, event stream, and token summary.
- `src/pages/ExperimentsPage.tsx`: Experiment list (`ExperimentsPage`), create/edit form (`ExperimentFormPage`) with comparison view, archive/activate, and guarded delete with force-delete fallback for experiments with runs.
- `src/components/shared/`: AppLayout (sidebar navigation shell), PageHeader, StatusBadge, ConfirmDialog, NoticeDialog, FormField, EmptyState, JsonCollapse, Alert, and reusable collapsed JSON/event viewers.
- `src/components/ui/`: shadcn/ui-style primitives (button, card, input, label, select, textarea).
- `src/lib/api.ts`: Typed backend API wrapper using `VITE_API_BASE_URL` with Vite `/api` dev proxy.
- `src/lib/types.ts`: Frontend TypeScript interfaces matching backend schemas.
- `src/lib/NotificationContext.tsx`: React context providing shared notification state with `totalCount` and `refresh()` across the app.
- `src/index.css`: Tailwind CSS with custom dark lab theme tokens, dot-grid utility, and live-pulse animation.
- `e2e/frontend.spec.ts`: Playwright E2E tests covering soul/agent/tool CRUD, workflow run, run archive/activate, experiment archive/force-delete, and agent isolation assertions.

## Current Data Models

- `Agent`: `id`, `name`, `description`, `role`, `system_prompt`, `soul_id`, `llm_provider`, `model`, `temperature`, `max_tokens`, `memory_policy`, `context_policy`, `handoff_policy`, `is_active`, timestamps.
- `Soul`: persona fields including principles, decision style, collaboration style, failure handling style, escalation style, and active flag.
- `Tool`: name, description, type, JSON config, active flag, timestamps.
- `AgentTool`: many-to-many assignment table between agents and tools.
- `AgentContext`: agent-scoped title, type, content, priority, active flag, timestamps.
- `AgentMemory`: agent-scoped type, content, source, importance, status, timestamps, last accessed timestamp.
- `AgentFeedback`: run id, agent id, optional trace event id, optional rating, feedback text, feedback type, creation timestamp.
- `AgentEvaluation`: run id, agent id, evaluator type, rubric scores, issues, recommendations, creation timestamp.
- `ProposedMemory`: agent id, optional source feedback/evaluation ids, type, content, importance, status, creation timestamp, approval/rejection timestamps.
- `LearningEvent`: run id, agent id, event type, source type/id, content, status, timestamp.
- `AgentExecution`: run id, agent id, agent name snapshot, status, sequence index, timestamps, elapsed milliseconds, input/output payloads, error, provider/model/temperature, config snapshot.
- `AgentExecutionEvent`: execution id, run id, agent id, event type, payload, timestamp.
- `TokenUsage`: run id, execution id, agent id, provider, model, prompt/completion/total tokens, estimated cost, raw usage, timestamp.
- `Workflow`: name, description, type, graph config, active flag, timestamps.
- `Run`: workflow id, input, output, status, config snapshot, started/ended/archive timestamps, creation timestamp.
- `TraceEvent`: run id, event type, optional agent id, payload, timestamp.
- `Experiment`: name, description, task prompt, selected agent ids, evaluation config, archive timestamp, timestamps.
- `ExperimentRun`: experiment id, run ids, comparison result, timestamp.

## Current API Endpoints

- Health: `GET /health`
- Agents: `GET /agents`, `POST /agents`, `GET /agents/{agent_id}`, `PUT /agents/{agent_id}`, `DELETE /agents/{agent_id}`
- Agent tools: `GET /agents/{agent_id}/tools`, `POST /agents/{agent_id}/tools/{tool_id}`, `DELETE /agents/{agent_id}/tools/{tool_id}`
- Souls: `GET /souls`, `POST /souls`, `GET /souls/{soul_id}`, `PUT /souls/{soul_id}`, `DELETE /souls/{soul_id}`
- Tools: `GET /tools`, `POST /tools`, `GET /tools/{tool_id}`, `PUT /tools/{tool_id}`, `DELETE /tools/{tool_id}`
- Contexts: `GET /agents/{agent_id}/contexts`, `POST /agents/{agent_id}/contexts`, `PUT /agents/{agent_id}/contexts/{context_id}`, `DELETE /agents/{agent_id}/contexts/{context_id}`
- Memories: `GET /agents/{agent_id}/memories`, `POST /agents/{agent_id}/memories`, `PUT /agents/{agent_id}/memories/{memory_id}`, `DELETE /agents/{agent_id}/memories/{memory_id}`, `POST /agents/{agent_id}/memories/{memory_id}/approve`, `POST /agents/{agent_id}/memories/{memory_id}/reject`
- Learning feedback: `POST /runs/{run_id}/agents/{agent_id}/feedback`, `GET /agents/{agent_id}/feedback`
- Learning evaluations: `POST /runs/{run_id}/agents/{agent_id}/evaluate`, `GET /runs/{run_id}/evaluations`
- Proposed memories: `POST /agents/{agent_id}/proposed-memories`, `GET /agents/{agent_id}/proposed-memories`, `GET /proposed-memory-notifications`, `POST /agents/{agent_id}/proposed-memories/{memory_id}/approve`, `POST /agents/{agent_id}/proposed-memories/{memory_id}/reject`
- Reflection: `POST /runs/{run_id}/agents/{agent_id}/reflect`
- Workflows: `GET /workflows`, `POST /workflows`, `GET /workflows/{workflow_id}`, `PUT /workflows/{workflow_id}`, `DELETE /workflows/{workflow_id}`, `POST /workflows/{workflow_id}/run`, `POST /workflows/{workflow_id}/run-async`
- Runs: `GET /runs`, `GET /runs/{run_id}`, `POST /runs/{run_id}/archive`, `POST /runs/{run_id}/activate`, `DELETE /runs/{run_id}/hard-delete`, `DELETE /runs/{run_id}` compatibility archive, `GET /runs/{run_id}/trace`
- Observatory: `GET /runs/{run_id}/monitor`, `GET /runs/{run_id}/executions`, `GET /runs/{run_id}/executions/{execution_id}`, `GET /runs/{run_id}/executions/{execution_id}/events`, `GET /runs/{run_id}/token-usage`, `GET /agents/{agent_id}/evolution`, `GET /agents/{agent_id}/performance-summary`
- Experiments: `GET /experiments`, `POST /experiments`, `GET /experiments/{experiment_id}`, `DELETE /experiments/{experiment_id}`, `POST /experiments/{experiment_id}/archive`, `POST /experiments/{experiment_id}/activate`, `POST /experiments/{experiment_id}/run`

## Current Runtime Flow

1. A workflow run accepts a task via `POST /workflows/{workflow_id}/run`.
2. The MVP runner supports fully functional `sequential` workflows. `supervisor` and `handoff_swarm` remain placeholders.
3. The runner loads active agents from `workflow.graph_config.agent_sequence`.
4. A `Run` is created with status `running`, input task, and a config snapshot of the workflow and participating agents.
5. Trace events record run start and workflow load.
6. For each agent, the runner creates an `AgentExecution`, records execution events for context assembly, memory retrieval, model request/response, token usage, and completion/failure, records legacy trace events, and passes the output as the next sequential task.
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
- The frontend supports context create, edit, delete, priority changes, and active/inactive status from the agent detail page.
- Memory entries are stored under `/agents/{agent_id}/memories` and service queries always filter by `agent_id`.
- Memory updates, deletes, approve, and reject operations through the wrong agent route return `404`.
- The frontend supports memory create, edit, delete, status changes, approve, and reject from the agent detail page.
- Memory statuses are `active`, `pending`, `rejected`, and `archived`; default created memory is `pending`.
- Proposed memory statuses are `pending`, `approved`, and `rejected`; proposed memories always start as `pending`.
- Feedback and evaluations are linked to a specific `run_id` and participating `agent_id`.
- Reflection converts feedback or evaluation into an agent-scoped proposed memory.
- Approving a proposed memory creates an active `AgentMemory` for the same `agent_id`.
- Rejecting a proposed memory does not create `AgentMemory`.
- Agent memory policy defaults to `{"write_mode": "manual_review", "retrieval_enabled": true}`.
- Context assembly includes active context for the current agent and active memory for the current agent only.
- Approved feedback-derived memory uses the same active-memory retrieval path as manual memory.
- The observatory records only the context and memory injected into the current execution.
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
- Before/after learning experiments are supported manually by comparing a baseline run with a later run after proposed-memory approval.
- Runtime observatory pages support polling-based run monitoring, collapsed event payload inspection, execution detail inspection, token usage review, run archiving, and agent evolution timelines. The workflow run page starts monitor-first async runs and redirects to `/runs/{run_id}/monitor`.

## Current Frontend Configuration Behavior

- Agent create/edit exposes soul selection, active status, provider, free-text model, temperature, max tokens, system prompt, and JSON editors for memory, context, and handoff policies.
- Policy editors validate JSON before submitting to the backend. Default templates use manual memory review, active context inclusion, and handoff disabled.
- Agent detail shows summary fields, read-only policy JSON, scoped context CRUD, scoped memory CRUD, proposed-memory review, and scoped tool assignment/unassignment.
- Sidebar Agents, the Agents list, and the Agent detail Proposed Memories section show amber approval badges only for pending `ProposedMemory` rows created from feedback or evaluation sources. Manual pending `AgentMemory` rows and reviewed proposed memories do not trigger these badges.
- Tools expose name, description, type, JSON config, active status, edit, and delete controls. Tool config JSON is validated before submit.
- Souls expose persona fields and can be created, edited, or deleted.
- Agents, souls, tools, contexts, memories, workflows, experiments, and assigned tools use in-app confirmation dialogs for destructive actions. Runs use confirmed archive and activate actions so learning history is preserved; permanent delete is limited to archived runs that pass backend safety checks, and blocked deletes open warning dialogs. Experiment deletion is blocked (409) when the experiment has been run; use the `?force=true` query parameter only for test cleanup. Mutations show loading states, success/error messages, and refresh or redirect after success.
- Soul deletion is blocked while agents still reference the soul; referenced souls should be deactivated. Tool deletion is blocked while agents are assigned to the tool; assigned tools should be unassigned or deactivated. Workflow deletion is blocked while runs still reference the workflow; referenced workflows should be deactivated. Agent deletion removes only that agent's owned configuration when no runtime history exists.
- CRUD lifecycle labels are standardized: Delete is hard delete for unused records, Archive hides historical/runtime records while preserving evidence, Deactivate disables reusable configuration, and Unassign removes relationship rows only.
- Active/inactive or review status badges are shown for agents, tools, contexts, and memories.

## Current Test Coverage Summary

- Health endpoint and startup/CORS/table initialization.
- SQLAlchemy model registration and agent default isolation policies.
- Agent, soul, tool CRUD and agent-tool assignment, including blocked soul deletion, referenced soul deactivation, and blocked assigned-tool deletion.
- Agent context CRUD scoped by `agent_id`.
- Agent memory CRUD scoped by `agent_id`, including approve/reject review flow.
- Agent feedback, evaluation, reflection, proposed-memory approval/rejection, feedback-derived proposed-memory notification counts, and cross-agent learning-memory isolation.
- Context assembler agent-scoped context and memory injection.
- Tool Gateway allowed, denied, unknown tool, trace persistence, and Tavily missing API key behavior.
- Qdrant config loading, empty API key acceptance, collection prefix naming, and `agent_id` requirement.
- Provider factory selection and OpenAI-compatible validation with mocked SDK calls.
- Workflow CRUD, blocked workflow deletion while runs exist, sequential run trace events, config snapshots, and context/memory isolation in runs.
- Runtime observatory execution records, execution events, mock token usage estimates, monitor endpoint, performance summaries, and evolution isolation.
- Run archive hides runs from the default list while preserving trace, execution, token, feedback, evaluation, proposed-memory, learning-event, agent, workflow, tool, soul, context, and active-memory records. Run activation restores archived runs to the active list without changing those records. Permanent delete is guarded by backend safety checks.
- Experiment CRUD including safe delete (204 for clean experiments, 409 when runs exist), experiment archive/activate with related runs preserved, and experiment run isolation/comparison behavior.
- Frontend has lint, TypeScript typecheck, production build, and Playwright E2E scripts.
- Playwright E2E covers the BI Dashboard Discrepancy journey, delete confirmation/cancel/success flows, blocked delete errors, nested context/memory edit/delete, tool deletion, run archiving and activation with learning records, guarded run-delete warnings, monitor collapsed/expanded payloads, feedback-derived proposed-memory approval badges, learning loop approval, re-run memory retrieval, and agent isolation assertions. Screenshot evidence is written under `docs/evidence/`.

## Current Known Limitations

- Vector embedding search and Qdrant upsert are adapter shells, not semantic retrieval.
- Real standard OpenAI, Anthropic, and Ollama providers remain placeholders.
- Supervisor and handoff swarm workflows are placeholders.
- Handoff policy is modeled and has an evaluator, but full handoff runtime integration is not implemented.
- The before/after learning comparison flow is manual; there is no dedicated comparison dashboard yet.
- Runtime monitoring is polling-based; WebSocket streaming is not implemented.
- Run hard delete is not exposed as the default cleanup behavior because learning records can reference run feedback and evaluations.
- Learning updates only agent memory; soul/persona is not rewritten automatically.
- No Alembic migrations; local startup can create tables automatically for MVP development.
- No authentication, authorization, multi-user isolation, or production deployment setup.
- Frontend E2E tests require a running backend and local services; they are not yet wired into a containerized one-command stack.
- Seed data scripts are present (`backend/scripts/seed_demo.py`) but not yet wired into a containerized one-command stack.
