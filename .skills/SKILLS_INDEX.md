# Agent Swarm Lab Skills Index

This directory contains the project-specific skills for Agent Swarm Lab. Use them as a compact development workflow: plan the change, implement it, design experiments when behavior needs measurement, and review before treating the work as complete.

## Skills

| Skill | When to Use | Typically Affects |
| --- | --- | --- |
| `agent-lab-planning` | Planning, scoping, decomposing, or refining Agent Swarm Lab work before implementation. | Architecture notes, task plans, API boundaries, data model plans, workflow designs, permission model plans, testing plans, documentation plans. |
| `agent-lab-implementation` | Implementing Agent Swarm Lab code, schemas, APIs, workflows, Tool Gateway integration, memory/context services, handoff policy, persistence, tests, or docs. | `app/`, `api/`, `agents/`, `workflows/`, `tools/`, `memory/`, `context/`, `schemas/`, `storage/`, `tests/`, `docs/`, `docker-compose.yml`, `.env.example`, `README.md`. |
| `agent-lab-review` | Reviewing code, architecture, requirements, pull requests, tests, permission enforcement, isolation, persistence, reproducibility, or documentation. | Diffs across application code, schemas, migrations, tests, Docker Compose, docs, environment examples, and architecture records. |
| `agent-lab-experiment-design` | Designing evaluations, benchmarks, red-team scenarios, workflow trials, agent comparisons, isolation tests, handoff tests, or reproducibility checks. | Experiment plans, fixtures, evaluation rubrics, trace/snapshot requirements, workflow configs, agent configs, test scenarios, run reports. |

## Recommended Order During Development

1. Use `agent-lab-planning` when the change needs scope, architecture, task breakdown, or acceptance criteria.
2. Use `agent-lab-implementation` to make code, schema, test, persistence, Docker Compose, or documentation changes.
3. Use `agent-lab-experiment-design` when behavior should be measured across agents, workflows, models, prompts, memory, tools, or handoff policies.
4. Use `agent-lab-review` before milestone completion, pull requests, merges, or any claim that isolation and permission boundaries are correct.

## Shared Architecture Rules

- Agents are isolated by default.
- There is no hidden shared global context.
- There is no hidden shared global memory.
- Every agent has independent LLM provider, model, temperature, system prompt, soul/persona, context entries, memory store, tool permissions, and handoff policy.
- Tool access goes through Tool Gateway.
- Memory retrieval is scoped by `agent_id`.
- Context retrieval is scoped by `agent_id`.
- Handoff is explicit and permission checked.
- Receiving agents receive explicit handoff payloads, not private memory or private context from sending agents.
- Every run saves trace events.
- Every run should save config snapshots for reproducibility.
- Memory writeback should support manual review mode.
- Context assembly is deterministic and inspectable.
- Workflow is separate from agent definition.
- Soul/persona is separate from system prompt.
