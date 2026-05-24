# Experiment Design

Experiments compare agent behavior under controlled conditions.

## MVP Experiment Flow

The first experiment module should allow a user to:

- Enter a task prompt.
- Select two or more agents.
- Run the same task against each selected agent.
- Compare outputs side by side.
- Open trace links for each run.

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
