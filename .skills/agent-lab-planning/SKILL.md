---
name: agent-lab-planning
description: Use when planning, scoping, decomposing, or refining Agent Swarm Lab work, especially agent definition, workflow composition, isolation boundaries, Tool Gateway permissions, memory/context architecture, handoff policy, traceability, reproducibility, persistence, local development, or documentation.
---

# Agent Lab Planning Skill

## Purpose

Use this skill to plan and structure work for Agent Swarm Lab.

Agent Swarm Lab is a configurable platform where users can create, edit, delete, configure, and compose independent AI agents. Each agent must own its model settings, soul/persona, system prompt, context, memory, tools, and handoff policy.

The planning goal is to turn product or engineering intent into small, buildable tasks while preserving the core invariant: agents are isolated by default and share nothing unless an explicit workflow or handoff policy permits it.

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
- Legacy business-analysis workflows, market-research report generation, or unrelated domain playbooks
- Selecting a mandatory search vendor or forcing a specific external research tool without a project requirement

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
4. Break the work into small tasks with:
   - Objective
   - Affected files or modules
   - Dependencies
   - Acceptance criteria
   - Test approach
5. Separate MVP requirements, later-phase enhancements, and out-of-scope items.
6. Include data model and API implications when the change affects persisted behavior.
7. Include documentation updates when the change affects setup, architecture, API usage, or user-visible behavior.

## Checklist

- [ ] Agent isolation is explicit in the plan.
- [ ] No hidden global memory, context, tools, or settings are introduced.
- [ ] Agent definition and workflow composition remain separate.
- [ ] Soul/persona and system prompt remain separate fields.
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

## Expected Output

When asked to plan, produce:

1. Goal
2. Scope
3. Assumptions
4. Architecture or Workflow Impact
5. Isolation and Permission Model
6. Data Model and API Notes
7. Task Breakdown
8. Acceptance Criteria
9. Testing Approach
10. Risks and Mitigations
11. Recommended Next Step

## Done Criteria

A planning task is complete when:

- The scope is clear and buildable.
- The isolation model is explicit.
- Agent, workflow, memory, context, tool, and handoff boundaries are defined.
- Each task has acceptance criteria and a test approach.
- The plan avoids unnecessary infrastructure.
- The plan is aligned with Agent Swarm Lab architecture and documentation needs.
