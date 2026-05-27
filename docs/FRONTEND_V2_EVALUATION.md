# Frontend v2 Evaluation

> **Note (May 2026):** `frontend-v2` has been promoted to the official `frontend/`. This document is retained for historical context on the evaluation that led to the migration.

## Purpose

`frontend-v2` was a proof of concept for replacing the original Persona Agent Lab frontend (Next.js) with a Vite + refine + shadcn/ui foundation. The PoC validated whether a new frontend could provide more consistent CRUD, clearer loading and error states, safer destructive actions, and easier future iteration while continuing to use the existing FastAPI backend.

The PoC has been accepted and promoted. The original Next.js frontend has been removed.

## Implemented Scope

The PoC implements a Vite React TypeScript app with:

- refine resource registration for Souls, Agents, Tools, Workflows, Runs, and Experiments.
- shadcn/ui-style local primitives for buttons, inputs, selects, cards, labels, alerts, confirmation dialogs, status badges, empty states, and collapsed JSON panels.
- React Hook Form and Zod validation for resource forms.
- A typed API client that calls the existing FastAPI routes.
- A Vite `/api` development proxy so the frontend can run on port `3000` without backend CORS changes.
- Playwright E2E coverage for the implemented flows.

Implemented pages:

- `/souls`: list, create, edit, delete unused souls, activate/deactivate referenced souls.
- `/agents`: list, create, edit, activate/deactivate, delete inactive safe agents, soul selector, provider/model fields, `is_active`, and JSON policy editors.
- `/agents/:id`: agent configuration plus scoped contexts, scoped memories, agent-tool assignment/unassignment, and proposed memory review.
- `/tools`: list, create, edit, delete unused tools, activate/deactivate assigned tools, active state, and JSON config editor.
- `/workflows`: list, create, edit, run, activate/deactivate, and delete inactive workflows that have no historical runs.
- `/runs`: active/archived/all filter, archive, activate, guarded permanent delete for archived safe runs, selected-run archive/activate, and run detail links.
- `/runs/:id`: summary, run input/output, trace events, and monitor payloads with collapsed JSON by default.
- `/experiments`: list, create, run, archive, activate, and guarded delete for safe archived experiments.

## Improvements Compared With Current Frontend

- CRUD patterns are more consistent across resources. Lists, forms, destructive actions, and status messages use shared primitives.
- JSON payloads use progressive disclosure. Trace and monitor data are collapsed by default and can be expanded when needed.
- The app has a clearer foundation for form validation. React Hook Form and Zod keep field validation close to the form while still matching backend schemas.
- The API client centralizes readable FastAPI error parsing so UI actions do not silently fail.
- Destructive and lifecycle actions use explicit confirmation dialogs for top-level resources and nested agent context/memory/tool assignment rows.
- CRUD dependency labels are consistent: `Delete` is reserved for hard delete, `Archive` hides runtime/history records while preserving evidence, `Deactivate` disables reusable configuration, and `Unassign` removes only a relationship.
- The Vite app is smaller and faster to iterate on during PoC work than the current Next.js frontend.

## Remaining Gaps

- The PoC still does not implement the complete Runtime Observatory navigation from the current frontend.
- Proposed memory creation from feedback is implemented in the frontend; the page supports review of proposed memories returned by the backend.
- The bundle currently exceeds Vite's default 500 KB chunk warning because the PoC is not code-split.
- Visual polish is functional but not final. A replacement frontend should complete responsive QA and accessibility review before migration.

## Migration Recommendation

The PoC has been accepted and promoted. The original Next.js frontend has been removed. The PoC supported continuing with this frontend as a replacement candidate, and it now serves as the official frontend.

Recommended next steps:

1. Add proposed-memory generation from run feedback if the frontend is expected to own the learning loop.
2. Add route-level code splitting and a full visual QA pass.
3. Extend the frontend observability navigation to match the monitor/executions/token usage pages.
4. The frontend is now the single default UI.

## CRUD Dependency Policy

- Configuration objects are hard-deleted only when they are unused. Referenced agents, souls, tools, and workflows are deactivated instead of forcing users through circular cleanup.
- Runtime and history objects use archive/activate by default. Runs are archived rather than deleted so traces, executions, token usage, feedback, proposed memories, and learning events remain inspectable.
- Learning-loop objects are preserved by default. Approved memories and proposed-memory chains should be archived or reviewed, not silently destroyed.
- Experiments can be archived without deleting related runs. Deleting a run does not require deleting its experiment first, and archiving an experiment does not remove its runs.
- Relationship rows use `Unassign` or `Remove`. Agent-tool unassignment removes only the join record and never deletes the agent or tool.
- Backend dependency errors are surfaced in the UI as readable warnings instead of silent failures.

## How To Run

Start backend dependencies:

```bash
docker compose up -d postgres qdrant
```

Start the backend:

```bash
cd backend
CREATE_TABLES_ON_STARTUP=true LLM_PROVIDER=mock .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

For local development, the app calls the backend through Vite proxy path `/api`. For deployed or non-proxy environments, set:

```bash
VITE_API_BASE_URL=http://your-backend-host
```

Do not put API keys or backend secrets in frontend environment variables.

## How To Test

Run static checks:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

Run Playwright E2E tests while the backend is running:

```bash
cd frontend
npm run e2e
```

The E2E tests cover:

- Soul create, edit, and delete.
- Agent create, edit, deactivate, scoped context create/edit/delete, scoped memory create/edit/delete, and delete.
- Tool create, edit, and delete.
- Workflow create/run.
- Experiment create/run/archive and blocked delete warning for experiments with related runs.
- Run detail inspection with collapsed JSON, archive, activate, selected lifecycle actions, and guarded permanent delete for safe archived runs.

The tests use unique `V2E2E` names and should clean up after themselves. If a test is interrupted, remove remaining `V2E2E` records from the local database before relying on manual data checks.
