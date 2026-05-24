---
name: agent-lab-review
description: Use when reviewing Agent Swarm Lab code, architecture, requirements, pull requests, tests, schemas, permissions, memory/context isolation, handoff policy, Tool Gateway enforcement, persistence, reproducibility, Docker Compose setup, or documentation.
---

# Agent Lab Review Skill

## Purpose

Use this skill to review Agent Swarm Lab implementation for correctness, maintainability, security, isolation, reproducibility, and alignment with the project architecture.

The review should be practical, specific, and actionable. The central question is whether the platform truly keeps agents isolated by default while still allowing explicit, permission-checked composition.

## When to Use

Use this skill when reviewing:

- Agent configuration or lifecycle code
- Workflow composition or run orchestration
- Tool Gateway permissions and tool execution
- Memory storage, vector retrieval, or memory writeback
- Context storage, context retrieval, or context assembly
- Handoff policy, payloads, or receiving-agent behavior
- Pydantic schemas, API contracts, or persistence models
- PostgreSQL migrations and repositories
- Qdrant/vector memory abstraction
- Trace events, config snapshots, artifacts, or run auditability
- Tests for isolation, permissions, reproducibility, or policy enforcement
- Docker Compose, environment configuration, Git hygiene, or documentation

## When Not to Use

Do not use this skill for:

- Implementing new features unless the review explicitly asks for fixes
- Pure planning tasks before code exists
- Legacy business-analysis workflow review or unrelated report-generation review
- Generic style-only review with no architecture or behavior impact

## Core Principles

### 1. Review the invariants, not just whether code runs

Passing happy-path tests is not enough. Check whether the code enforces:

- Agent isolation by default
- No hidden shared global context
- No hidden shared global memory
- No direct tool calls outside Tool Gateway
- `agent_id`-scoped memory retrieval
- `agent_id`-scoped context retrieval
- Explicit permission-checked handoff
- Receiving agents seeing only explicit handoff payloads

### 2. Prefer actionable findings

Every finding should include:

- What is wrong
- Why it matters
- Where it appears
- How to fix or test it

Avoid vague feedback that cannot guide implementation.

### 3. Treat leakage as high severity

Any path that leaks private memory, private context, tool permissions, model settings, prompts, or hidden runtime state across agents should be treated as a major architecture issue.

### 4. Check reproducibility and auditability

Every run must save trace events. Every run should save config snapshots for reproducibility. Review whether a developer can inspect what happened, which config was used, which tools ran, which context was assembled, which memory was retrieved, and why a handoff was allowed or denied.

## Workflow

For each review:

1. Identify the intended behavior and affected architecture areas.
2. Inspect diffs or relevant files before judging.
3. Check the isolation model.
4. Check Tool Gateway enforcement.
5. Check memory and context scoping by `agent_id`.
6. Check handoff authorization and payload boundaries.
7. Check Pydantic validation at API, tool, memory, context, workflow, and run boundaries.
8. Check PostgreSQL persistence and trace/config snapshot behavior.
9. Check Qdrant/vector abstraction boundaries if memory retrieval is involved.
10. Check tests for allowed and denied cases.
11. Check Docker Compose, Git hygiene, and documentation where relevant.
12. Report findings in severity order with file and line references when available.

## Checklist

- [ ] Agent definitions do not include hidden workflow state.
- [ ] Workflow definitions do not mutate agent identity or private config unexpectedly.
- [ ] Soul/persona and system prompt are stored and handled separately.
- [ ] Provider, model, temperature, and parameters are agent-specific.
- [ ] Tool permissions are agent-specific and enforced centrally.
- [ ] Agents cannot call tools directly.
- [ ] Tool Gateway persists allowed, denied, error, and timeout events.
- [ ] Memory retrieval filters or namespaces by `agent_id`.
- [ ] Memory writeback attaches `agent_id` and supports manual review where configured.
- [ ] Context retrieval filters by `agent_id`.
- [ ] Context assembly is deterministic and inspectable.
- [ ] Handoff policy is explicit, persisted, and permission checked.
- [ ] Handoff payloads are validated.
- [ ] Receiving agents receive only explicit handoff payloads plus their own authorized inputs.
- [ ] Runs persist trace events.
- [ ] Runs persist config snapshots where reproducibility matters.
- [ ] Pydantic validates important inputs and outputs.
- [ ] PostgreSQL stores durable state that should survive process restarts.
- [ ] Vector database access is behind a service or gateway abstraction.
- [ ] Tests cover permission allowed and denied paths.
- [ ] Tests cover memory isolation and context isolation.
- [ ] Tests cover handoff denial and payload boundaries.
- [ ] Docker Compose supports local development dependencies.
- [ ] `.env` is excluded and `.env.example` is documented.
- [ ] Documentation describes architecture, setup, and policy behavior clearly.

## Expected Output

When reviewing, use this structure:

1. Overall Assessment
   - Ready / Not Ready
   - Summary
2. Critical Issues
   - Issue
   - Impact
   - Recommended fix
3. Important Improvements
   - Issue
   - Why it matters
   - Suggested change
4. Minor Suggestions
   - Optional improvements
5. Requirement Coverage
   - Passed requirements
   - Missing requirements
   - Partially implemented requirements
6. Test Coverage Assessment
7. Recommended Next Actions

Use severity levels:

- Critical: Must fix before continuing.
- High: Should fix before milestone completion.
- Medium: Should be addressed soon.
- Low: Nice to improve.

## Done Criteria

A review is complete when:

- It clearly states whether the implementation is ready.
- It identifies isolation, permission, memory, context, handoff, or reproducibility violations.
- It checks Tool Gateway, Pydantic, PostgreSQL, vector abstraction, Docker Compose, tests, Git hygiene, and documentation where relevant.
- It provides actionable next steps.
- It avoids vague or purely stylistic comments.
