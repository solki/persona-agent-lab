# Phase 3 M4 — Handoff Workflow Test Guide

Date: 2026-06-01 | Automated tests: 207 passing

## Overview

This guide covers manual validation scenarios for the handoff_swarm workflow runtime. Automated tests cover parsing, factory dispatch, graph_config validation, trace events, isolation, and sequential/supervisor regression. Manual testing with real LLMs is needed to verify end-to-end handoff chains, policy enforcement, and denial scenarios.

## Agent setup

Create three agents with handoff policies. Use `openai_compatible` provider for real LLM testing:

### Escalation Triage Agent
```json
{
  "name": "TEST-Handoff-Triage",
  "role": "escalation-triage",
  "system_prompt": "You are an escalation triage specialist. Analyze the task. If risk assessment is needed, hand off to the policy/compliance specialist. If a customer response is needed, hand off to the response writer. Once all checks are complete, finish with a final response. Output JSON only with action, target_agent_id (from the available targets provided in context), payload, and reasoning.",
  "llm_provider": "openai_compatible",
  "model": "deepseek-v4-flash",
  "handoff_policy": {
    "allow_handoff": true,
    "allowed_agent_ids": [<policy_agent_id>, <writer_agent_id>]
  }
}
```

### Policy Guardrail Agent
```json
{
  "name": "TEST-Handoff-Policy",
  "role": "policy-guardrail",
  "system_prompt": "You are a policy compliance guard. Review the handoff payload for policy risks. If a customer response is needed, hand off to the response/customer specialist. Otherwise finish with your compliance assessment. Output JSON only.",
  "llm_provider": "openai_compatible",
  "model": "deepseek-v4-flash",
  "handoff_policy": {
    "allow_handoff": true,
    "allowed_agent_ids": [<writer_agent_id>]
  }
}
```

### Customer Response Writer
```json
{
  "name": "TEST-Handoff-Writer",
  "role": "customer-response-writer",
  "system_prompt": "You are a customer response writer. Draft an empathetic, safe response based on the handoff payload and previous assessments. Finish with the final response. Output JSON only.",
  "llm_provider": "openai_compatible",
  "model": "deepseek-v4-flash",
  "handoff_policy": {
    "allow_handoff": false,
    "allowed_agent_ids": []
  }
}
```

> **Important**: Do NOT hardcode numeric `target_agent_id` in system prompts. Use role-based language like "hand off to the policy specialist." The runtime automatically injects available handoff targets with their IDs into each agent's context.

## Runtime-injected handoff targets

The handoff runtime automatically injects available targets into each agent's context prompt. Agents see a section like:

```
## Available handoff targets
- Agent ID: 626
  Name: TEST-Handoff-Policy
  Role: policy-guardrail
  Description: Reviews refund, compliance, promise, legal, and safety risks.
- Agent ID: 627
  Name: TEST-Handoff-Writer
  Role: customer-response-writer
  Description: Drafts safe, empathetic customer responses.
```

Targets are computed as: `participant_agent_ids ∩ handoff_policy.allowed_agent_ids`, minus the current agent, filtered to active agents only. If no targets are available, agents see: "No handoff targets are currently available. You must finish or explain why you cannot proceed."

## Scenario A: Normal handoff chain

**Workflow**:
```json
{
  "name": "TEST: Handoff Escalation Chain",
  "workflow_type": "handoff_swarm",
  "graph_config": {
    "entry_agent_id": <triage_id>,
    "participant_agent_ids": [<triage_id>, <policy_id>, <writer_id>],
    "max_handoffs": 10
  }
}
```

**Task**: "Complex Customer Case #TK-7712: Customer reports double billing, broken feature access, 5 prior contacts with conflicting answers, BBB complaint threat, and social media risk. Coordinate a safe response."

**Expected chain**: Triage → Policy → Writer → finish

**Expected trace events**:
- `handoff_requested` (Triage→Policy)
- `handoff_allowed` (Triage→Policy)
- `handoff_requested` (Policy→Writer)
- `handoff_allowed` (Policy→Writer)
- `handoff_completed` (Writer finishes)
- `run_completed`

**UI checks**:
- Run Detail shows Collaboration section with handoff chain
- Each agent in the chain is listed
- Handoff reason visible
- Final output is from the Writer

## Scenario B: Shuffled participant order

**Workflow**: Same agents, but participant order: `[Writer, Triage, Policy]`

**Expected**: Runtime still produces Triage → Policy → Writer (agents decide order, not config).

**UI checks**: Collaboration view shows actual runtime order, not config order.

## Scenario C: Denied by participant pool

**Workflow**: Remove Policy from `participant_agent_ids`:
```json
"participant_agent_ids": [<triage_id>, <writer_id>]
```

**Expected**: Triage attempts handoff to Policy → `handoff_denied` with reason "not in participants" → Triage should finish or hand off to Writer.

## Scenario D: Denied by sender handoff_policy

**Setup**: Triage's `handoff_policy.allowed_agent_ids` does NOT include Policy (only Writer).

**Workflow**: Keep Policy in `participant_agent_ids`.

**Expected**: Triage attempts handoff to Policy → `handoff_denied` by HandoffEngine → Triage finishes or chooses another target.

## Scenario E: Isolation check

**Setup**: Add private context entries to Triage ("SECRET_TRIAGE_DATA") and Policy ("POLICY_INTERNAL_TOOL").

**Expected**: Policy's context_assembled prompt contains "POLICY_INTERNAL_TOOL" but NOT "SECRET_TRIAGE_DATA". Handoff payload visible to Policy has only the explicit payload text.

## Scenario F: Max handoff limit

**Workflow**: Set `max_handoffs: 1`

**Expected**: Run fails after max_handoffs reached. Error message clear.

## Scenario G: Malformed output

**Setup**: Use an agent with mock provider and poor prompt that produces non-JSON output.

**Expected**: `action_parse_failed` event. Safe fallback to `finish`. Run completes without crash.

## Known limitations

- **Mock provider**: Handoff chains cannot be tested with mock provider because mock output is deterministic text (not JSON). All mock tests use the fallback-to-finish path. Real LLM testing needed for end-to-end handoff chain validation.
- **Collaboration graph**: The graph endpoint for handoff_swarm workflows derives edges from trace events. If trace events are not perfectly ordered, edge reconstruction may be incomplete.
- **No automatic retry**: Denied handoff gives the sender agent a retry message but does not automatically suggest alternatives. The LLM must decide what to do.
- **max_handoffs**: The `max_handoffs` limit counts finish as an iteration (the loop uses `range(max_handoffs + 1)`). A single-agent workflow with max_handoffs=1 works; a 3-agent handoff chain needs max_handoffs >= 3.

## Automated test coverage

| Scenario | Automated | Notes |
|----------|-----------|-------|
| A: Normal chain | Partial | Mock fallback→finish; trace events verified |
| B: Shuffled order | ✅ | Config snapshot verification |
| C: Pool deny | Partial | Workflow runs without crash; real LLM needed for denial trace |
| D: Policy deny | Partial | Policy checked at HandoffEngine level |
| E: Isolation | ✅ | Context scope verified |
| F: Max handoffs | ✅ | Limit enforcement tested |
| G: Malformed output | ✅ | Parse fallback tested |
| Sequential unchanged | ✅ | 2 tests |
| Supervisor unchanged | ✅ | 1 cross-test |
