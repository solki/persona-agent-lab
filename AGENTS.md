# Persona Agent Lab

## What This Project Is

Persona Agent Lab is an **Agent Studio** — not a chatbot. It is a platform for creating, configuring, running, observing, and improving independent AI agents.

Users can:
- Create and maintain agents with their own LLM provider, model, temperature, max tokens, soul/persona, context, memory, and tools
- Compose agents into workflows and run real tasks with real LLMs
- Observe each agent's inputs, outputs, context, memory, tools, token usage, and trace events
- Provide feedback on agent outputs, convert feedback into proposed memories, approve them into active agent memory
- Re-run similar tasks and observe whether the agent's behavior improves

## Rules

- All documentation and code comments must be written in English.
- Do not commit `.env` files or secrets.
- Use project-specific skills under `.skills/`.
- Agent isolation is the default.
- Every runtime or backend behavior change must include or update tests.
- Run relevant tests before committing.

## Architecture Principles

- Each agent is an independent entity.
- Agents must not share private context or private memory by default.
- Context retrieval must be scoped by `agent_id`.
- Memory retrieval must be scoped by `agent_id`.
- Agent-to-agent information transfer must happen only through explicit workflow output or handoff payload.
- Approved memory affects only the target agent.
- Feedback-derived memories must remain pending until approved.
- Soul/persona must not be automatically rewritten (current phase).
- Tools must be assigned per agent. Inactive tools must not be selectable for new assignments.
- Runtime history and learning history should be preserved by default.
- Prefer archive/deactivate over unsafe hard delete when dependencies exist.
- Frontend actions must never fail silently.
- Soul/persona and system prompt must be stored and handled separately.
- Workflow definitions must be separate from agent definitions.
- Tool access must go through Tool Gateway.
- Every run must save trace events and config snapshots for reproducibility.

## Current Phase: Real Agent Runtime + Learning Loop Validation

Phase 2 focus:
- Use real LLM runtime through `openai_compatible` provider; keep mock provider for tests
- Complete frontend learning loop: feedback → reflection → proposed memory → approval → active memory → re-run
- Create a real demo scenario proving an agent can learn from feedback
- Add before/after learning effect comparison

Out of scope for Phase 2: RAG retrieval, file upload, image/multimodal input, automatic soul/persona rewriting, full LangGraph swarm, supervisor workflow, handoff swarm, large-scale benchmark system.

## Frontend Direction

The active frontend is in the `frontend/` directory (Vite + React + TypeScript + Tailwind CSS + shadcn/ui).

- Use consistent CRUD patterns: list/create/edit/detail pages, confirmation dialogs, visible loading/success/error states, status badges, empty states
- Use collapsible JSON for advanced config and trace payloads
- Use contextual field help only for complex fields — not every field needs it
- No silent failures

## Testing Expectations

For any meaningful feature change:
- Run backend tests if backend changed
- Run frontend lint (`npm run lint`), typecheck (`npx tsc --noEmit`), and build (`npm run build`)
- Run E2E tests when UI flow changes
- Clean up test data and artifacts after testing
- Do not commit `.env`, screenshots, videos, traces, temp files, or generated test artifacts

## Stack

Frontend: Vite + React, TypeScript, Tailwind CSS, shadcn/ui
Backend: Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL, Qdrant, LLM provider abstraction, Docker Compose

## Reference

- Historical milestones: `docs/MILESTONE_HISTORY.md`
- Full architecture, data models, API endpoints, runtime flow, test coverage: `docs/PROJECT_STATE.md`
