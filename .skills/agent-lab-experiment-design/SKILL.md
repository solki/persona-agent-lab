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
- **Learning experiments** — testing whether agents improve from feedback across runs

## When Not to Use

Do not use this skill for:

- Implementing production features directly
- Reviewing code without designing an experiment
- Uncontrolled prompt tinkering where inputs, configs, and traces are not captured
- Experiments that intentionally share private agent memory or context without an explicit policy under test

## Core Principles

### 1. Make the hypothesis explicit

Every experiment should state what is being tested before running it. Avoid experiments that merely explore outputs without a question, baseline, or measurable outcome.

**Always define what behavior should change and what should not change** as a result of the experiment.

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

**Experiment records must not use hidden shared state.**

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

## Learning Experiment Canonical Flow

When designing experiments that test the learning loop, include this end-to-end sequence:

1. **Baseline run** → agent produces output
2. **Good output test**: reviewer evaluates good output → returns `memory_decision: "none"` → **no memory created** (negative control)
3. **Bad output test**: reviewer evaluates bad output → returns `corrective` or `refinement` → **pending `ProposedMemory` created**
4. **Approve** the proposed memory → **active `AgentMemory` created**
5. **Re-run** the same or similar task → **behavior changes** (agent now uses the approved memory)
6. **Re-review** the improved output → reviewer confirms **no further memory needed** (proves learning was effective)

Each step must be independently verifiable with trace events and config snapshots.

## Soul Experiment Focus

When designing experiments that test soul/persona effects:

- **Compare action and coordination behavior**, not only final wording. A soul change should produce observably different decision-making, not just different phrasing.
- Keep all other variables (model, temperature, system prompt, context, memory, tools) identical.
- Run multiple trials to distinguish soul-driven variation from LLM randomness.

## Before/After Criteria

Every experiment must define:

- **Before criteria** — what the agent's behavior looks like before the intervention (baseline).
- **After criteria** — what specific observable change proves the intervention worked.
- **Success signal** — the measurement or assertion that confirms the after criteria.
- **Failure signal** — what would disprove the hypothesis.

## Negative Controls

Include negative controls to prevent false positives:

- **Reviewer negative control**: A good output fed to the reviewer must produce `none` (no memory). This proves the reviewer does **not** invent unnecessary corrections.
- **Isolation negative control**: Agent A's approved memory must not affect Agent B's behavior. Run Agent B on the same task before and after Agent A's memory approval — output should be identical.
- **Rejection negative control**: A rejected proposed memory must not appear in context assembly for future runs.

## Test Data Rules

- **Test-created records must use TEST or E2E prefixes** in names.
- **Clean up only experiment-created data** after the experiment. Do not delete user-created or demo seed data.
- **Never use broad cleanup or admin cleanup** to tear down experiment data unless the experiment explicitly tests cleanup behavior.
- **Preserve agent isolation** — experiment records for one agent must not contaminate another agent's data.

## Workflow

For each experiment:

1. Define the research question.
2. Define the hypothesis (what should change, what should not change).
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
7. Define before/after criteria with explicit success/failure signals.
8. Define negative controls (reviewer, isolation, rejection).
9. Define metrics and rubrics.
10. Define isolation assertions:
    - No cross-agent memory access
    - No cross-agent context access
    - No unauthorized tool access
    - No implicit prompt or setting inheritance
    - No private sender state in receiving-agent inputs
11. Define trace and snapshot requirements.
12. Run the smallest useful experiment first.
13. Compare results against the hypothesis.
14. Record conclusions, limitations, and follow-up experiments.

## Checklist

- [ ] The experiment has a clear research question.
- [ ] The hypothesis states what should and should not change.
- [ ] Before/after criteria with explicit success/failure signals are defined.
- [ ] The learning experiment canonical flow is followed where applicable.
- [ ] Soul experiments compare action/coordination, not only wording.
- [ ] Negative controls are included (reviewer none, isolation, rejection).
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
- [ ] Test data uses TEST/E2E prefixes and is safely cleaned up.
- [ ] Conclusions distinguish facts, observations, inferences, and open questions.

## Expected Output

When designing an experiment, produce:

1. Experiment Name
2. Research Question
3. Hypothesis (what changes, what does not change)
4. Before/After Criteria (success signal, failure signal)
5. Variables and Controls
6. Negative Controls (reviewer none, isolation, rejection)
7. Agent Configurations
8. Workflow Configuration
9. Isolation and Permission Assertions
10. Input Fixtures
11. Learning Flow Steps (if applicable)
12. Metrics and Rubric
13. Trace and Snapshot Requirements
14. Execution Plan
15. Test Data Hygiene Plan
16. Analysis Plan
17. Risks and Limitations
18. Follow-up Experiments

## Done Criteria

An experiment design is complete when:

- The hypothesis, variables, controls, and metrics are clear.
- Before/after criteria with success/failure signals are defined.
- Negative controls are included.
- Agent configs and workflow configs are separate.
- Isolation and permission assertions are testable.
- Trace events and config snapshots are required.
- Test data rules (TEST/E2E prefixes, safe cleanup) are specified.
- The design can be rerun and compared.
- The expected output can identify both behavior quality and policy enforcement failures.
