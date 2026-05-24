# Agent Swarm Lab

Agent Swarm Lab is a configurable platform for creating, editing, deleting, configuring, and composing independent AI agents. Each agent owns its own model settings, soul/persona, system prompt, context entries, memory store, tool permissions, and handoff policy.

The MVP starts with mock LLM mode so the full workflow can run locally without API cost. It also includes a generic OpenAI-compatible provider for model APIs that support the OpenAI chat completions format.

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

2. Start local dependencies when backend code is available:

   ```bash
   docker compose up -d postgres
   ```

3. Run the backend after Milestone 1 adds the FastAPI app:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

4. Run the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `FRONTEND_API_BASE_URL` | Frontend-facing backend API URL. |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the backend. |
| `CREATE_TABLES_ON_STARTUP` | Creates MVP tables on backend startup for local development. |
| `QDRANT_URL` | Local or remote Qdrant endpoint. |
| `QDRANT_API_KEY` | Optional Qdrant API key. |
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

Qdrant is expected to be reusable if it is already installed locally. The app should start even when Qdrant is unavailable; vector memory search should report a clear disabled or unavailable status instead of crashing. Agents must never access a raw Qdrant client directly.

## Tavily Notes

Tavily search will be implemented as a Tool Gateway tool. A missing `TAVILY_API_KEY` must return a clear configuration error from the tool wrapper and must not crash the app.

## Review Status

Milestone 8 reviewed the MVP for isolation, traceability, startup readiness, and documentation. High-priority fixes added CORS for the local frontend, local table initialization, and Tool Gateway trace events for allowed and denied tool calls.

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

## Current MVP Limitations

- Milestone 0 contains scaffolding and documentation only.
- Backend API implementation starts in Milestone 1.
- The MVP experiment module compares two or more agents on the same task and links to per-run traces.
- `openai_compatible` can call compatible chat completions APIs. Standard OpenAI, Anthropic, and Ollama providers remain placeholders.
