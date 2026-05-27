# Agent Learning Loop

Milestone 9 adds a feedback-driven learning loop that changes future agent behavior through agent-specific memory only.

The loop is:

```text
Run output
-> human feedback
-> optional evaluation
-> reflection
-> proposed memory
-> manual approval
-> active memory
-> future run behavior change
```

## Scope

Learning is scoped by `agent_id`. Feedback and evaluations are linked to a specific run and a specific participating agent. A proposed memory cannot become active until a user approves it.

Milestone 9 did not implement Agent Runtime Observatory, live monitoring, token usage dashboards, automatic soul/persona rewriting, or automatic agent configuration mutation. Milestone 10 adds the observatory separately. Soul/persona updates remain a future enhancement and should require an explicit user action.

## Data Model

`AgentFeedback` stores human feedback for one `run_id` and one `agent_id`. It can optionally point at a trace event and include a rating.

`AgentEvaluation` stores a manually submitted rubric evaluation for one `run_id` and one `agent_id`. Scores use the default 1-5 rubric:

- `task_completion`
- `persistence`
- `collaboration`
- `evidence_discipline`
- `tool_usage_quality`
- `handoff_quality`
- `customer_readiness`
- `safety`
- `clarity`

`ProposedMemory` stores a pending memory suggestion for one `agent_id`. It can reference source feedback, source evaluation, or both. Approved proposed memories create normal active `AgentMemory` records for the same agent.

## API Flow

Submit feedback:

```http
POST /runs/{run_id}/agents/{agent_id}/feedback
```

Submit an evaluation:

```http
POST /runs/{run_id}/agents/{agent_id}/evaluate
```

Reflect feedback or evaluation into a pending memory:

```http
POST /runs/{run_id}/agents/{agent_id}/reflect
```

Review proposed memories:

```http
GET /agents/{agent_id}/proposed-memories
POST /agents/{agent_id}/proposed-memories/{memory_id}/approve
POST /agents/{agent_id}/proposed-memories/{memory_id}/reject
```

Approving a proposed memory:

- sets `ProposedMemory.status` to `approved`
- sets `approved_at`
- creates an active `AgentMemory` for the same `agent_id`
- records the `AgentMemory.source` as `proposed_memory:{id}`

Rejecting a proposed memory:

- sets `ProposedMemory.status` to `rejected`
- sets `rejected_at`
- does not create an `AgentMemory`

Rejected proposed memories are not retrieved in future runs because context assembly only reads active `AgentMemory` rows.

## Run Archiving And Learning History

Runs are archived, not hard deleted, from the default frontend cleanup flow. Archiving hides a run from the default Runs list while preserving feedback, evaluations, proposed memories, learning events, trace events, execution records, token usage, and active memories. Archived runs can be activated back into the Active runs list without changing learning records.

Hard deleting a run that has learning records is unsafe because `ProposedMemory.source_feedback_id` and `ProposedMemory.source_evaluation_id` preserve the lineage from human feedback or evaluation to proposed memory. Approved proposed memories can also be represented as active `AgentMemory` records whose `source` points back to the proposed memory. Archiving keeps that history inspectable.

Use the Runs page archive filter to view archived runs. Permanent delete is limited to already archived runs that pass backend safety checks; runs with learning records stay archived and the frontend shows a warning dialog.

## Reflection

`ReflectionService` converts feedback or evaluation into a proposed memory. In mock mode, reflection is deterministic so local tests and experiments do not require an LLM API key. When a real provider (e.g. `openai_compatible`) is configured, the service calls the LLM through the existing provider abstraction to generate higher-quality proposed memory content, falling back to mock reflection on parse failures.

Example feedback:

```text
This agent asked the customer for the Excel file too early. It should first check dashboard filters, date range, metric definition, refresh timestamp, and ETL logic.
```

Mock proposed memory:

```text
In BI discrepancy tasks, first check dashboard filters, date range, metric definition, refresh timestamp, and ETL logic internally before asking the customer for files.
```

The service does not call external LLM APIs directly. Provider-backed reflection goes through the existing provider abstraction.

## Frontend Flow

On a run trace page:

1. Select the participating agent.
2. Enter human feedback and optional rating.
3. Save feedback.
4. Generate a proposed memory.

On an agent detail page:

1. Review pending proposed memories.
2. Approve or reject each proposal.
3. Approved proposals become active memory for that agent.

After approving a proposed memory, re-run the same task to compare behavior.

## Before/After Learning Experiment

Use this manual experiment flow:

1. Run a workflow task and save the baseline output.
2. Open the run trace.
3. Submit feedback for the agent output.
4. Generate a proposed memory.
5. Open the agent detail page.
6. Approve the proposed memory.
7. Re-run the same workflow task.
8. Compare the original output, new output, trace events, and retrieved memory IDs.

Expected isolation assertions:

- The approved memory appears only in future runs for the same `agent_id`.
- Other agents do not retrieve the feedback-derived memory.
- Rejected proposed memories never appear in context assembly.
- Soul/persona fields are unchanged.

## Demo Scenario: Customer Escalation Recovery

A reusable 3-agent sequential workflow that demonstrates the full learning loop with a realistic customer escalation use case.

### Quick Start

```bash
cd backend && python scripts/seed_demo.py
```

This creates three agents (Escalation Triage, Policy Guardrail, Customer Response Writer) and a sequential workflow. The script prints step-by-step instructions and sample inputs.

### Scenario

A customer files a complaint with repeated support contact, a missing item, late delivery, and a chargeback threat. The order number and contact details are already provided.

### Agents

| Agent | Role | Responsibility |
|-------|------|----------------|
| Escalation Triage Agent | escalation-triage | Analyze severity, identify repeated info requests, flag chargeback/public-complaint risk |
| Policy Guardrail Agent | policy-guardrail | Verify refund eligibility, catch promises made before verification, ensure compliance |
| Customer Response Writer | customer-response-writer | Draft empathetic response, never ask for already-provided info, recommend human follow-up |

### Workflow

Sequential: Triage -> Policy Guard -> Response Writer.

### First Run (Before Learning)

Input: A complaint with order #ORD-98234, 3 prior support contacts, missing item, late delivery, chargeback threat, social media risk, and contact details already provided.

Expected issues:
- Agent asks for order number or contact details (already in the complaint)
- Agent fails to flag chargeback and public complaint risk
- Agent promises refund before verification
- Agent does not recommend urgent human follow-up

### Feedback

```text
The agent asked for the order number and contact details when both were already
provided in the complaint. It failed to identify the chargeback threat and social
media risk. It promised a refund without verification. It did not recommend urgent
human follow-up for this high-risk case.
```

Type: correction, Rating: 2/5.

### Reflection -> Approve

Generate proposed memory from feedback, navigate to agent detail, approve. The approved memory teaches the agent:
- Do not ask for information already provided
- Identify chargeback/public complaint risk
- Recommend urgent human follow-up
- Avoid promising refund before verification

### Second Run (After Learning)

Input: A different complaint with order #ORD-10456, subscription upgrade issue, 4 prior contacts, charge dispute threat, consumer protection agency mention.

Expected improvement: The agent's context now includes the approved memory, so the second run should reference the learned lesson. The trace events and config snapshot from the second run show the active memory was included in context assembly.

### E2E Test

The `Customer Escalation Recovery: full learning loop with 3-agent sequential workflow` test in `frontend/e2e/frontend.spec.ts` automates this entire flow.
