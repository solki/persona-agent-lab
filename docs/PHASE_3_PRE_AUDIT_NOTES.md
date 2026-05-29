# Phase 3 Pre-Audit Notes

Date: 2026-05-30 | Branch: `feature/phase3` | Base: `main`

## Current State Summary

Phase 2 is complete and stable. All 123 backend tests pass (0 failures, 0 skipped, 2.65s). Frontend lint (0 errors, 0 warnings), typecheck (clean), and production build (clean) all pass. E2E Playwright suite covers the full CRUD + learning + reviewer + demo flows.

The platform has 18 database tables, 13 API routers, 63 Pydantic schemas, 56 frontend API functions, and 30 TypeScript interfaces. Two LLM providers are functional (`mock` and `openai_compatible`); three are placeholders (`openai`, `anthropic`, `ollama`). One workflow type is functional (`sequential`); two are placeholders (`supervisor`, `handoff_swarm`). Vector search is a Qdrant adapter stub.

## What Works

### Core Platform (solid, low risk)
- Agent CRUD with soul attachment, policy configuration, tool assignment
- Soul CRUD with persona fields and FieldHelp tooltips
- Tool CRUD with assignment/unassignment and force-delete
- Workflow CRUD with agent sequence picker
- Sequential workflow execution with config snapshots, trace events, and execution records
- Run list/detail/monitor with archive/activate lifecycle
- Experiment CRUD with comparison runs, archive/activate, force-delete
- Context and memory CRUD scoped by agent_id -- isolation verified in tests
- Delete-blocking safety: souls blocked while referenced by agents, tools blocked while assigned, workflows blocked while runs exist, agents blocked while run history exists, experiments blocked while runs exist (force-delete available)

### Learning (solid, medium surface area)
- Human feedback creation scoped to run + agent
- Reflection: LLM call with mock fallback on parse failure; JSON in markdown fences handled
- Proposed memory approval/rejection with notification counts
- Approved memory becomes active and is retrieved by ContextAssembler in future runs
- Cross-agent isolation verified for all learning artifacts

### Reviewer Feedback (solid, complex)
- `ReviewService` with prompt construction, real/mock LLM review, 3-attempt JSON repair
- `POST /runs/{run_id}/agents/{target_agent_id}/review` with `ReviewRequest`/`ReviewResponse`
- Mock reviewer: signal-detection logic with conditional pass/fail based on keyword presence
- Real LLM reviewer: structured JSON output with derived criteria, quality checks, risk checks, memory decision
- 23 tests covering corrective/none paths, error cases, JSON parsing/repair edge cases
- Frontend `ReviewerFeedbackSection` with collapsible results and approve/reject

### Demo & Admin (solid, low maintenance)
- Idempotent demo seed (4 souls, 4 agents, contexts, memories, sequential workflow)
- Reviewer agent seeded with `review_methodology` context entries but NOT in workflow
- Admin cleanup deletes all lab data across 18 tables in correct FK order
- Adminer available at port 8080 for local DB inspection

### Observability (solid, low risk)
- Agent executions, execution events, token usage capture at every step
- Monitor endpoint with polling-based live view
- Execution detail with assembled context and retrieved memory
- Agent evolution and performance summary endpoints
- Learning events for all feedback/evaluation/memory operations

## What Needs Attention

### Stale Documentation (low effort, should fix early in Phase 3)

| File | Issue |
|------|-------|
| `docs/MILESTONE_HISTORY.md` | "What Remains Incomplete" says "Seed data scripts are not present" (false -- `backend/scripts/seed_demo.py` exists) and "Frontend has no automated tests" (false -- Playwright E2E exists) |
| `docs/NEXT_SESSION_PROMPT.md` | Prompt template for Milestone 9 (completed). Either delete or replace with Phase 3 prompt. |
| `docs/setup.md` | References non-existent `frontend/.env.example` at line 22. Either create the file or update the docs. |
| `docs/architecture.md` | Milestone narrative stops at Milestone 8. Add M9, M10, Phase 2 milestones. |
| `docs/agent-learning-loop.md` | Does not mention reviewer feedback path. Add a section or cross-reference. |
| `docs/DYNAMIC_REVIEWER_FEEDBACK_DESIGN.md` | Design doc with milestone plan (M1-M4). Annotate which milestones were completed vs deferred. |

### Known Limitations Carried Forward (from Phase 2)

| Limitation | Severity | Phase 3 Priority |
|------------|----------|------------------|
| No Alembic migrations | Medium | Should address before adding more columns |
| Supervisor/handoff swarm placeholders | Medium | Depends on user priority |
| Real OpenAI/Anthropic/Ollama stubs | Low-Medium | Depends on user provider preference |
| Vector search not implemented (no embedding provider) | Medium | Blocked on embedding provider decision |
| WebSocket monitoring not implemented | Low | Enhancement, not blocking |
| No before/after comparison dashboard | Low | Enhancement |
| No containerized full-stack E2E | Low-Medium | Would simplify CI |
| Frontend JS chunk >500 kB | Low | Code-splitting optimization |
| No `frontend/.env.example` | Low | Quick fix |

## Integration Cascade Risks

When modifying these areas, be aware of downstream impacts:

### 1. Agent Model Changes
- Touching `backend/app/models/agent.py` affects: context assembler, workflow runner, all API routers, all tests, frontend forms, frontend types, demo seed, admin cleanup.
- Adding a column: needs migration (currently inline ALTER TABLE). Schema update in `agents.py`. Frontend form + types update.
- Adding a policy field: needs default function in models, schema update, frontend JSON editor handling, demo seed values, test assertions.

### 2. Context Assembler Changes
- `backend/app/runtime/context_assembler.py` is the single point where agent prompts are built. Changes affect every workflow run, every experiment run, and the reviewer prompt (which uses its own construction in `review_service.py`, not the ContextAssembler).
- The 9-section prompt structure (platform rules, soul, role, system prompt, context, memory, shared context, task, output format) is load-bearing for determinism tests.
- If you change section order or formatting, update `test_context_assembler.py` and `test_workflow_runtime.py`.

### 3. Provider Interface Changes
- `backend/app/runtime/provider_interface.py` is the contract for all 5 provider implementations.
- Adding a new method to `ProviderInterface`: must implement in all 5 providers or provide a default in the base class.
- Changing `generate()` signature: breaks workflow runner, reflection service, review service.

### 4. Schema Validation Changes
- `backend/app/schemas/learning.py` `validate_scores` has conditional logic for `evaluator_type == "agent_reviewer"` vs default. Changes here affect both human evaluation and reviewer evaluation paths.
- The 9-key `EVALUATION_RUBRIC` set is used in validation. Adding/removing keys breaks existing evaluations.

### 5. Workflow Runner Changes
- `backend/app/runtime/workflow_runner.py` currently only supports `sequential`. Adding `supervisor` or `handoff_swarm` requires routing logic in `start()` and new execution strategies.
- Config snapshot logic (`_config_snapshot()`) must capture whatever new config is needed for the new workflow type.

### 6. Demo Seed Changes
- `backend/app/services/demo_service.py` and `backend/scripts/seed_demo.py` define identical agent definitions. Changes must be kept in sync.
- Demo seed idempotency relies on name matching. Changing agent/soul/workflow names breaks re-seeding.
- Frontend `DemoPage.tsx` checklist and instructions must stay in sync with actual demo entities.

### 7. Frontend API Client Changes
- `frontend/src/lib/api.ts` has 56 functions. Adding a new endpoint requires: api.ts function + types.ts interface + page component changes.
- Backend route changes must be reflected in api.ts path strings.

## Risk Areas -- Files to Be Careful With

### High Risk (complex, load-bearing, 20+ tests depend on)

| File | Lines | Why Risky |
|------|-------|-----------|
| `backend/app/services/review_service.py` | 768 | Complex prompt construction, mock signal-detection logic with 10+ keyword checks, 3-attempt JSON repair with stack tracking, conditional memory creation. 23 tests enforce specific behavior. |
| `backend/app/runtime/workflow_runner.py` | 279 | Orchestrates every run. Trace event sequence is load-bearing for 4 test files. Config snapshot format is load-bearing for isolation tests. |
| `backend/app/runtime/context_assembler.py` | 99 | 9-section prompt assembly. Determinism tests require exact prompt equality. Every agent execution depends on it. |
| `backend/app/services/demo_service.py` | ~500 | Idempotency by name matching. Reviewer agent seeded with specific context_type values. Acceptance checklist embedded. |
| `backend/app/api/learning.py` | ~300 | 6 endpoints with FK validation, error handling. Reviewer endpoint validates participation via config snapshot + trace event fallback. |
| `backend/app/schemas/learning.py` | 150 | Conditional rubric validation. ReviewRequest/ReviewResponse/ReflectionRequest schemas with field validators. |

### Medium Risk (important but more isolated)

| File | Lines | Why Risky |
|------|-------|-----------|
| `backend/app/runtime/openai_compatible_provider.py` | 73 | Production LLM calls. `_readable_error` truncation (500 chars). Token usage extraction from OpenAI response. |
| `backend/app/runtime/provider_factory.py` | 37 | Provider routing table. Missing credentials detection. |
| `backend/app/database.py` | 62 | Inline migration helper `_ensure_local_schema_columns`. Adding a column: add to model, add to this function. |
| `backend/app/tools/gateway.py` | 81 | 3-layer auth (registry+DB+assignment). Trace/execution event persistence. |
| `frontend/src/pages/RunsPage.tsx` | ~400 | ReviewerFeedbackSection with reviewer selector, collapsible results, approve/reject. LearningFeedbackSection with rating picker, reflect. |
| `frontend/src/pages/AgentsPage.tsx` | ~500 | AgentEditor with ContextManager, MemoryManager, ToolAssignmentManager, ProposedMemoryManager sub-components. Notification badge logic. |
| `frontend/src/lib/NotificationContext.tsx` | ~40 | Shared notification state. Used by sidebar badge, agent cards, proposed memory manager, feedback sections. |

### Low Risk (stable, minimal dependencies)

| File | Notes |
|------|-------|
| `backend/app/models/*.py` | 10 files, all stable. No enum migration needed. Adding columns is routine. |
| `backend/app/api/{health,souls,tools,contexts,memories,workflows,runs,experiments,observatory,admin,demo}.py` | Thin handlers. Changes are usually mechanical. |
| `frontend/src/components/shared/*.tsx` | Stable component library. Changes propagate broadly but are unlikely to break. |
| `frontend/src/components/ui/*.tsx` | shadcn/ui primitives. Do not modify lightly -- they follow a convention. |

## Scope Boundaries for Phase 3

### In-scope candidates (ordered by typical priority)
1. Alembic migration setup
2. Embedding provider + Qdrant vector search/upsert activation
3. Real OpenAI or Anthropic provider implementation
4. Supervisor workflow runtime
5. WebSocket live monitoring
6. Before/after comparison dashboard
7. Containerized full-stack E2E
8. Multi-user isolation / auth (if needed)

### Out-of-scope (do not start without explicit decision)
- Automatic soul/persona rewriting
- Full LangGraph swarm integration
- File upload / image / multimodal input
- RAG retrieval from external documents
- Large-scale benchmark system
- Production deployment setup (k8s, cloud)
- Handoff swarm workflow runtime (complex, should follow supervisor)
- Real-time collaboration / multi-user editing

### Guardrails
- Do not add new backend APIs if existing APIs support the frontend need. Reuse endpoints.
- Do not add new agent form fields unless a feature clearly requires them.
- Do not add `agent_type` field -- the platform uses role convention + context_type.
- Do not change soul/persona automatically -- explicit user action only.
- Do not touch unrelated code -- scope each change to its feature.
- Test-created records must use TEST or E2E prefixes.
- Clean up only task-created data. Do not delete user-created or demo seed data.
- Run the full test suite before committing: `cd backend && .venv/bin/pytest -q` (123 tests), `cd frontend && npm run lint && npx tsc --noEmit && npm run build`.

## Files Most Likely to Change in Phase 3

Based on common Phase 3 priorities:

**If implementing Alembic:**
- `backend/app/database.py` (remove inline migration helper)
- `backend/alembic/` (new directory)
- `backend/alembic.ini` (new file)

**If implementing embedding provider:**
- `backend/app/memory/qdrant_store.py` (implement search/upsert)
- `backend/app/memory/vector_store.py` (no changes needed -- contracts defined)
- `backend/app/config.py` (embedding provider config fields)
- `backend/app/services/` (new embedding service)

**If implementing another real provider:**
- `backend/app/runtime/openai_provider.py` or `backend/app/runtime/anthropic_provider.py` (replace stub)
- `backend/app/runtime/provider_factory.py` (update routing)
- `backend/app/config.py` (add provider-specific config)
- `backend/tests/test_provider_factory.py` (add tests)

**If implementing supervisor workflow:**
- `backend/app/runtime/workflow_runner.py` (add supervisor execution strategy)
- `backend/app/models/workflow.py` (possibly extend graph_config convention)
- `backend/app/schemas/workflows.py` (possibly extend)
- `backend/tests/test_workflow_runtime.py` (add supervisor tests)
- `frontend/src/pages/WorkflowsPage.tsx` (supervisor config UI)
