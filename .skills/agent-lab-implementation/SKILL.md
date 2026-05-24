---
name: agent-lab-implementation
description: Use when implementing Agent Swarm Lab code, schemas, APIs, workflows, agents, Tool Gateway integration, memory/context services, handoff policy, trace persistence, config snapshots, Docker Compose setup, tests, or documentation.
---

# Agent Lab Implementation Skill

## Purpose

Use this skill when writing, modifying, or wiring code for Agent Swarm Lab.

The implementation goal is to build a maintainable platform for configuring and composing isolated AI agents. Every implementation must preserve the rule that agents do not share memory, context, tools, settings, prompts, or runtime state unless explicitly authorized by workflow configuration or handoff policy.

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
- Legacy business-analysis workflow implementation
- Mandatory search-vendor integration, template-report generation, or business-report features unless the user explicitly adds those requirements

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

Minimum durable concepts:

- Agents
- Agent versions or config snapshots
- Workflows
- Workflow runs
- Trace events
- Context entries
- Memory metadata and writeback review state
- Tool permissions
- Handoff policies
- Artifacts or run outputs

### 5. Scoped memory and vector abstraction

Use Qdrant or a vector memory abstraction for semantic memory. Agent code should not depend directly on a raw vector database client.

Memory retrieval must include `agent_id` in the filter or namespace. Memory writes must attach `agent_id`. Cross-agent memory access must be impossible unless a deliberate shared-memory feature is implemented with explicit policy and tests.

Memory writeback should support manual review mode before durable memory insertion.

### 6. Scoped context assembly

Context retrieval must be scoped by `agent_id`. Context assembly must be deterministic and inspectable.

Persist or expose enough metadata to answer:

- Which context entries were eligible?
- Which entries were selected?
- In what order were they assembled?
- Which token or size limits were applied?
- Which run and config snapshot used the assembled context?

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

Snapshot:

- Agent definitions and versions
- Provider, model, temperature, and model parameters
- Soul/persona and system prompt
- Tool permissions
- Handoff policy
- Workflow definition
- Context assembly metadata
- Memory retrieval metadata

## Workflow

For each implementation task:

1. Read the relevant requirements and existing code.
2. Identify affected files and existing local patterns.
3. Define the isolation invariant the change must preserve.
4. Add or update focused tests first where practical.
5. Implement the smallest working change.
6. Use Pydantic schemas at API, persistence, tool, memory, context, and handoff boundaries.
7. Route tool access through Tool Gateway only.
8. Scope memory and context operations by `agent_id`.
9. Persist trace events and config snapshots where run behavior changes.
10. Run relevant tests, formatting, and linting.
11. Update documentation when setup, architecture, API behavior, or policy behavior changes.
12. Summarize changed files and verification results.

## Checklist

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
- [ ] Qdrant/vector access is wrapped behind a service or gateway.
- [ ] Every run writes trace events.
- [ ] Runs save config snapshots where reproducibility matters.
- [ ] Memory writeback supports manual review mode when enabled.
- [ ] Context assembly is deterministic and inspectable.
- [ ] Docker Compose supports local PostgreSQL and vector memory services where needed.
- [ ] Tests cover allowed and denied Tool Gateway access.
- [ ] Tests cover memory isolation by `agent_id`.
- [ ] Tests cover context isolation by `agent_id`.
- [ ] Tests cover handoff payload limits and permission denial.
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
