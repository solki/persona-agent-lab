# Setup

This guide describes the local development setup for Agent Swarm Lab.

## Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- Docker and Docker Compose
- PostgreSQL through Docker Compose
- Qdrant through Docker Compose

Agent Swarm Lab is a self-contained local development project. Docker Compose starts both PostgreSQL and Qdrant, so you do not need an existing Qdrant service on your machine. If Qdrant is unavailable, the backend should still start and report vector memory search as unavailable once that service is implemented.

## Environment Files

Copy the example files before running services:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Do not commit `.env`, `backend/.env`, or `frontend/.env.local`.

For local browser access, keep `CORS_ORIGINS` aligned with the frontend dev URL. The default permits `http://localhost:3000` and `http://127.0.0.1:3000`.

Keep all LLM API keys in backend-only environment files or deployment secrets. Do not add LLM API keys to `frontend/.env.local`.

The default local database URL is:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/agent_swarm_lab
```

The default local Qdrant settings are:

```bash
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION_PREFIX=agent_swarm_lab
```

Local development Qdrant does not require an API key. The dashboard is available at [http://localhost:6333/dashboard](http://localhost:6333/dashboard).

If the backend runs inside Docker Compose instead of on the host machine, use service names:

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/agent_swarm_lab
QDRANT_URL=http://qdrant:6333
```

### LLM Provider Configuration

Mock mode is the default and requires no external API key:

```bash
LLM_PROVIDER=mock
```

The backend also supports a generic OpenAI-compatible provider. Use it for providers that expose the OpenAI chat completions API format:

```bash
LLM_PROVIDER=openai_compatible
OPENAI_COMPATIBLE_PROVIDER_NAME=your-provider-name
OPENAI_COMPATIBLE_API_KEY=your_provider_api_key
OPENAI_COMPATIBLE_BASE_URL=https://provider.example.com
OPENAI_COMPATIBLE_MODEL=provider-model-name
```

When `LLM_PROVIDER=openai_compatible`, the API key, base URL, and model are required. Missing values produce a clear configuration error; the backend does not silently fall back to mock mode.

DeepSeek can be configured through the generic provider:

```bash
LLM_PROVIDER=openai_compatible
OPENAI_COMPATIBLE_PROVIDER_NAME=deepseek
OPENAI_COMPATIBLE_API_KEY=your_deepseek_api_key
OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com
OPENAI_COMPATIBLE_MODEL=deepseek-v4-flash
```

DeepSeek currently documents OpenAI-compatible endpoints and models such as `deepseek-v4-flash` and `deepseek-v4-pro`.

To verify which provider is active, run the backend and call:

```bash
curl http://localhost:8000/health
```

The health response includes `llm_provider`. For workflow runs, inspect the run trace and agent output metadata.

## Backend

Start required infrastructure before running the backend:

```bash
docker compose up -d postgres qdrant
```

If backend or frontend services are later added to Compose, use this to start the full local stack:

```bash
docker compose up -d
```

Verify PostgreSQL:

```bash
docker compose ps
docker compose logs postgres
```

Verify Qdrant:

```bash
curl http://localhost:6333/collections
```

The Qdrant dashboard is available at [http://localhost:6333/dashboard](http://localhost:6333/dashboard).

The backend foundation includes FastAPI, Pydantic settings, SQLAlchemy metadata, and the health endpoint.

Local commands:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

`CREATE_TABLES_ON_STARTUP=true` creates the MVP tables automatically for local development. Use migrations before production deployment.

Stop services without removing data:

```bash
docker compose down
```

Stop services and remove local PostgreSQL and Qdrant data:

```bash
docker compose down -v
```

## Frontend

The frontend uses Vite, React, TypeScript, Tailwind CSS, shadcn/ui primitives, and typed API helpers.

Local commands:

```bash
cd frontend
npm install
npm run dev
```

Frontend verification:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Tests

Backend tests begin in Milestone 1:

```bash
backend/.venv/bin/pytest backend/tests
```
