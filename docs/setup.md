# Setup

This guide describes the local development setup for Agent Swarm Lab.

## Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- Docker and Docker Compose
- PostgreSQL through Docker Compose
- Optional local Qdrant instance

Qdrant is not forced by this project scaffold. If Qdrant is unavailable, the backend should still start and report vector memory search as unavailable once that service is implemented.

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

## Frontend

The frontend foundation starts in Milestone 5 with Next.js, TypeScript, Tailwind CSS, and typed API helpers.

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
