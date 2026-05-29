---
name: agent-lab-planning
description: Use when planning, scoping, decomposing, or refining Agent Swarm Lab work, especially agent definition, workflow composition, isolation boundaries, Tool Gateway permissions, memory/context architecture, handoff policy, traceability, reproducibility, persistence, local development, or documentation.
---

# Agent Lab Planning Skill

## Purpose

Use this skill to plan and structure work for Agent Swarm Lab.

Agent Swarm Lab is a configurable platform where users can create, edit, delete, configure, and compose independent AI agents. Each agent must own its model settings, soul/persona, system prompt, context, memory, tools, and handoff policy.

The planning goal is to turn product or engineering intent into small, buildable tasks while preserving the core invariant: agents are isolated by default and share nothing unless an explicit workflow or handoff policy permits it.

## Before Planning

- **Inspect the current repository** before relying on prior conversation context. Read relevant models, schemas, services, and frontend pages to understand current state.
- Review `docs/PROJECT_STATE.md` and `AGENTS.md` for up-to-date architecture, data models, API endpoints, and conventions.

## When to Use

Use this skill when planning work that affects:

- Agent definitions, agent configuration, or agent lifecycle
- Workflow composition separate from agent definition
- LLM provider, model, temperature, or prompt configuration
- Soul/persona design separate from system prompt design
- Context assembly, context entries, or deterministic context inspection
- Memory stores, vector retrieval, memory writeback, or manual memory review
- Tool permissions, Tool Gateway policy, or external tool execution
- Handoff payloads, handoff permissions, or receiving-agent behavior
- Run traces, config snapshots, reproducibility, or auditability
- PostgreSQL persistence, Qdrant/vector memory abstraction, Docker Compose, tests, or documentation

## When Not to Use

Do not use this skill for:

- Pure implementation tasks where scope is already clear
- Code review without planning changes
- Generic product brainstorming unrelated to Agent Swarm Lab

## Feature Scope Decision

For every new feature, first decide its scope:

1. **Frontend-only**: Can the requirement be satisfied using existing backend APIs? Prefer this path.
2. **Backend-only**: Does the change require new API endpoints, services, or data changes?
3. **Full-stack**: Both frontend and backend changes needed.

For each feature, explicitly state: **"Existing backend APIs can support this: YES / NO"**. If YES, list which endpoints.

## Infrastructure Discipline

Do not add infrastructure unless clearly justified:

- **Do not add new backend APIs** if existing APIs already support the frontend need.
- **Do not add new database fields or schema changes** unless clearly necessary for the feature.
- **Do not add new agent form fields** unless clearly justified by a feature requirement.
- **Do not add `agent_type`** unless clearly justified. Use role convention, description, system prompt, soul, context entries, tools, and workflow config first. Reviewer agents are identified by `role="quality-reviewer"` and `context_type="review_methodology"`.
- **Do not add** RAG, file upload, image input, multimodal input, authentication, or production deployment unless explicitly requested.
- **Backend changes should be avoided** when the requirement can be satisfied by frontend or existing APIs.

## Core Principles

### 1. Agent isolation by default

Plan every feature as if each agent is private unless a specific workflow edge or handoff policy grants access.

Agents must not silently share:

- Memory
- Context
- Tool permissions
- Model settings
- System prompts
- Soul/persona
- Runtime state

### 2. Explicit configuration over hidden globals

Avoid hidden shared global context, memory, tools, or settings. If behavior depends on configuration, make it visible, persisted, inspectable, and versioned.

### 3. Workflow is separate from agent definition

An agent definition describes what an agent is allowed to be and do. A workflow describes how agents are composed for a run.

Do not bake workflow edges, orchestration state, or peer access into the agent definition unless the product explicitly calls for a reusable default policy.

### 4. Soul/persona is separate from system prompt

Treat soul/persona as the user-facing identity and behavioral style of an agent. Treat the system prompt as operational instruction. Plan storage, editing, validation, and snapshotting for both fields independently.

**Do not auto-rewrite soul/persona.** Soul updates require explicit user action.

### 5. Brain / Hands / Session separation

Preserve a clean boundary between:

- Brain: agent reasoning, prompt assembly, and model calls
- Hands: tools and external execution through Tool Gateway
- Session: persisted runs, trace events, config snapshots, artifacts, and status

Agents must not bypass the Tool Gateway to call tools directly.

### 6. Scoped memory and context

Memory retrieval must be scoped by `agent_id`. Context retrieval must be scoped by `agent_id`. Any cross-agent material must arrive through an explicit, permission-checked handoff payload or workflow input.

### 7. Reproducible runs

Every run should persist trace events and config snapshots, including the agent configuration, workflow definition, model settings, selected context entries, memory retrieval metadata, tool permission state, and handoff decisions used for that run.

### 8. Phase 3+ runtime policy

- **Preserve the native runtime first.** Do not introduce a new orchestration framework unless a mature framework is explicitly selected.
- **Do not design a pluggable runtime** unless explicitly requested.
- **Keep sequential workflow stable** while adding supervisor or handoff behavior. New workflow types must not break existing sequential runs.

## Workflow

Before proposing implementation work:

1. Restate the user goal in concise professional English.
2. Identify affected areas:
   - Agent lifecycle
   - Agent configuration
   - Workflow composition
   - Model configuration
   - Soul/persona
   - System prompt
   - Context
   - Memory
   - Tool permissions
   - Handoff policy
   - Persistence
   - Traceability
   - Testing
   - Documentation
3. Define the isolation boundary:
   - What belongs only to one agent?
   - What may be shared?
   - What policy authorizes sharing?
   - What audit trail proves the policy was enforced?
4. **Decide feature scope**: frontend-only, backend-only, or full-stack. State whether existing APIs suffice.
5. Break the work into small tasks with:
   - Objective
   - Affected files or modules
   - Dependencies
   - Acceptance criteria
   - Test approach
6. Separate:
   - **Product goal** — what the user should experience
   - **Lifecycle logic** — state transitions, rules, conditions
   - **UI behavior** — loading, success, error, empty, confirmation states
   - **Backend support** — APIs, services, schemas needed (only if frontend can't satisfy)
   - **Tests** — unit, integration, E2E
   - **Out-of-scope** — explicitly excluded
7. For larger changes, require a short implementation plan before coding.
8. Include data model and API implications when the change affects persisted behavior.
9. Include documentation updates when the change affects setup, architecture, API usage, or user-visible behavior.

## Checklist

- [ ] Repository inspected before planning.
- [ ] Feature scope decided (frontend-only / backend-only / full-stack).
- [ ] Existing APIs assessed: can they support the need?
- [ ] Agent isolation is explicit in the plan.
- [ ] No hidden global memory, context, tools, or settings are introduced.
- [ ] Agent definition and workflow composition remain separate.
- [ ] Soul/persona and system prompt remain separate fields.
- [ ] Soul/persona is not auto-rewritten.
- [ ] No unnecessary new APIs, DB fields, schema changes, or agent_type added.
- [ ] Tool access goes through Tool Gateway.
- [ ] Memory retrieval is scoped by `agent_id`.
- [ ] Context retrieval is scoped by `agent_id`.
- [ ] Handoff is explicit and permission checked.
- [ ] Receiving agents receive only explicit handoff payloads.
- [ ] Runs persist trace events.
- [ ] Runs persist config snapshots for reproducibility.
- [ ] Memory writeback supports manual review mode where applicable.
- [ ] Context assembly is deterministic and inspectable.
- [ ] Pydantic schemas validate important inputs and outputs.
- [ ] PostgreSQL persistence is considered for durable state.
- [ ] Qdrant or a vector memory abstraction is considered for semantic memory.
- [ ] Docker Compose and local development needs are considered.
- [ ] Tests cover permission enforcement and memory/context isolation.
- [ ] Documentation work is included when behavior changes.
- [ ] Product goal, lifecycle logic, UI, backend, tests, and out-of-scope are separated.

## Expected Output

When asked to plan, produce:

1. Goal
2. Scope (frontend-only / backend-only / full-stack; existing API assessment)
3. Assumptions
4. Architecture or Workflow Impact
5. Isolation and Permission Model
6. Data Model and API Notes
7. Task Breakdown (with product goal / lifecycle / UI / backend / tests / out-of-scope)
8. Acceptance Criteria
9. Testing Approach
10. Risks and Mitigations
11. Recommended Next Step

## Done Criteria

A planning task is complete when:

- The scope is clear and buildable.
- Feature scope decision is explicit.
- The isolation model is explicit.
- Agent, workflow, memory, context, tool, and handoff boundaries are defined.
- Each task has acceptance criteria and a test approach.
- The plan avoids unnecessary infrastructure.
- The plan is aligned with Agent Swarm Lab architecture and documentation needs.
