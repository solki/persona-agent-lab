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

## Non-Essential Check

Before reviewing correctness, check whether the change is minimal:

- **Were new backend APIs added?** Could existing APIs have satisfied the need?
- **Were new database fields or schema changes added?** Were they clearly necessary?
- **Were new agent form fields added?** Were they clearly justified?
- **Was `agent_type` added?** Should role convention + context_type have been used instead?
- **Was soul/persona auto-rewritten?** Soul updates should require explicit user action.
- **Were backend changes made** when the requirement could have been satisfied by frontend or existing APIs?
- **Was unrelated code touched?** Scope should be limited to the feature at hand.

Flag any of these as unnecessary scope creep.

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

## UI Workflow Coherence

For frontend changes, review the user workflow:

- **Are actions presented as a coherent workflow** rather than disconnected buttons?
- **Are there silent failures** — mutations without loading, success, or error feedback?
- **Are lifecycle states clear?** Users should understand pending/approved/rejected/active/archived status.
- **Are there missing direct links?** Users should navigate from related views (e.g., run → agent → proposed memory → approve).
- **Does agent detail default view** show active memories and pending proposed memories requiring action?
- **Is the UI style consistent** with the existing Vite + React + TypeScript + Tailwind + shadcn/ui patterns?

## Proposed-Memory Lifecycle Review

Verify the proposed-memory lifecycle is correctly implemented:

- [ ] **Pending items require action** — shown prominently, not buried.
- [ ] **Approved items** become active `AgentMemory` and are retrieved by `ContextAssembler`.
- [ ] **Rejected items** are hidden from default action areas (shown only in history/archive).
- [ ] **Rejected items are never retrieved** into context during workflow runs.
- [ ] **Approved/rejected history** is viewable but does not clutter the default action view.
- [ ] **Run-scoped delete** does not touch unrelated user or demo data.

## Reviewer Feedback Quality Review

Verify the reviewer feedback implementation:

- [ ] **Reviewer evaluates the actual selected output** — the correct execution/trace event is targeted.
- [ ] **Reviewed output is traceable** — the response includes `reviewed_execution_id`, `reviewed_output`, `reviewed_target_agent_name`, `reviewer_agent_name`.
- [ ] **Reviewer does not invent failures** — a good output should be able to return `memory_decision: "none"`.
- [ ] **Memory decision rules are correct**:
  - `corrective` + valid `proposed_memory` → creates pending `ProposedMemory`
  - `refinement` + valid `proposed_memory` → may create pending `ProposedMemory`
  - `refinement` without durable learning → clear message that no memory was created
  - `none` → no `ProposedMemory` created
- [ ] **Proposed memory is durable, reusable, and target-agent-aware** — not ephemeral or cross-agent.
- [ ] **Mock reviewer signal-detection** does not produce false positives or false negatives.

## Test Data Hygiene Check

- [ ] **Test-created records use TEST or E2E prefixes** in names.
- [ ] **Only task-created data was cleaned up** — user-created and demo seed data are untouched.
- [ ] **No broad cleanup, table truncation, or admin cleanup** was used unless explicitly requested.
- [ ] **Existing tests still pass** — the change did not break unrelated tests.

## Workflow

For each review:

1. Identify the intended behavior and affected architecture areas.
2. Inspect diffs or relevant files before judging.
3. Check non-essential additions (APIs, fields, schema changes, agent_type, auto-rewrites).
4. Check the isolation model.
5. Check Tool Gateway enforcement.
6. Check memory and context scoping by `agent_id`.
7. Check handoff authorization and payload boundaries.
8. Check Pydantic validation at API, tool, memory, context, workflow, and run boundaries.
9. Check PostgreSQL persistence and trace/config snapshot behavior.
10. Check Qdrant/vector abstraction boundaries if memory retrieval is involved.
11. Check proposed-memory lifecycle (pending/approved/rejected flow).
12. Check reviewer feedback quality (correct output targeting, memory decisions).
13. Check UI workflow coherence (loading/success/error/empty states, navigation).
14. Check test data hygiene (prefixes, cleanup scope).
15. Check tests for allowed and denied cases.
16. Check Docker Compose, Git hygiene, and documentation where relevant.
17. Report findings in severity order with file and line references when available.

## Checklist

- [ ] Non-essential APIs, DB fields, schema changes, agent_type, or auto-rewrites are absent.
- [ ] Backend changes were truly necessary (could frontend/existing APIs have sufficed?).
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
- [ ] Runs persist trace events and config snapshots.
- [ ] Pydantic validates important inputs and outputs.
- [ ] Proposed-memory lifecycle: pending→action, approved→active, rejected→hidden.
- [ ] Reviewer feedback: correct output targeted, traceable, no invented failures.
- [ ] UI workflow is coherent: no silent failures, clear states, consistent style.
- [ ] Test-created records use TEST/E2E prefixes; only task data cleaned up.
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
2. Non-Essential Check
   - Unnecessary additions flagged
3. Critical Issues
   - Issue
   - Impact
   - Recommended fix
4. Important Improvements
   - Issue
   - Why it matters
   - Suggested change
5. Minor Suggestions
   - Optional improvements
6. Proposed-Memory & Reviewer Feedback Audit
7. UI Workflow Coherence
8. Test Data Hygiene
9. Requirement Coverage
   - Passed requirements
   - Missing requirements
   - Partially implemented requirements
10. Test Coverage Assessment
11. Recommended Next Actions

Use severity levels:

- Critical: Must fix before continuing.
- High: Should fix before milestone completion.
- Medium: Should be addressed soon.
- Low: Nice to improve.

## Done Criteria

A review is complete when:

- It clearly states whether the implementation is ready.
- It checks for non-essential additions.
- It identifies isolation, permission, memory, context, handoff, or reproducibility violations.
- It audits proposed-memory lifecycle and reviewer feedback quality.
- It checks UI workflow coherence and test data hygiene.
- It checks Tool Gateway, Pydantic, PostgreSQL, vector abstraction, Docker Compose, tests, Git hygiene, and documentation where relevant.
- It provides actionable next steps.
- It avoids vague or purely stylistic comments.
