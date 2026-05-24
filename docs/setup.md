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

## Frontend

Frontend implementation starts in Milestone 5.

Planned local commands:

```bash
cd frontend
npm install
npm run dev
```

## Tests

Backend tests begin in Milestone 1:

```bash
backend/.venv/bin/pytest backend/tests
```
