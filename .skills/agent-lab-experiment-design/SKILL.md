---
name: agent-lab-experiment-design
description: Use when designing Agent Swarm Lab experiments, evaluations, benchmarks, red-team scenarios, reproducibility checks, agent comparison runs, workflow trials, memory/context isolation tests, handoff policy experiments, or tool-permission experiments.
---

# Agent Lab Experiment Design Skill

## Purpose

Use this skill to design controlled experiments for Agent Swarm Lab.

The experiment goal is to evaluate agent behavior, workflow composition, isolation, permissions, memory/context handling, handoff behavior, and reproducibility without introducing hidden shared state or uninspectable results.

## When to Use

Use this skill when designing:

- Agent behavior comparisons across providers, models, temperatures, system prompts, or soul/persona settings
- Workflow experiments that compose multiple agents
- Tool permission experiments through Tool Gateway
- Handoff policy experiments
- Memory retrieval and memory writeback experiments
- Context assembly and context sensitivity experiments
- Isolation tests for memory, context, tools, prompts, model settings, or hidden state
- Reproducibility tests using config snapshots and trace events
- Manual review workflows for proposed memory writes
- Evaluation datasets, rubrics, metrics, or run reports

## When Not to Use

Do not use this skill for:

- Implementing production features directly
- Reviewing code without designing an experiment
- Legacy market-research experiments or unrelated report validation
- Uncontrolled prompt tinkering where inputs, configs, and traces are not captured
- Experiments that intentionally share private agent memory or context without an explicit policy under test

## Core Principles

### 1. Make the hypothesis explicit

Every experiment should state what is being tested before running it. Avoid experiments that merely explore outputs without a question, baseline, or measurable outcome.

### 2. Control one dimension at a time where practical

Vary one major factor when possible:

- Provider
- Model
- Temperature
- System prompt
- Soul/persona
- Context entries
- Memory retrieval policy
- Tool permissions
- Handoff policy
- Workflow topology

When multiple factors change, document why and treat conclusions as directional.

### 3. Preserve isolation during experiments

Experiments must not rely on hidden shared global memory, context, or settings. Each agent's configuration must be explicit, and any sharing must be represented as workflow input or permission-checked handoff payload.

### 4. Capture reproducibility artifacts

Each run should save:

- Agent config snapshot
- Workflow config snapshot
- Provider, model, temperature, and model parameters
- Soul/persona and system prompt
- Context assembly metadata
- Memory retrieval metadata
- Tool permissions
- Handoff policy
- Trace events
- Inputs, outputs, and evaluation results

### 5. Evaluate policy enforcement, not only output quality

Agent Swarm Lab experiments should test whether the platform protects boundaries. A polished answer is a failure if it used unauthorized tools, private memory, hidden context, or unapproved handoff data.

## Workflow

For each experiment:

1. Define the research question.
2. Define the hypothesis.
3. Define the agents under test:
   - Agent IDs
   - Provider and model settings
   - Temperature and model parameters
   - Soul/persona
   - System prompt
   - Context entries
   - Memory store or memory fixture
   - Tool permissions
   - Handoff policy
4. Define the workflow separately from the agent definitions.
5. Define what, if anything, may be shared and through which explicit policy.
6. Define input fixtures and expected observable behavior.
7. Define metrics and rubrics.
8. Define isolation assertions:
   - No cross-agent memory access
   - No cross-agent context access
   - No unauthorized tool access
   - No implicit prompt or setting inheritance
   - No private sender state in receiving-agent inputs
9. Define trace and snapshot requirements.
10. Run the smallest useful experiment first.
11. Compare results against the hypothesis.
12. Record conclusions, limitations, and follow-up experiments.

## Checklist

- [ ] The experiment has a clear research question.
- [ ] The hypothesis is stated before execution.
- [ ] Agent definitions are explicit and independent.
- [ ] Workflow composition is defined separately.
- [ ] Soul/persona and system prompt are varied or held constant intentionally.
- [ ] Provider, model, temperature, and parameters are recorded per agent.
- [ ] Context entries are scoped by `agent_id`.
- [ ] Memory stores or fixtures are scoped by `agent_id`.
- [ ] Tool permissions are explicit and enforced through Tool Gateway.
- [ ] Handoff policy is explicit and permission checked.
- [ ] Receiving agents receive only explicit handoff payloads.
- [ ] Manual memory writeback review mode is included when memory learning is tested.
- [ ] Context assembly is deterministic and inspectable.
- [ ] Run trace events are captured.
- [ ] Config snapshots are captured.
- [ ] Metrics and rubrics are defined before evaluation.
- [ ] Expected failure cases are included for permission and isolation tests.
- [ ] Conclusions distinguish facts, observations, inferences, and open questions.

## Expected Output

When designing an experiment, produce:

1. Experiment Name
2. Research Question
3. Hypothesis
4. Variables and Controls
5. Agent Configurations
6. Workflow Configuration
7. Isolation and Permission Assertions
8. Input Fixtures
9. Metrics and Rubric
10. Trace and Snapshot Requirements
11. Execution Plan
12. Analysis Plan
13. Risks and Limitations
14. Follow-up Experiments

## Done Criteria

An experiment design is complete when:

- The hypothesis, variables, controls, and metrics are clear.
- Agent configs and workflow configs are separate.
- Isolation and permission assertions are testable.
- Trace events and config snapshots are required.
- The design can be rerun and compared.
- The expected output can identify both behavior quality and policy enforcement failures.
