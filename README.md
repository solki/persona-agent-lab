# Agent Swarm Lab

Agent Swarm Lab is a configurable platform for creating, editing, deleting, configuring, and composing independent AI agents. Each agent owns its own model settings, soul/persona, system prompt, context entries, memory store, tool permissions, and handoff policy.

The MVP starts with mock LLM mode so the full workflow can run locally without API cost. Real provider integrations can be added behind the provider abstraction in later milestones.

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
| `QDRANT_URL` | Local or remote Qdrant endpoint. |
| `QDRANT_API_KEY` | Optional Qdrant API key. |
| `QDRANT_COLLECTION_PREFIX` | Prefix for Agent Swarm Lab vector collections. |
| `TAVILY_API_KEY` | Optional Tavily API key for Tool Gateway search. |
| `LLM_PROVIDER` | Provider selector; defaults to `mock`. |
| `OPENAI_API_KEY` | Placeholder for future OpenAI provider integration. |
| `ANTHROPIC_API_KEY` | Placeholder for future Anthropic provider integration. |
| `OLLAMA_BASE_URL` | Placeholder for future Ollama provider integration. |

## Qdrant Notes

Qdrant is expected to be reusable if it is already installed locally. The app should start even when Qdrant is unavailable; vector memory search should report a clear disabled or unavailable status instead of crashing. Agents must never access a raw Qdrant client directly.

## Tavily Notes

Tavily search will be implemented as a Tool Gateway tool. A missing `TAVILY_API_KEY` must return a clear configuration error from the tool wrapper and must not crash the app.

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
- Experiments are implemented in a later milestone.
- Real LLM providers are placeholders until mock mode is working end to end.
