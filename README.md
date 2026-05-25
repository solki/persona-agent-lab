# Agent Swarm Lab

Agent Swarm Lab is a configurable platform for creating, editing, deleting, configuring, and composing independent AI agents. Each agent owns its own model settings, soul/persona, system prompt, context entries, memory store, tool permissions, and handoff policy.

The MVP starts with mock LLM mode so the full workflow can run locally without API cost. It also includes a generic OpenAI-compatible provider for model APIs that support the OpenAI chat completions format.

Local development is self-contained. Docker Compose starts the required PostgreSQL and Qdrant services, so a new developer does not need a pre-existing local vector database.

Milestone 9 adds an agent learning loop. Users can attach feedback and optional evaluations to a run output, reflect that feedback into a pending proposed memory, manually approve or reject it, and let approved memories affect future runs through the normal agent-scoped memory retrieval path.

Milestone 10 adds an Agent Runtime Observatory. Users can monitor run status by polling, inspect agent execution records and events, review token usage, and track agent evolution over time.

## Core Architecture Rules

- Agents are isolated by default.
- There is no hidden shared global context.
- There is no hidden shared global memory.
- Tool access must go through Tool Gateway.
- Memory retrieval must be scoped by `agent_id`.
- Context retrieval must be scoped by `agent_id`.
- Handoff must be explicit and permission checked.
- Receiving agents receive explicit handoff payloads, not private sender memory or context.
- Every run must save trace events.
- Every run should save config snapshots for reproducibility.
- Workflow definitions are separate from agent definitions.
- Soul/persona is separate from system prompt.
- Learning happens through agent-specific memory updates only.
- Proposed memories require manual approval before they become active memory.
- Soul/persona is not rewritten automatically.
- Runtime observability must not expose another agent's private memory or provider secrets.

## Project Structure

```text
backend/      FastAPI backend, persistence, runtime, tools, memory, and tests.
frontend/     Next.js frontend for agent, workflow, run, and experiment management.
docs/         Architecture, setup, isolation, memory, workflow, and experiment guides.
.skills/      Project-specific Codex skills for planning, implementation, review, and experiments.
```

## Local Setup

1. Copy environment examples:

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

2. Start required local infrastructure:

   ```bash
   docker compose up -d postgres qdrant
   ```

   If you later add backend or frontend services to Compose, `docker compose up -d` can start the full local stack.

3. Verify the infrastructure:

   ```bash
   docker compose ps
   docker compose logs postgres
   curl http://localhost:6333/collections
   ```

   The Qdrant dashboard is available at [http://localhost:6333/dashboard](http://localhost:6333/dashboard).

4. Run the backend:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

5. Run the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

To stop services:

```bash
docker compose down
```

To stop services and remove local PostgreSQL and Qdrant data:

```bash
docker compose down -v
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `POSTGRES_HOST_PORT` | Host port mapped to PostgreSQL container port `5432`; defaults to `5433`. |
| `DATABASE_URL` | PostgreSQL connection string. Local default is `postgresql://postgres:postgres@localhost:5433/agent_swarm_lab`. |
| `FRONTEND_API_BASE_URL` | Frontend-facing backend API URL. |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the backend. |
| `CREATE_TABLES_ON_STARTUP` | Creates MVP tables on backend startup for local development. |
| `QDRANT_URL` | Local or remote Qdrant endpoint. Local default is `http://localhost:6333`. Use `http://qdrant:6333` from backend containers. |
| `QDRANT_API_KEY` | Optional Qdrant API key. Local Compose Qdrant does not require one. |
| `QDRANT_COLLECTION_PREFIX` | Prefix for Agent Swarm Lab vector collections. |
| `TAVILY_API_KEY` | Optional Tavily API key for Tool Gateway search. |
| `LLM_PROVIDER` | Provider selector: `mock`, `openai_compatible`, `openai`, `anthropic`, or `ollama`. Defaults to `mock`. |
| `OPENAI_COMPATIBLE_API_KEY` | Backend-only API key for any OpenAI-compatible endpoint. Required when `LLM_PROVIDER=openai_compatible`. |
| `OPENAI_COMPATIBLE_BASE_URL` | Base URL for the compatible endpoint. Required when `LLM_PROVIDER=openai_compatible`. |
| `OPENAI_COMPATIBLE_MODEL` | Model name passed to chat completions. Required when `LLM_PROVIDER=openai_compatible`. |
| `OPENAI_COMPATIBLE_PROVIDER_NAME` | Optional label stored in provider metadata, such as `deepseek` or `openrouter`. |
| `OPENAI_API_KEY` | Placeholder for standard OpenAI provider integration. |
| `OPENAI_MODEL` | Optional default model for standard OpenAI provider integration. |
| `ANTHROPIC_API_KEY` | Placeholder for future Anthropic provider integration. |
| `ANTHROPIC_MODEL` | Optional default model for Anthropic provider integration. |
| `OLLAMA_BASE_URL` | Placeholder for future Ollama provider integration. |
| `OLLAMA_MODEL` | Optional default model for Ollama provider integration. |

## LLM Providers

Mock mode is the default:

```bash
LLM_PROVIDER=mock
```

Use the generic OpenAI-compatible provider when a model vendor exposes an OpenAI-style chat completions API:

```bash
LLM_PROVIDER=openai_compatible
OPENAI_COMPATIBLE_PROVIDER_NAME=your-provider-name
OPENAI_COMPATIBLE_API_KEY=your_provider_api_key
OPENAI_COMPATIBLE_BASE_URL=https://provider.example.com
OPENAI_COMPATIBLE_MODEL=provider-model-name
```

DeepSeek is one example. Its API documentation describes OpenAI-compatible endpoints at `https://api.deepseek.com` and current model names including `deepseek-v4-flash` and `deepseek-v4-pro`:

```bash
LLM_PROVIDER=openai_compatible
OPENAI_COMPATIBLE_PROVIDER_NAME=deepseek
OPENAI_COMPATIBLE_API_KEY=your_deepseek_api_key
OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com
OPENAI_COMPATIBLE_MODEL=deepseek-v4-flash
```

LLM API keys belong only in backend environment files such as `backend/.env` or a server-side deployment secret store. Do not put LLM API keys in `frontend/.env.local` or expose them through frontend variables.

To verify the active provider, start the backend and call `GET /health`; the response includes `llm_provider`. Workflow run trace output also stores provider metadata on agent output events.

## Qdrant Notes

Qdrant is included in Docker Compose by default and persists data in the `qdrant_data` named volume. The app should start even when Qdrant is unavailable; vector memory search should report a clear disabled or unavailable status instead of crashing. Agents must never access a raw Qdrant client directly.

For a backend running on the host machine, use:

```bash
QDRANT_URL=http://localhost:6333
```

For a backend running inside Docker Compose, use:

```bash
QDRANT_URL=http://qdrant:6333
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/agent_swarm_lab
```

The local Qdrant dashboard is available at [http://localhost:6333/dashboard](http://localhost:6333/dashboard).

## Tavily Notes

Tavily search will be implemented as a Tool Gateway tool. A missing `TAVILY_API_KEY` must return a clear configuration error from the tool wrapper and must not crash the app.

## Agent Learning Loop

The learning loop is:

```text
Run output -> human feedback -> optional evaluation -> reflection -> proposed memory -> manual approval -> active memory -> future run behavior change
```

Relevant endpoints:

- `POST /runs/{run_id}/agents/{agent_id}/feedback`
- `GET /agents/{agent_id}/feedback`
- `POST /runs/{run_id}/agents/{agent_id}/evaluate`
- `GET /runs/{run_id}/evaluations`
- `POST /runs/{run_id}/agents/{agent_id}/reflect`
- `POST /agents/{agent_id}/proposed-memories`
- `GET /agents/{agent_id}/proposed-memories`
- `POST /agents/{agent_id}/proposed-memories/{memory_id}/approve`
- `POST /agents/{agent_id}/proposed-memories/{memory_id}/reject`

Approved proposed memories create active `AgentMemory` records for the same `agent_id`. Rejected proposed memories do not create active memory and are not retrieved in future context assembly.

See [docs/agent-learning-loop.md](docs/agent-learning-loop.md) for the full flow and before/after experiment process.

## Agent Runtime Observatory

The runtime observatory records every agent step in a workflow run.

Relevant endpoints:

- `GET /runs`
- `GET /runs/{run_id}`
- `DELETE /runs/{run_id}`
- `GET /runs/{run_id}/monitor`
- `GET /runs/{run_id}/executions`
- `GET /runs/{run_id}/executions/{execution_id}`
- `GET /runs/{run_id}/executions/{execution_id}/events`
- `GET /runs/{run_id}/token-usage`
- `GET /agents/{agent_id}/evolution`
- `GET /agents/{agent_id}/performance-summary`

Frontend pages:

- `/runs`
- `/runs/[id]`
- `/runs/[id]/monitor`
- `/runs/[id]/executions`
- `/runs/[id]/executions/[executionId]`
- `/runs/[id]/token-usage`
- `/agents/[id]/evolution`

The Runs page is the main run management entry point. It lists runs, filters by status and workflow, links to monitor, trace, executions, and token usage pages, and supports confirmed single or selected run deletion. Deleting a run removes run-local trace, execution, token usage, feedback, evaluation, pending or rejected proposed memory, and learning event records. It does not delete agents, workflows, tools, souls, contexts, active approved agent memories, or the approved proposed-memory records that back those active memories.

The MVP monitor uses polling rather than WebSockets. Event payloads are collapsed by default; expand an event row to inspect formatted JSON. Mock provider token usage is estimated from text length and marked as estimated.

See [docs/agent-runtime-observatory.md](docs/agent-runtime-observatory.md) for the full observability model.

## Frontend Configuration Management

The frontend exposes the main backend-supported configuration records:

- Agents can be created, edited, deleted, activated or deactivated, linked to a soul, and configured with provider/model settings plus JSON `memory_policy`, `context_policy`, and `handoff_policy`.
- Souls can be created, edited, and deleted from the Souls pages.
- Tools can be created, edited, deleted, activated or deactivated, and assigned or unassigned per agent from the agent detail page.
- Agent contexts can be created, edited, deleted, prioritized, and activated or deactivated from the agent detail page.
- Agent memories can be created, edited, deleted, approved, rejected, archived, or activated from the agent detail page.

Policy and tool config editors validate JSON in the browser before sending requests. LLM API keys must still remain backend-only; the frontend uses only `NEXT_PUBLIC_API_BASE_URL` to reach the FastAPI API.

## Review Status

Milestone 8 reviewed the MVP for isolation, traceability, startup readiness, and documentation. High-priority fixes added CORS for the local frontend, local table initialization, and Tool Gateway trace events for allowed and denied tool calls. Milestone 9 adds a memory-only learning loop with explicit feedback scoping and manual memory approval. Milestone 10 adds polling-based runtime observability, execution records, event timelines, token usage, and agent evolution views. The current frontend configuration pass completes CRUD and major field coverage for agents, souls, tools, contexts, memories, policies, active flags, and agent-tool assignments. Run management now includes a discoverable Runs page, collapsed event payloads, token usage navigation, and safe cleanup for old run-local records.

## Running Tests

Backend tests begin in Milestone 1:

```bash
cd backend
pytest
```

Frontend checks:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

Automated end-to-end tests use Playwright and expect the backend at `http://localhost:8000` with the frontend served at `http://localhost:3000`. Use `LLM_PROVIDER=mock` for repeatable local E2E runs.

Start required services first:

```bash
docker compose up -d postgres qdrant
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

Then run E2E tests from another terminal:

```bash
cd frontend
npm run e2e
```

Useful E2E variants:

```bash
cd frontend
npm run e2e:headed
npm run e2e:ui
```

If Playwright browser binaries are missing:

```bash
cd frontend
npx playwright install
```

For a step-by-step human test of the full BI dashboard discrepancy journey, use [docs/MANUAL_E2E_TEST_GUIDE.md](docs/MANUAL_E2E_TEST_GUIDE.md).

## Current MVP Limitations

- The MVP experiment module compares two or more agents on the same task and links to per-run traces.
- Learning updates only agent memory; it does not rewrite soul/persona automatically.
- The before/after learning comparison flow is manual through run traces and repeated workflow runs.
- Runtime monitoring is polling-based; WebSocket streaming is not implemented yet.
- `openai_compatible` can call compatible chat completions APIs. Standard OpenAI, Anthropic, and Ollama providers remain placeholders.
