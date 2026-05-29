# AGENTS.md — Agent Swarm Lab Development Guide

## What This Project Is

Agent Swarm Lab is an **Agent Studio** — not a chatbot. It is a platform for creating, configuring, running, observing, and improving independent AI agents.

Users can:
- Create and maintain agents with their own LLM provider, model, temperature, max tokens, soul/persona, context, memory, and tools
- Compose agents into workflows and run real tasks with real LLMs
- Observe each agent's inputs, outputs, context, memory, tools, token usage, and trace events
- Provide human feedback on agent outputs, or have another agent review the output
- Convert feedback/evaluations into proposed memories, approve them into active agent memory
- Re-run similar tasks and observe whether the agent's behavior improves

## Current Phase: Phase 3 (Starting)

Phase 1 and Phase 2 are complete. Branch: `feature/phase3`.

Verification baseline (2026-05-30): 123 backend tests pass, frontend lint/typecheck/build pass.

Key deliverables carried into Phase 3:
- Real LLM runtime through `openai_compatible` provider (OpenAI SDK); mock provider stays deterministic for tests.
- Complete learning loop: human feedback → reflection → proposed memory → approval → re-run → behavioral change.
- Dynamic reviewer feedback: an agent can evaluate another agent's output against dynamically derived criteria.
- Customer Escalation Recovery demo with idempotent seed/cleanup.
- Runtime observatory: full traceability for every execution step.
- 56-function typed frontend API client, 30 TypeScript interfaces, 8 pages, Playwright E2E.

## Rules

- All documentation and code comments must be written in English.
- Do not commit `.env` files or secrets.
- Do not commit screenshots, videos, traces, temp files, or generated artifacts.
- Use project-specific skills under `.claude/skills/`.
- Agent isolation is the default.
- Every runtime or backend behavior change must include or update tests.
- Run relevant tests before committing.

### Critical "Do Not" Rules

1. **Do not add new backend APIs if existing APIs already support the frontend need.**
2. **Do not add new agent form fields unless clearly justified by a feature requirement.**
3. **Do not add an `agent_type` field unless clearly justified** — the platform identifies agents by role convention (`role="quality-reviewer"`), not fixed enums.
4. **Do not change soul/persona automatically** — soul updates require explicit user action.
5. **Do not touch unrelated code** — scope changes to the feature at hand.
6. **Test-created records must use TEST or E2E prefixes** in names to distinguish from user-created or demo seed data.
7. **Clean up only data created during the task. Do not delete user-created or demo seed data.**
8. **Frontend actions must never fail silently** — show loading, success, and error states.

## Architecture Principles

- Each agent is an independent entity.
- Agents must not share private context or private memory by default.
- Context retrieval must be scoped by `agent_id`.
- Memory retrieval must be scoped by `agent_id`.
- Agent-to-agent information transfer must happen only through explicit workflow output or handoff payload.
- Approved memory affects only the target agent.
- Feedback-derived and reviewer-derived memories must remain pending until approved.
- Soul/persona must not be automatically rewritten.
- Tools must be assigned per agent. Inactive tools must not be selectable for new assignments.
- Runtime history and learning history should be preserved by default.
- Prefer archive/deactivate over unsafe hard delete when dependencies exist.
- Soul/persona and system prompt must be stored and handled separately.
- Workflow definitions must be separate from agent definitions.
- Tool access must go through Tool Gateway (3-layer authorization: registry + DB + assignment).
- Every run must save trace events and config snapshots for reproducibility.
- Reviewer agents are identified by role convention (`role="quality-reviewer"`) and context entries (`context_type="review_methodology"`), not by a fixed `agent_type` enum.

## Frontend Conventions

The active frontend is in `frontend/` (Vite + React + TypeScript + Tailwind CSS + shadcn/ui).

- Use consistent CRUD patterns: list/create/edit/detail pages, confirmation dialogs, visible loading/success/error states, status badges, empty states.
- Use collapsible JSON for advanced config and trace payloads (`JsonCollapse`, `JsonCollapseList`).
- Use contextual field help (`FieldHelp` with `tooltip` or `popover` pattern) only for complex fields — not every field needs it.
- No silent failures — every mutation must show loading, success, or error feedback.
- Notification badges for pending proposed memories use amber pill styling; count comes from `NotificationContext`.
- Reviewer feedback results use collapsible sections: derived criteria (PASS/FAIL with source), quality checks, risk flags (PASS/FAIL/FLAG), memory decision badge, proposed memory card.
- Form pattern: react-hook-form + zod resolver. JSON policy/config fields stored as strings and parsed via `parseJsonObject` before submit.
- API errors propagate through `ApiError` class with status and body.

## Backend Conventions

- `app/models/` — SQLAlchemy ORM models (11 files, 18 tables, no enum types).
- `app/schemas/` — Pydantic request/response models with `Base/Create/Update/Read` layering (14 files, 63 models).
- `app/services/` — Business logic, scoped queries, transactions.
- `app/api/` — FastAPI routers, thin handlers delegating to services (14 routers).
- `app/runtime/` — Provider interface, provider implementations, provider factory, context assembler, workflow runner, handoff engine.
- `app/memory/` — Vector store abstraction (Qdrant adapter, disabled store null object).
- `app/tools/` — Tool Gateway, tool registry (ExecutableTool protocol), Tavily search wrapper.

## Testing Expectations

For any meaningful feature change:
- Run backend tests: `cd backend && .venv/bin/pytest -q` (123 tests, must pass).
- Run frontend lint: `cd frontend && npm run lint` (eslint --ext .ts,.tsx --max-warnings 0).
- Run frontend typecheck: `cd frontend && npm run typecheck` (tsc --noEmit).
- Run frontend build: `cd frontend && npm run build`.
- Run E2E tests when UI flow changes: `cd frontend && npx playwright test`.
- Clean up test data and artifacts after testing.
- Do not commit `.env`, screenshots, videos, traces, temp files, or generated test artifacts.
- Test-created records must use TEST or E2E prefixes.

## Stack

**Frontend**: Vite + React, TypeScript, Tailwind CSS, shadcn/ui, react-hook-form, zod, Playwright
**Backend**: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.x, PostgreSQL 16, Qdrant, OpenAI SDK, pytest with in-memory SQLite
**Infrastructure**: Docker Compose (postgres:16-alpine, qdrant/qdrant, adminer)

## Key File Locations

| Area | Path |
|------|------|
| Backend entry | `backend/app/main.py` |
| Backend config | `backend/app/config.py` |
| Database | `backend/app/database.py` |
| Models | `backend/app/models/` (11 files, 18 tables) |
| Schemas | `backend/app/schemas/` (14 files, 63 models) |
| API routers | `backend/app/api/` (14 routers) |
| Services | `backend/app/services/` |
| Runtime | `backend/app/runtime/` |
| Tool gateway | `backend/app/tools/gateway.py` |
| Vector store | `backend/app/memory/` |
| Tests | `backend/tests/` (16 files, 123 tests) |
| Demo seed | `backend/scripts/seed_demo.py` |
| Frontend entry | `frontend/src/main.tsx` + `frontend/src/App.tsx` |
| Frontend pages | `frontend/src/pages/` (7 pages) |
| Shared components | `frontend/src/components/shared/` (10 components) |
| UI primitives | `frontend/src/components/ui/` (7 primitives) |
| API client | `frontend/src/lib/api.ts` (56 functions) |
| TypeScript types | `frontend/src/lib/types.ts` (30 interfaces) |
| Notification context | `frontend/src/lib/NotificationContext.tsx` |
| E2E tests | `frontend/e2e/frontend.spec.ts` |
| Docker compose | `docker-compose.yml` |
| Env template | `.env.example` |

## Reference Docs

- Full project state, data models, API endpoints, runtime flow: `docs/PROJECT_STATE.md`
- Phase 2 completion summary and tech debt: `docs/PHASE_2_COMPLETION_SUMMARY.md`
- Phase 3 pre-audit notes: `docs/PHASE_3_PRE_AUDIT_NOTES.md`
- Historical milestones: `docs/MILESTONE_HISTORY.md`
- Architecture principles: `docs/architecture.md`
- Agent isolation rules: `docs/agent-isolation.md`
- Agent learning loop: `docs/agent-learning-loop.md`
- Runtime observatory: `docs/agent-runtime-observatory.md`
- Workflow runtime: `docs/workflow-runtime.md`
- Reviewer feedback design: `docs/DYNAMIC_REVIEWER_FEEDBACK_DESIGN.md`
- Memory and context: `docs/memory-and-context.md`
- Experiment design: `docs/experiment-design.md`
- Setup guide: `docs/setup.md`
- Manual E2E test guide: `docs/MANUAL_E2E_TEST_GUIDE.md`
- Reviewer feedback manual test: `docs/REVIEWER_FEEDBACK_MANUAL_TEST.md`
