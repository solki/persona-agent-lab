# Agent Swarm Lab Rules

- All documentation must be written in English.
- All code comments must be written in English.
- Do not commit `.env` files or secrets.
- Use Git for all changes.
- Use project-specific skills under `.skills/`.
- Agent isolation is the default.
- No hidden shared global context.
- No hidden shared global memory.
- Context retrieval must be scoped by `agent_id`.
- Memory retrieval must be scoped by `agent_id`.
- Tool access must go through Tool Gateway.
- Agent-to-agent information transfer must happen only through explicit workflow output or handoff payload.
- Receiving agents must not receive private context or private memory from sending agents.
- Every runtime or backend behavior change must include or update tests.
- Run relevant tests before committing.
- Do not start implementing Milestone 9 unless the task explicitly asks for Milestone 9 implementation.

---

# Project Requirements (Reference)

## Project Goal

Build a configurable Agent Swarm Lab platform where users can create, edit, delete, configure, and compose independent AI agents. Each agent must have its own model settings, soul/persona, system prompt, context, memory, tools, and handoff policy. Agents must be isolated by default and must not share memory, context, tools, or settings unless explicitly configured through workflow or handoff policy.

## Local Environment Assumptions

- Qdrant is already installed locally and can be reused.
- Do not force Qdrant installation unless it is missing.
- Add Qdrant configuration placeholders in `.env.example`.
- Search should use Tavily when required.
- Add Tavily API configuration placeholders in `.env.example`.
- Do not require a real Tavily API key for basic local startup.
- The app should run with mock LLM mode first, then allow real provider integration later.

## Stack

Frontend: Next.js → later changed to Vite + React, TypeScript, Tailwind CSS, shadcn/ui
Backend: Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL, Qdrant client abstraction, Provider abstraction for LLMs, Docker Compose

## MVP Scope — Backend Features

1. Health endpoint
2. Agent CRUD
3. Soul/persona CRUD
4. Tool registry CRUD
5. Assign tools to agents
6. Agent-specific context CRUD
7. Agent-specific memory CRUD
8. Memory policy per agent
9. Handoff policy per agent
10. Workflow CRUD
11. Workflow runner with mock LLM mode
12. Run trace logging
13. Config snapshot per run
14. Basic experiment runner to compare two or more agents on the same task

## MVP Scope — Frontend Features

1. Dashboard landing page
2. Agent list page
3. Agent create/edit page
4. Soul/persona list and editor
5. Tool registry page
6. Agent context manager
7. Agent memory manager
8. Workflow builder page
9. Run workflow page
10. Run trace viewer
11. Experiment page for comparing agent behaviours

## Architecture Principles

- Agent isolation by default
- No hidden shared global context
- No hidden shared global memory
- Each agent has independent: LLM provider, model, temperature, max tokens, system prompt, soul/persona, context entries, memory store, tool permissions, handoff policy
- Tool access must go through Tool Gateway
- Memory retrieval must always be scoped by `agent_id`
- Context retrieval must always be scoped by `agent_id`
- Handoff must be explicit and permission checked
- Receiving agents must only receive explicit handoff payloads, not private memory or private context from the sending agent
- Every run must save trace events
- Every run should save config snapshots for reproducibility
- Memory writeback should support manual review mode
- Context assembly must be deterministic and inspectable
- Workflow definitions must be separate from agent definitions
- Soul/persona must be separate from system prompt

## Backend API Requirements

Health: GET /health
Agents: GET/POST /agents, GET/PUT/DELETE /agents/{id}
Souls: GET/POST /souls, GET/PUT/DELETE /souls/{id}
Tools: GET/POST /tools, GET/PUT/DELETE /tools/{id}, POST/DELETE /agents/{id}/tools/{id}
Contexts: GET/POST /agents/{id}/contexts, PUT/DELETE /agents/{id}/contexts/{id}
Memories: GET/POST /agents/{id}/memories, PUT/DELETE /agents/{id}/memories/{id}, POST approve/reject
Workflows: GET/POST /workflows, GET/PUT/DELETE /workflows/{id}, POST /workflows/{id}/run
Runs: GET /runs, GET /runs/{id}, GET /runs/{id}/trace
Experiments: GET/POST /experiments, GET /experiments/{id}, POST /experiments/{id}/run

## Data Model Requirements

Agent: id, name, description, role, system_prompt, soul_id, llm_provider, model, temperature, max_tokens, memory_policy, context_policy, handoff_policy, is_active, created_at, updated_at
Soul: id, name, description, principles, decision_style, collaboration_style, failure_handling_style, escalation_style, created_at, updated_at
Tool: id, name, description, tool_type, config, is_active, created_at, updated_at
AgentTool: agent_id, tool_id
AgentContext: id, agent_id, title, context_type, content, priority, is_active, created_at, updated_at
AgentMemory: id, agent_id, memory_type, content, source, importance, status, created_at, updated_at, last_accessed_at
Workflow: id, name, description, workflow_type, graph_config, is_active, created_at, updated_at
Run: id, workflow_id, input, output, status, config_snapshot, started_at, ended_at, created_at
TraceEvent: id, run_id, event_type, agent_id, payload, created_at
Experiment: id, name, description, task_prompt, agent_ids, evaluation_config, created_at, updated_at
ExperimentRun: id, experiment_id, run_ids, comparison_result, created_at

## Testing Requirements

Backend tests for: Health endpoint, Agent CRUD, Soul CRUD, Context retrieval scoped by agent_id, Memory retrieval scoped by agent_id, Tool Gateway allowed/denied calls, Tavily missing API key behavior, Context assembler isolation, Workflow run trace events, Config snapshot, Pending memory approve/reject

## Documentation Requirements

README.md, docs/setup.md, docs/architecture.md, docs/agent-isolation.md, docs/memory-and-context.md, docs/workflow-runtime.md, docs/experiment-design.md

## Milestone Plan

0: Planning, project init, README, .gitignore, .env.example
1: Backend foundation — FastAPI, config, DB models, schemas, health endpoint, basic tests
2: Agent, Soul, Tool, Context, Memory CRUD APIs + isolation tests
3: Tool Gateway, Tavily wrapper, Qdrant abstraction + tests
4: Runtime — Context Assembler, Mock LLM, Workflow Runner, trace logging, config snapshot + tests
5: Frontend foundation — Dashboard, Agent/Soul/Tool pages, Context/Memory UI
6: Workflow and Run UI — list/editor, run page, trace viewer
7: Experiment module — backend APIs, frontend comparison page, seed data
8: Final review — architecture, isolation, traces, permissions, tests, docs
