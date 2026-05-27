# Frontend v2 Evaluation

## Purpose

`frontend-v2` is a proof of concept for replacing the current Persona Agent Lab frontend with a refine + shadcn/ui foundation. The PoC validates whether a new frontend can provide more consistent CRUD, clearer loading and error states, safer destructive actions, and easier future iteration while continuing to use the existing FastAPI backend.

The existing `frontend` app remains untouched and usable. `frontend-v2` is a separate app next to it.

## Implemented Scope

The PoC implements a Vite React TypeScript app with:

- refine resource registration for Souls, Agents, Tools, and Runs.
- shadcn/ui-style local primitives for buttons, inputs, selects, cards, labels, alerts, confirmation dialogs, status badges, empty states, and collapsed JSON panels.
- React Hook Form and Zod validation for resource forms.
- A typed API client that calls the existing FastAPI routes.
- A Vite `/api` development proxy so frontend-v2 can run on port `3100` without backend CORS changes.
- Playwright E2E coverage for the implemented flows.

Implemented pages:

- `/souls`: list, create, edit, delete.
- `/agents`: list, create, edit, delete, soul selector, provider/model fields, `is_active`, and JSON policy editors.
- `/agents/:id`: agent configuration plus scoped contexts, scoped memories, and proposed memory review.
- `/tools`: list, create, edit, delete, active state, and JSON config editor.
- `/runs`: active/archived/all filter, archive, activate, and run detail links.
- `/runs/:id`: summary, run input/output, trace events, and monitor payloads with collapsed JSON by default.

## Improvements Compared With Current Frontend

- CRUD patterns are more consistent across resources. Lists, forms, destructive actions, and status messages use shared primitives.
- JSON payloads use progressive disclosure. Trace and monitor data are collapsed by default and can be expanded when needed.
- The app has a clearer foundation for form validation. React Hook Form and Zod keep field validation close to the form while still matching backend schemas.
- The API client centralizes readable FastAPI error parsing so UI actions do not silently fail.
- Destructive actions use explicit confirmation dialogs for top-level resources and clear browser confirmations for nested agent context/memory rows.
- The Vite app is smaller and faster to iterate on during PoC work than the current Next.js frontend.

## Remaining Gaps

- The PoC does not implement Workflows, Experiments, full workflow run creation, or the complete Runtime Observatory navigation.
- Agent-tool assignment is not implemented in frontend-v2 yet.
- Proposed memory creation from feedback is not implemented in frontend-v2; the page supports review of proposed memories returned by the backend.
- Nested context and memory destructive actions currently use browser confirmation dialogs. A production migration should replace them with the shared confirmation dialog for complete consistency.
- The bundle currently exceeds Vite's default 500 KB chunk warning because the PoC is not code-split.
- Visual polish is functional but not final. A replacement frontend should complete responsive QA and accessibility review before migration.

## Migration Recommendation

The PoC supports continuing with `frontend-v2` as a replacement candidate, but it is not ready to replace the current frontend yet.

Recommended next steps:

1. Add Workflow list/create/edit/run support to frontend-v2.
2. Add Experiments support or explicitly keep it in the current frontend until later.
3. Add agent-tool assignment to Agent detail.
4. Replace nested browser confirmations with shared confirmation dialogs.
5. Add proposed-memory generation from run feedback if frontend-v2 is expected to own the learning loop.
6. Add route-level code splitting and a full visual QA pass.
7. Run both frontends side by side for one milestone before switching the default UI.

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

Start frontend-v2:

```bash
cd frontend-v2
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3100
```

For local development, the app calls the backend through Vite proxy path `/api`. For deployed or non-proxy environments, set:

```bash
VITE_API_BASE_URL=http://your-backend-host
```

Do not put API keys or backend secrets in frontend environment variables.

## How To Test

Run static checks:

```bash
cd frontend-v2
npm run lint
npm run typecheck
npm run build
```

Run Playwright E2E tests while the backend is running:

```bash
cd frontend-v2
npm run e2e
```

The E2E tests cover:

- Soul create, edit, and delete.
- Agent create, edit, deactivate, scoped context create/edit/delete, scoped memory create/edit/delete, and delete.
- Tool create, edit, and delete.
- Run detail inspection with collapsed JSON, archive, and activate.

The tests use unique `V2E2E` names and should clean up after themselves. If a test is interrupted, remove remaining `V2E2E` records from the local database before relying on manual data checks.
