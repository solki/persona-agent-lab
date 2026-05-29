---
name: agent-lab-implementation
description: Use when implementing Agent Swarm Lab code, schemas, APIs, workflows, agents, Tool Gateway integration, memory/context services, handoff policy, trace persistence, config snapshots, Docker Compose setup, tests, or documentation.
---

# Agent Lab Implementation Skill

## Purpose

Use this skill when writing, modifying, or wiring code for Agent Swarm Lab.

The implementation goal is to build a maintainable platform for configuring and composing isolated AI agents. Every implementation must preserve the rule that agents do not share memory, context, tools, settings, prompts, or runtime state unless explicitly authorized by workflow configuration or handoff policy.

## Before Coding

- **Inspect current files and existing patterns** before writing. Match the surrounding code style, naming, and structure.
- **Summarize the implementation plan** before making broad changes. Confirm the scope with the user.
- **Use existing services, schemas, and components** where possible. Reuse, don't reinvent.
- **Prefer minimal changes.** Do not refactor unrelated code. Scope each change to the feature at hand.

## When to Use

Use this skill when implementing:

- Agent create, read, update, delete, clone, import, or export flows
- Agent configuration for provider, model, temperature, prompts, soul/persona, tools, memory, context, or handoff policy
- Workflow composition, workflow execution, or run orchestration
- Tool Gateway authorization and execution
- Memory retrieval, memory writeback, manual memory review, or vector storage
- Context entry storage, context assembly, or context inspection
- Handoff payload validation, authorization, or routing
- Trace events, run artifacts, or config snapshots
- PostgreSQL models, migrations, repositories, or persistence services
- Qdrant/vector memory abstraction
- Pydantic schemas for API, tool, memory, context, workflow, or run boundaries
- Docker Compose, local setup, tests, or documentation

## When Not to Use

Do not use this skill for:

- Pure planning where no code changes are requested
- Review-only tasks where implementation should not be modified

## Core Principles

### 1. Brain / Hands / Session separation

Separate:

- Brain: model calls, prompt assembly, agent reasoning, and response generation
- Hands: external tools invoked only through Tool Gateway
- Session: runs, trace events, config snapshots, artifacts, errors, and status

Agents must not directly call external services or tool wrappers. They must submit tool requests through Tool Gateway.

### 2. Tool Gateway enforcement

All tool access must go through a central Tool Gateway.

The Tool Gateway must:

- Validate the requested tool name.
- Validate the requesting `agent_id`.
- Check the agent's tool permissions from the run config snapshot or current policy.
- Execute only authorized tools.
- Return a standard tool result schema.
- Persist tool call, tool result, denied permission, timeout, and error events.

### 3. Pydantic schema validation

Use Pydantic models for important boundaries:

- Agent definitions
- Agent model settings
- Soul/persona and system prompt payloads
- Context entries and assembled context blocks
- Memory items, memory retrieval requests, and memory writeback proposals
- Tool calls and tool results
- Handoff policies and handoff payloads
- Workflow definitions and workflow edges
- Run requests, trace events, artifacts, errors, and config snapshots

If model or tool output fails validation, persist the validation error, retry only where appropriate, and fail clearly if repair does not produce valid data.

### 4. PostgreSQL persistence

Persist durable state in PostgreSQL unless the project has already established a different store.

### 5. Scoped memory and vector abstraction

Use Qdrant or a vector memory abstraction for semantic memory. Agent code should not depend directly on a raw vector database client.

Memory retrieval must include `agent_id` in the filter or namespace. Memory writes must attach `agent_id`. Cross-agent memory access must be impossible unless a deliberate shared-memory feature is implemented with explicit policy and tests.

Memory writeback should support manual review mode before durable memory insertion.

### 6. Scoped context assembly

Context retrieval must be scoped by `agent_id`. Context assembly must be deterministic and inspectable.

### 7. Explicit handoff

Handoff must be represented by a validated payload and a policy check.

The receiving agent must receive only:

- The explicit handoff payload
- Workflow-provided inputs it is authorized to see
- Its own memory and context
- Its own tools and settings

It must not receive private memory, private context, prompts, or hidden state from the sending agent.

### 8. Reproducible runs

Every run must persist trace events. Every run should persist config snapshots for reproducibility.

## Reviewer Feedback & Memory Lifecycle

When implementing reviewer feedback or proposed-memory flows:

| Review Outcome | Action |
|---------------|--------|
| **corrective** + valid `proposed_memory` | Create pending `ProposedMemory` |
| **refinement** + valid `proposed_memory` | May create pending `ProposedMemory` |
| **refinement** without durable learning | Show a clear no-memory-created message |
| **none** | Create no `ProposedMemory` |
| **approved** `ProposedMemory` | Create active `AgentMemory` |
| **rejected** `ProposedMemory` | Create no `AgentMemory` |

- Approved/rejected `ProposedMemory` items should appear in **history/archive**, not as default action content.
- Agent detail default view should show **active memories** and **pending proposed memories requiring action**, not rejected history.
- Run-scoped purge/delete must delete only run-scoped dependencies. Never delete unrelated user-created or demo seed data.

## Frontend Quality

Frontend is Vite + React + TypeScript + Tailwind CSS + shadcn/ui. Every UI change must:

- Show **loading**, **success**, **error**, **empty**, and **confirmation** states. Never fail silently.
- Use polished, user-friendly interaction design consistent with the existing UI style.
- Use existing shared components (`AppLayout`, `PageHeader`, `StatusBadge`, `ConfirmDialog`, `NoticeDialog`, `FormField`, `EmptyState`, `JsonCollapse`, `Alert`, `FieldHelp`) and shadcn/ui primitives.
- Use react-hook-form + zod for forms. JSON policy/config fields stored as strings and parsed before submit.
- Notification badges for pending proposed memories use amber pill styling from `NotificationContext`.

## Test Data Hygiene

- **Test-created records must use TEST or E2E prefixes** in names to distinguish from user-created or demo seed data.
- **Clean up only records created during the task.** Do not delete user-created or demo seed data.
- **Never use broad cleanup, table truncation, or admin cleanup** (`POST /admin/cleanup-lab-data`) unless the task explicitly asks for it.
- Run-scoped delete operations must target only run-scoped dependencies.

## Scope Discipline

- **Do not add new backend APIs** if existing APIs already support the frontend need.
- **Do not add new database fields or schema changes** unless clearly necessary.
- **Do not add new agent form fields** unless clearly justified.
- **Do not add `agent_type`** — use role convention + context_type.
- **Do not auto-rewrite soul/persona** — explicit user action only.
- **Do not add** RAG, file upload, image input, multimodal, auth, or production deployment unless explicitly requested.
- **Backend changes should be avoided** when the requirement can be satisfied by frontend or existing APIs.

## Workflow

For each implementation task:

1. Read the relevant requirements and existing code.
2. Identify affected files and existing local patterns.
3. Summarize the implementation plan before making broad changes.
4. Define the isolation invariant the change must preserve.
5. Add or update focused tests first where practical.
6. Implement the smallest working change.
7. Use Pydantic schemas at API, persistence, tool, memory, context, and handoff boundaries.
8. Route tool access through Tool Gateway only.
9. Scope memory and context operations by `agent_id`.
10. Persist trace events and config snapshots where run behavior changes.
11. Run relevant tests: `cd backend && .venv/bin/pytest -q`, `cd frontend && npm run lint && npm run typecheck && npm run build`.
12. Update documentation when setup, architecture, API behavior, or policy behavior changes.
13. Summarize changed files and verification results.

## Checklist

- [ ] Current files inspected; implementation plan summarized.
- [ ] No unnecessary new APIs, DB fields, schema changes, or agent_type added.
- [ ] No auto-rewrite of soul/persona.
- [ ] No direct tool calls from agent logic.
- [ ] Tool Gateway validates tool name, `agent_id`, and permissions.
- [ ] Memory retrieval and writeback are scoped by `agent_id`.
- [ ] Context retrieval and assembly are scoped by `agent_id`.
- [ ] Handoff uses validated payloads and permission checks.
- [ ] Receiving agents do not receive private sender memory or context.
- [ ] Agent definition and workflow composition remain separate.
- [ ] Soul/persona and system prompt remain separate fields.
- [ ] Pydantic validates important inputs and outputs.
- [ ] PostgreSQL stores durable configuration, run, trace, and review state.
- [ ] Every run writes trace events and config snapshots.
- [ ] Memory writeback supports manual review mode when enabled.
- [ ] Context assembly is deterministic and inspectable.
- [ ] Proposed-memory lifecycle respects corrective/refinement/none rules.
- [ ] Frontend shows loading, success, error, empty, confirmation states where applicable.
- [ ] Test-created records use TEST or E2E prefixes.
- [ ] Only task-created data cleaned up; user/demo data preserved.
- [ ] No broad cleanup or admin cleanup unless explicitly asked.
- [ ] Tests cover allowed and denied Tool Gateway access.
- [ ] Tests cover memory isolation and context isolation by `agent_id`.
- [ ] Tests cover handoff payload limits and permission denial.
- [ ] Backend tests pass (123), frontend lint/typecheck/build pass.
- [ ] Documentation reflects new behavior.

## Expected Output

When implementing, produce:

1. Summary of implemented behavior
2. Files changed
3. Isolation, permission, and persistence notes
4. Tests added or updated
5. Verification commands and results
6. Documentation updates
7. Remaining risks or follow-up tasks

## Done Criteria

Implementation is complete when:

- The requested behavior works end to end.
- Agent isolation is preserved by design and by tests.
- Tool access cannot bypass Tool Gateway.
- Memory and context cannot leak across agents by default.
- Handoff behavior is explicit, validated, and permission checked.
- Runs persist trace events and relevant config snapshots.
- Pydantic schemas validate important boundaries.
- Relevant tests, linting, or type checks have been run.
- Setup or architecture documentation is updated when needed.
