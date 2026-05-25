# Experiment Design

Experiments compare agent behavior under controlled conditions.

## MVP Experiment Flow

The first experiment module should allow a user to:

- Enter a task prompt.
- Select two or more agents.
- Run the same task against each selected agent.
- Compare outputs side by side.
- Open trace links for each run.

Milestone 7 implements this flow with backend experiment APIs and frontend experiment pages. Each selected agent is run through its own single-agent sequential workflow so the same task is compared without sharing private context or memory across agents.

## Experiment Discipline

Each experiment should define:

- Research question
- Hypothesis
- Variables and controls
- Agent configurations
- Workflow configuration
- Isolation and permission assertions
- Input fixtures
- Metrics and rubric
- Trace and snapshot requirements

Output quality is not sufficient. Experiments should also detect unauthorized tool use, cross-agent memory leakage, cross-agent context leakage, and implicit handoff data leakage.

## Learning Loop Experiments

Milestone 9 supports manual before/after learning experiments:

1. Run a workflow task and capture the original run output.
2. Open the run trace and submit human feedback for one participating agent.
3. Optionally submit a rubric evaluation for that same run and agent.
4. Generate a proposed memory through reflection.
5. Approve the proposed memory on the agent detail page.
6. Re-run the same workflow task.
7. Compare old and new outputs, trace events, and retrieved memory IDs.

The experiment should assert:

- Feedback is linked to the original `run_id` and `agent_id`.
- The proposed memory belongs to the same `agent_id`.
- Approval creates active memory only for that agent.
- Rejected proposed memories are not retrieved.
- Other agents do not receive the feedback-derived memory.
- Soul/persona fields are unchanged.

This is intentionally manual in Milestone 9. A dedicated before/after comparison UI can be added later without changing the isolation model.

## Observatory-Assisted Experiments

Milestone 10 adds runtime observability to make experiments easier to audit.

For each run, record and inspect:

- agent execution status and elapsed time
- assembled context for each execution
- retrieved memory IDs
- model request/response summaries
- token usage
- learning events
- execution errors

Useful experiment questions:

- Did approved memory change future behavior for the same agent?
- Did token usage change after adding context or memory?
- Did the agent retrieve only its own memory?
- Did feedback and evaluation events attach to the correct `agent_id`?
- Did different agent personas produce different outputs while preserving isolation?

The observatory should support the analysis without introducing hidden shared state. Conclusions should compare execution records, token summaries, outputs, and learning events across runs.
