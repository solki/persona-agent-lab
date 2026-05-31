# Project State

Last updated 2026-05-30 — pre-Phase-3 audit. Phase 1 and Phase 2 are complete.

## Project Purpose

Agent Swarm Lab is a configurable platform for creating, editing, deleting, configuring, and composing independent AI agents. Each agent owns its model settings, soul/persona, system prompt, context entries, memory records, tool permissions, and handoff policy. Agents are isolated by default and must not share context, memory, tools, prompts, settings, or hidden runtime state unless explicit workflow output or a permission-checked handoff payload allows it.

## Phase Status

- Milestone 9 (Agent Learning Loop): implemented
- Milestone 10 (Runtime Observatory): implemented
- Phase 2 M1 (Real LLM Hardening): implemented
- Phase 2 M2 (Frontend Learning Loop): implemented
- Phase 2 M3 (LLM Reflection): implemented
- Phase 2 M4 (Customer Escalation Learning Demo): implemented
- Dynamic Reviewer Feedback (PR #7): implemented
- Field Help Tooltips + Adminer: implemented
- **Phase 3: starting — branch `feature/phase3`**

## Current Architecture

- **Backend**: FastAPI, Pydantic v2 settings and schemas, SQLAlchemy 2.x models/services, PostgreSQL 16 persistence, Qdrant vector-store abstraction, Tool Gateway (3-layer authorization), deterministic context assembler, provider factory (mock + openai_compatible functional; openai/anthropic/ollama placeholders), workflow runner (sequential only), experiment runner, feedback-driven human learning loop, agent-to-agent reviewer feedback, runtime observatory, and admin cleanup.
- **Frontend**: Vite + React + TypeScript + Tailwind CSS + shadcn/ui, typed API client (56 functions), NotificationContext for proposed-memory badges, and complete CRUD/run/monitor/review/demo UIs with Playwright E2E coverage.
- **Infrastructure**: Docker Compose (PostgreSQL 16 on host port 5433, Qdrant on 6333/6334, Adminer on 8080), backend `uvicorn` dev server, frontend Vite dev server proxy. The `/demo` page provides one-click idempotent seeding and cleanup. `POST /demo/seed` and `DELETE /demo/seed` API endpoints. CLI seed script at `backend/scripts/seed_demo.py`.
- **Skills**: Project-specific skills under `.claude/skills/`: `agent-lab-planning`, `agent-lab-implementation`, `agent-lab-review`, `agent-lab-experiment-design`.
- **Documentation**: Architecture, setup, isolation, memory/context, workflow runtime, experiment design, agent learning loop, runtime observatory, reviewer feedback design, reviewer feedback manual test, manual E2E test guide, frontend field help audit, frontend v2 evaluation, milestone history, and next-session prompt under `docs/`.

## Current Backend Modules

- `app/main.py`: FastAPI app factory, CORS, 14 router registrations, startup table initialization when `CREATE_TABLES_ON_STARTUP=true`.
- `app/config.py`: Pydantic settings for database, CORS, Qdrant, Tavily, and LLM providers (mock/openai_compatible/openai/anthropic/ollama).
- `app/database.py`: SQLAlchemy base, engine/session setup, local table initialization, `postgresql://` to `postgresql+psycopg://` normalization, inline schema migration helper.
- `app/api/`: 14 routers for health, agents, souls, tools, contexts, memories, workflows, runs, experiments, learning, observatory, admin, and demo.
- `app/models/`: 11 model files, 18 SQLAlchemy tables — see Data Models section below.
- `app/schemas/`: 14 schema files, 63 Pydantic models for request/response validation, nested policy configs, demo responses, learning types, observatory types, and admin cleanup.
- `app/services/`: Scoped persistence services for agents, souls, tools, contexts, memories, learning, observatory, workflows, runs, trace events, experiments, review, and demo.
- `app/runtime/`: Context assembler, workflow runner (sequential), handoff policy evaluator, mock provider, OpenAI-compatible provider (real LLM via OpenAI SDK), provider placeholders (OpenAI/Anthropic/Ollama), provider factory, and provider interface.
- `app/memory/`: Vector store schemas, disabled vector store (null object), and Qdrant adapter (search/upsert stubs awaiting embedding provider).
- `app/tools/`: Tool Gateway with 3-layer authorization (registry+DB+assignment), local tool registry (ExecutableTool protocol), and Tavily search wrapper.
- `backend/tests/`: 123 tests across 16 test files, all passing with `LLM_PROVIDER=mock`.

## Current Frontend Modules

- `src/App.tsx`: App root with React Router routes, NotificationProvider wrapper, and dashboard Overview component.
- `src/pages/AgentsPage.tsx` (858 lines): Agent list, create/edit form, detail page with soul selection, active flag, policy JSON editors, agent-tool assignments, context CRUD, proposed-memory review with notification badges, memory CRUD, and reviewer feedback.
- `src/pages/SoulsPage.tsx` (293 lines): Soul list, create/edit form with FieldHelp tooltips.
- `src/pages/ToolsPage.tsx` (280 lines): Tool registry list, create/edit form.
- `src/pages/WorkflowsPage.tsx` (339 lines): Workflow list, create/edit form with agent picker and run panel.
- `src/pages/RunsPage.tsx` (1084 lines): Run list with bulk archive/activate, detail view with learning feedback and reviewer feedback sections, live polling monitor.
- `src/pages/ExperimentsPage.tsx` (354 lines): Experiment list, create/detail form with run.
- `src/pages/DemoPage.tsx` (370 lines): Phase 2 acceptance demo with idempotent seed/cleanup, acceptance checklist, and quick links.
- `src/components/shared/`: AppLayout (sidebar with notification badges), PageHeader, StatusBadge, ConfirmDialog, NoticeDialog, FormField, EmptyState, JsonCollapse, Alert, FieldHelp.
- `src/components/ui/`: shadcn/ui-style primitives (Button, Card, CardHeader, CardContent, Input, Label, Select, Textarea).
- `src/lib/api.ts` (157 lines): 56 typed API functions using `VITE_API_BASE_URL`.
- `src/lib/types.ts` (301 lines): 30 TypeScript interfaces matching backend schemas.
- `src/lib/NotificationContext.tsx`: React context for proposed-memory notifications with `totalCount` and `refresh()`.
- `src/lib/utils.ts` (35 lines): Utility helpers.
- `src/index.css`: Tailwind CSS with dark lab theme, dot-grid utility, and live-pulse animation.
- `e2e/frontend.spec.ts`: Playwright E2E tests covering full CRUD, workflow run, archive/activate, experiments, isolation, demo, and Phase 2 acceptance.

## Current Data Models

18 SQLAlchemy tables registered in `Base.metadata`:

| Table | Key Fields | FK Relationships |
|-------|------------|------------------|
| `souls` | `id`, `name`, `description`, `principles`, `decision_style`, `collaboration_style`, `failure_handling_style`, `escalation_style`, `is_active` | Referenced by `agents.soul_id` |
| `agents` | `id`, `name`, `description`, `role`, `system_prompt`, `soul_id`, `llm_provider`, `model`, `temperature`, `max_tokens`, `memory_policy` (JSON), `context_policy` (JSON), `handoff_policy` (JSON), `is_active` | `soul_id` → `souls`; referenced by 10+ tables |
| `tools` | `id`, `name` (UNIQUE), `description`, `tool_type`, `config` (JSON), `is_active` | Referenced by `agent_tools` |
| `agent_tools` | `agent_id`, `tool_id` (composite PK) | → `agents`, → `tools` |
| `agent_contexts` | `id`, `agent_id`, `title`, `context_type`, `content`, `priority`, `is_active` | `agent_id` → `agents` |
| `agent_memories` | `id`, `agent_id`, `memory_type`, `content`, `source`, `importance`, `status`, `last_accessed_at` | `agent_id` → `agents` |
| `agent_feedback` | `id`, `run_id`, `agent_id`, `trace_event_id`, `rating`, `feedback_text`, `feedback_type` | → `runs`, → `agents`, → `trace_events` |
| `agent_evaluations` | `id`, `run_id`, `agent_id`, `evaluator_type`, `scores` (JSON), `issues` (JSON), `recommendations` (JSON) | → `runs`, → `agents` |
| `proposed_memories` | `id`, `agent_id`, `source_feedback_id`, `source_evaluation_id`, `memory_type`, `content`, `importance`, `status`, `approved_at`, `rejected_at` | → `agents`, → `agent_feedback`, → `agent_evaluations` |
| `learning_events` | `id`, `run_id` (nullable), `agent_id`, `event_type`, `source_type`, `source_id`, `content`, `status` | → `runs` (nullable), → `agents` |
| `agent_executions` | `id`, `run_id`, `agent_id`, `agent_name_snapshot`, `status`, `sequence_index`, `started_at`, `ended_at`, `elapsed_ms`, `input_payload` (JSON), `output_payload` (JSON), `error_message`, `provider`, `model`, `temperature`, `config_snapshot` (JSON) | → `runs`, → `agents` |
| `agent_execution_events` | `id`, `execution_id`, `run_id`, `agent_id`, `event_type`, `payload` (JSON) | → `agent_executions`, → `runs`, → `agents` |
| `token_usage` | `id`, `run_id`, `execution_id`, `agent_id`, `provider`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `estimated_cost`, `raw_usage` (JSON) | → `runs`, → `agent_executions`, → `agents` |
| `workflows` | `id`, `name`, `description`, `workflow_type`, `graph_config` (JSON), `is_active` | Referenced by `runs.workflow_id` |
| `runs` | `id`, `workflow_id`, `input` (JSON), `output` (JSON), `status`, `config_snapshot` (JSON), `started_at`, `ended_at`, `archived_at` | → `workflows`; referenced by 8 tables |
| `trace_events` | `id`, `run_id`, `event_type`, `agent_id` (nullable), `payload` (JSON) | → `runs`, → `agents` (nullable) |
| `experiments` | `id`, `name`, `description`, `task_prompt`, `agent_ids` (JSON), `evaluation_config` (JSON), `archived_at` | Referenced by `experiment_runs` |
| `experiment_runs` | `id`, `experiment_id`, `run_ids` (JSON), `comparison_result` (JSON) | → `experiments` |

**No enum types in models** -- all type-like fields (`status`, `event_type`, `memory_type`, etc.) are plain `String` columns. Enum constraints exist at the Pydantic schema level via `Literal`.

**Computed/defaults**: `Agent.__init__` applies sentinel defaults for provider/model/temperature/max_tokens/policies. `ProposedMemory` has `source_type`, `source_summary`, and `source_run_id` computed properties that traverse FKs.

## Current API Endpoints

- **Health**: `GET /health`
- **Souls**: `GET /souls`, `POST /souls`, `GET /souls/{id}`, `PUT /souls/{id}`, `DELETE /souls/{id}`
- **Agents**: `GET /agents`, `POST /agents`, `GET /agents/{id}`, `PUT /agents/{id}`, `DELETE /agents/{id}`
- **Agent tools**: `GET /agents/{agent_id}/tools`, `POST /agents/{agent_id}/tools/{tool_id}`, `DELETE /agents/{agent_id}/tools/{tool_id}`
- **Tools**: `GET /tools`, `POST /tools`, `GET /tools/{id}`, `PUT /tools/{id}`, `DELETE /tools/{id}?force=true`
- **Contexts**: `GET /agents/{agent_id}/contexts`, `POST /agents/{agent_id}/contexts`, `PUT /agents/{agent_id}/contexts/{context_id}`, `DELETE /agents/{agent_id}/contexts/{context_id}`
- **Memories**: `GET /agents/{agent_id}/memories`, `POST /agents/{agent_id}/memories`, `PUT /agents/{agent_id}/memories/{memory_id}`, `DELETE /agents/{agent_id}/memories/{memory_id}`
- **Proposed Memories**: `GET /agents/{agent_id}/proposed-memories`, `POST /agents/{agent_id}/proposed-memories/{memory_id}/approve`, `POST /agents/{agent_id}/proposed-memories/{memory_id}/reject`
- **Notifications**: `GET /proposed-memory-notifications`
- **Learning -- Human Feedback**: `POST /runs/{run_id}/agents/{agent_id}/feedback`
- **Learning -- Evaluations**: `POST /runs/{run_id}/agents/{agent_id}/evaluate`
- **Learning -- Reflection**: `POST /runs/{run_id}/agents/{agent_id}/reflect`
- **Learning -- Reviewer Feedback**: `POST /runs/{run_id}/agents/{target_agent_id}/review` (request body: `{reviewer_agent_id, trace_event_id?}`)
- **Workflows**: `GET /workflows`, `POST /workflows`, `GET /workflows/{id}`, `PUT /workflows/{id}`, `DELETE /workflows/{id}`, `POST /workflows/{id}/run`
- **Runs**: `GET /runs?include_archived=true`, `GET /runs/{id}`, `POST /runs/{id}/archive`, `POST /runs/{id}/activate`, `DELETE /runs/{id}/hard-delete`, `GET /runs/{id}/trace`
- **Observatory**: `GET /runs/{id}/monitor`, `GET /runs/{id}/executions`, `GET /runs/{id}/executions/{exec_id}`, `GET /runs/{id}/executions/{exec_id}/events`, `GET /runs/{id}/token-usage`, `GET /agents/{agent_id}/evolution`, `GET /agents/{agent_id}/performance-summary`
- **Experiments**: `GET /experiments?include_archived=true`, `POST /experiments`, `GET /experiments/{id}`, `DELETE /experiments/{id}?force=true`, `POST /experiments/{id}/archive`, `POST /experiments/{id}/activate`, `POST /experiments/{id}/run`
- **Demo**: `POST /demo/seed`, `DELETE /demo/seed`
- **Admin**: `POST /admin/cleanup-lab-data`

## Current Workflow Runtime Behavior

1. A workflow run accepts a task via `POST /workflows/{workflow_id}/run`.
2. Only `sequential` workflows are functional; `supervisor` and `handoff_swarm` are placeholders (raise `ValueError`).
3. `WorkflowRunner.start()` validates the workflow and agents, creates a Run with a full config snapshot (workflow + all participating agent configs), emits `run_started` and `workflow_loaded` trace events, and pre-creates `AgentExecution` records for each agent in `graph_config.agent_sequence`.
4. `WorkflowRunner.execute_run()` iterates agents in sequence:
   - Loads or creates execution record; emits `agent_selected`.
   - Calls `ContextAssembler.assemble()` which builds a 9-section prompt:
     1. Platform safety and execution rules
     2. Soul/persona
     3. Agent role
     4. System prompt
     5. Agent-specific context entries (active, ordered by priority)
     6. Agent-specific retrieved memory (active, ordered by importance desc)
     7. Workflow-level shared context
     8. Current task
     9. Output format instruction
   - Context assembly is scoped by `agent_id` — cross-agent context/memory leakage is prevented.
   - Emits `context_assembled`, `memory_retrieved` trace + execution events.
   - Calls `provider.generate()` with assembled prompt and agent config.
   - Records token usage via `observatory_service.record_token_usage()`.
   - Completes execution with `agent_output`, `memory_proposed`, `memory_write_proposed` events.
   - Passes the agent's output as `current_task` to the next agent (chain-of-agents pattern).
5. Run is marked `completed` with `final_output` as last agent's content and `agent_outputs` array.
6. `fail_run()` fails all queued/running executions and marks run as `failed`.
7. Config snapshots taken at run start enable deterministic replay/comparison.

## Current Learning Loop Behavior

### Human Feedback Path

```
Run output → human feedback (POST .../feedback) → reflection (POST .../reflect)
→ proposed memory (status=pending) → manual approve/reject
→ active AgentMemory (if approved) → future ContextAssembler retrieves it
→ re-run shows behavioral change
```

- Feedback is scoped to `run_id` + `agent_id`.
- Reflection service: calls LLM via provider if real provider configured; falls back to mock on parse failure. Accepts JSON in markdown fences.
- Proposed memories reference `source_feedback_id` (human feedback) or `source_evaluation_id` (evaluation).
- Approval creates active `AgentMemory`; rejection does not.
- `GET /proposed-memory-notifications` counts only pending proposed memories linked to feedback or evaluation sources.
- Notification badges displayed in sidebar and agent cards via `NotificationContext`.

### Reviewer Feedback Path (PR #7)

```
Run output → reviewer agent selected → POST /runs/{run_id}/agents/{target_agent_id}/review
→ reviewer LLM derives criteria from target definition, evaluates, applies quality/risk checks
→ produces AgentEvaluation (scores, derived_criteria, quality_checks, risk_flags, memory_decision)
→ optionally creates ProposedMemory if memory_decision is "corrective" or "refinement"
```

- `ReviewService` (`backend/app/services/review_service.py`): builds review prompt from target agent's full definition (role, system_prompt, soul, contexts, memories, tools), reviewer agent's system_prompt + review_methodology contexts, task input, and actual output.
- Mock reviewer: signal-detection logic — checks output for order IDs, chargeback keywords, escalation mentions, refund caution, specificity. "PERFECT" keyword triggers `memory_decision: "none"`.
- Real LLM reviewer: calls provider, parses JSON, repairs truncated/malformed JSON with 3-attempt repair strategy.
- Evaluation stored with `evaluator_type = "agent_reviewer"`. Reviewer identity stored in `issues._meta` (reviewer_agent_id, reviewer_agent_name, memory_decision).
- Three memory decisions: `corrective` (high importance, agent made errors), `refinement` (medium importance, minor improvements), `none` (no memory created).
- Response includes `reviewed_execution_id`, `reviewed_output`, `reviewed_target_agent_name`, `reviewer_agent_name`, and `proposed_memory` (nullable).
- Frontend: `ReviewerFeedbackSection` component on Run Detail page with reviewer selector, collapsible results (derived criteria PASS/FAIL, quality checks, risk flags, memory decision badge, proposed memory card), and approve/reject actions.

### Rubric Validation

- Human evaluations require all 9 EVALUATION_RUBRIC keys: `task_completion`, `persistence`, `collaboration`, `evidence_discipline`, `tool_usage_quality`, `handoff_quality`, `customer_readiness`, `safety`, `clarity`.
- Agent reviewer evaluations skip the rigid rubric; scores can be any keys (dynamic). Values must still be 1-5.

## Current Memory Lifecycle

- `AgentMemory.status`: `pending` (default), `active`, `rejected`, `archived`.
- `ProposedMemory.status`: `pending` (default) → `approved` or `rejected`.
- Memory policy defaults: `{"write_mode": "manual_review", "retrieval_enabled": true}`.
- Only `status="active"` memories are retrieved by `ContextAssembler`.
- Memory CRUD is scoped by `agent_id` — cross-agent operations return 404.
- Run archiving preserves all feedback, evaluations, proposed memories, learning events, trace events, execution records, and token usage. Activating a run restores it without changing learning records.
- Hard delete is blocked when learning records exist.
- Vector search/upsert are Qdrant adapter stubs awaiting an embedding provider.

## Current Demo Seed Behavior

`POST /demo/seed` idempotently creates:
- 4 souls (Triaging Analyst, Policy Gatekeeper, Empathetic Communicator, Quality Auditor)
- 4 agents (Escalation Triage, Policy Guardrail, Customer Response Writer, Escalation Quality Reviewer — role=`quality-reviewer`)
- 3 agents in the sequential workflow (Triage → Guardrail → Writer); reviewer is NOT in workflow
- Contexts and memories per agent definition
- Workflow: "Demo:Customer Escalation Recovery Workflow"
- No runs, feedback, or proposed memories
- Re-seeding restores original values if content was modified
- Two complaint texts and feedback text available in demo data
- Acceptance checklist with 7 items

The reviewer agent (4th agent) has `role="quality-reviewer"`, `context_type="review_methodology"` context entries (Universal Quality Checklist, Risk & Safety Checklist), and an active memory about common escalation triage gaps. Not part of the workflow — intended for post-run reviewer evaluation.

CLI seed alternative: `python backend/scripts/seed_demo.py`.

## What Phase 2 Proves

1. **Real LLM integration works**: OpenAI-compatible provider calls real LLMs through the provider abstraction; mock provider stays deterministic for tests.
2. **Learning loop is complete**: Human feedback → reflection → proposed memory → approve → active memory → re-run shows behavioral change.
3. **Agent-to-agent review works**: Reviewer agent evaluates target agent's output using dynamically derived criteria, stores structured evaluation, and optionally generates proposed memories.
4. **Observatory is comprehensive**: Every step (context assembly, memory retrieval, LLM call, token usage, execution lifecycle) is traced and queryable.
5. **Isolation holds**: Cross-agent context/memory leakage is prevented at the service, context assembler, and API levels.
6. **Demo is reproducible**: Idempotent seed + deterministic mock mode enables repeatable acceptance testing.
7. **Frontend is complete**: All CRUD, runtime, learning, review, and demo flows have React UIs with proper error/loading/empty states.

## Known Issues / Limitations

1. **Vector embedding search and Qdrant upsert** are adapter shells, not semantic retrieval (awaiting embedding provider).
2. **Real OpenAI, Anthropic, and Ollama providers** remain `NotImplementedError` placeholders — only `mock` and `openai_compatible` are functional.
3. **Supervisor and handoff swarm workflows** are placeholders. `HandoffEngine` exists but is not integrated into a workflow runner.
4. **Before/after learning comparison** is manual; no dedicated comparison dashboard.
5. **Runtime monitoring is polling-based** (2s interval); no WebSocket streaming.
6. **Run hard delete** is gated behind archive + safety checks; learning-preserving archive is the default cleanup path.
7. **No Alembic migrations** — `database.py` uses inline column inspection + ALTER TABLE for schema evolution.
8. **No authentication, authorization, multi-user isolation**, or production deployment setup.
9. **Frontend E2E tests** require a running backend and local services; no containerized one-command stack.
10. **No `frontend/.env.example`** — new developers must create `.env.local` manually (or rely on Vite defaults).

## What Must Not Be Changed Accidentally

- **Agent isolation rules** — context, memory, tools, and prompt assembly must remain scoped by `agent_id`.
- **Soul/persona must not be auto-rewritten** — soul updates require explicit user action.
- **Tool Gateway 3-layer authorization** — registry check, DB tool check, agent-tool assignment check must all pass.
- **Config snapshots at run start** — must capture full workflow+agent config for reproducibility.
- **Archiving semantics** — archive must hide from default lists but preserve all learning and observatory records.
- **Delete safety** — agents deleted only when no run history; workflows deleted only when no runs; souls/tools deleted only when no active references; experiments force-deleted only with `?force=true`.
- **Mock provider determinism** — the mock provider must never be changed in a way that breaks test determinism.
- **Demo seed idempotency** — re-seeding must restore original values and produce same IDs.

## Verification Status (2026-05-30)

| Check | Result |
|-------|--------|
| Backend pytest | 123 passed, 0 failed, 0 skipped (2.59s) |
| Frontend lint | Passed (eslint --max-warnings 0) |
| Frontend typecheck | Passed (tsc --noEmit) |
| Frontend build | Passed (vite build, 1.36s) |

## Recommended Phase 3 Starting Point

1. Assess priority of supervisor/handoff-swarm workflow types per user needs.
2. Implement WebSocket-based live monitoring as an alternative to polling.
3. Wire up an embedding provider to enable semantic vector search/upsert through Qdrant.
4. Implement at least one more real provider (OpenAI or Anthropic) depending on user preference.
5. Add before/after comparison dashboard for learning experiments.
6. Set up Alembic for proper database migrations.
7. Containerize the full stack (backend + frontend + PostgreSQL + Qdrant) for one-command E2E testing.
8. Assess whether multi-user isolation / auth is needed for the next milestone.
