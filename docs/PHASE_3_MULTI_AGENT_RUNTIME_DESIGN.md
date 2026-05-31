# Phase 3 Multi-Agent Runtime Design

Date: 2026-05-30 | Status: Design Report (pre-implementation) | Branch: `feature/phase3`

## 1. Executive Summary

Phase 3 extends the Agent Swarm Lab from single-agent sequential chains to true multi-agent coordination. Two new workflow types — **supervisor** and **handoff_swarm** — will replace the current placeholder stubs with a native runtime implementation. No external orchestration frameworks are introduced. The existing sequential workflow remains stable and unchanged.

The core design adds:
- **SupervisorRunner**: a dispatcher loop where a supervisor agent delegates tasks to worker agents, collects responses, and decides next steps.
- **HandoffSwarmRunner**: a chain where agents process input and voluntarily hand off to the next agent based on their `handoff_policy`.
- **Collaboration observability**: new trace event types and a collaboration graph endpoint for visualizing agent-to-agent communication.
- **Soul behavior experiments**: comparing how different supervisor/handoff personalities affect coordination outcomes.
- **Teamwork learning demo**: a multi-agent customer escalation scenario where a supervisor learns to delegate better over time.

The native runtime is preserved. No pluggable runtime. No framework migration. The design extends what already works while keeping agent isolation as the central invariant.

## 2. Current Architecture Assessment

### What exists and works

| Component | Status | What it does |
|-----------|--------|--------------|
| `WorkflowRunner` (279 lines) | Stable | Executes sequential workflows with full trace/observatory integration |
| `ContextAssembler` (99 lines) | Stable | Builds 9-section prompt scoped by `agent_id` |
| `ProviderFactory` (37 lines) | Stable | Routes to mock or openai_compatible provider |
| `HandoffEngine` (20 lines) | Stable but unused | Evaluates handoff policy: checks `allow_handoff` flag + `allowed_agent_ids` |
| `Workflow` model | Stable | `workflow_type` enum: sequential, supervisor, handoff_swarm; `graph_config` JSON |
| `Agent` model | Stable | `handoff_policy` JSON with `allow_handoff` + `allowed_agent_ids` |
| `AgentExecution` model | Stable | Tracks per-agent execution state, timing, input/output |
| `Run` model | Stable | Tracks overall run state with config snapshot |
| Observatory service | Stable | Creates executions, events, token usage; monitor endpoint |
| Review service | Stable | Agent-to-agent evaluation with dynamic criteria |

### What exists as placeholders

| Component | Current state |
|-----------|---------------|
| Supervisor workflow | Schema accepts `"supervisor"`; `WorkflowRunner.start()` raises `ValueError("Workflow type supervisor is a placeholder in the MVP runtime.")` |
| Handoff swarm workflow | Schema accepts `"handoff_swarm"`; same ValueError |
| Handoff engine integration | `HandoffEngine` class exists with `evaluate()` method but is never called by any runner |
| Provider tool_call | `ProviderInterface.tool_call()` defined but unimplemented in mock; openai_compatible supports it via SDK |

### What's missing for multi-agent coordination

1. **No structured action decision parsing** — agent output is just text passed to the next agent. For supervisor/handoff, agents must produce structured decisions (delegate to X, handoff to Y, finish).
2. **No dispatch loop** — the sequential runner is a simple for-loop over an ordered list. Supervisor needs a while-loop with dynamic agent selection.
3. **No collaboration trace events** — current events (`agent_selected`, `agent_output`, etc.) don't capture supervisor→worker delegation or handoff chains.
4. **No parent-child execution relationships** — `AgentExecution` has no `parent_execution_id` to represent supervisor spawning worker tasks.
5. **No collaboration graph endpoint** — observatory has no API for visualizing agent-to-agent communication topology.

## 3. Recommended Phase 3 Milestone Order

### M1: Supervisor Workflow Runtime (2-3 sessions)

**Why first**: Supervisor is the simpler multi-agent pattern. It has one dispatcher + N workers with a clear hierarchy. It validates the action-decision parsing, the dispatch loop, and collaboration tracing without the complexity of peer-to-peer handoffs.

**Deliverables**:
- `SupervisorRunner` class (extends or parallels `WorkflowRunner`)
- Action decision parser (structured JSON extraction from agent output)
- `graph_config` convention: `{supervisor_agent_id, worker_agent_ids, max_iterations}`
- Supervisor-specific trace events: `supervisor_delegated`, `worker_responded`, `supervisor_decision`
- Frontend: supervisor workflow config UI, run detail with delegation tree

**Existing APIs support this**: YES — `POST /workflows/{id}/run` works for all workflow types. `/runs/{id}/monitor`, `/runs/{id}/trace` already show execution data.

### M2: Collaboration Observability (1-2 sessions)

**Why second**: After supervisor runs produce collaboration data, we need proper visualization. This milestone adds the collaboration graph endpoint and frontend visualization that benefits both supervisor and handoff workflows.

**Deliverables**:
- `parent_execution_id` column on `AgentExecution` (nullable FK to self)
- `GET /runs/{id}/collaboration-graph` endpoint
- Collaboration graph frontend component (delegation tree / handoff chain diagram)
- New trace event types for all multi-agent interactions

**Existing APIs support this**: PARTIAL — new `collaboration-graph` endpoint needed; existing observatory endpoints cover individual executions.

### M3: Soul Behavior Experiment (1-2 sessions)

**Why third**: With supervisor working and collaboration observable, we can now run controlled experiments comparing different soul/persona configurations on coordination behavior. This milestone produces reusable experiment templates.

**Deliverables**:
- Soul experiment framework: compare same supervisor task with different souls
- Before/after criteria for coordination behavior (not just output wording)
- Experiment templates: authoritative vs collaborative supervisor; risk-averse vs eager handoff
- Documented experiment results

**Existing APIs support this**: YES — `POST /experiments` with agent_ids varying only in soul_id. Existing run/observatory APIs provide data for comparison.

### M4: Handoff Workflow Runtime (2-3 sessions)

**Why fourth**: Handoff is more complex — agents must self-select the next agent, and handoff chains are non-deterministic. Best implemented after we have proven action-decision parsing and collaboration tracing work in the simpler supervisor case.

**Deliverables**:
- `HandoffSwarmRunner` class
- Handoff decision parsing from agent output
- `HandoffEngine` integration into runner
- `graph_config` convention: `{entry_agent_id, participant_agent_ids, max_handoffs}`
- Handoff-specific trace events: `handoff_requested`, `handoff_allowed`, `handoff_denied`, `handoff_completed`

**Existing APIs support this**: YES — same as supervisor. No new endpoints for execution.

### M5: Teamwork Learning Demo (1-2 sessions)

**Why fifth**: The capstone demo that ties everything together. A multi-agent customer escalation scenario where supervisor delegation quality improves through feedback → reflection → memory approval → re-run.

**Deliverables**:
- Demo seed: supervisor + 3 worker agents (triage, policy, response) + reviewer
- Scenario: complex customer complaint requiring coordinated multi-agent response
- Learning loop: supervisor initially delegates poorly → reviewer feedback → reflection → approved memory → re-run → improved delegation
- Demo page updates for multi-agent workflows

**Existing APIs support this**: YES — demo seed API, feedback/reflect/approve APIs, reviewer feedback API all work for multi-agent runs.

## 4. Native Runtime Strategy

### Decision: Stay with native runtime

**Reasons to stay native**:
1. The current `WorkflowRunner` is 279 lines — small, understandable, well-tested.
2. The platform already has PostgreSQL persistence, execution tracking, token usage, and trace events.
3. The provider abstraction already supports real LLMs.
4. No external framework (LangGraph, CrewAI, AutoGen) is needed for supervisor (while-loop) or handoff (chain with switch).
5. Staying native preserves full control over trace events, config snapshots, and isolation enforcement.
6. The mock provider + deterministic tests model works perfectly with native runners.

**When to reconsider**: Only if Phase 3 reveals that the native runtime cannot handle a specific coordination pattern that the product requires, AND a mature framework (1.0+) is available that doesn't compromise isolation, traceability, or test determinism.

### Architecture extension

```
Current:
  POST /workflows/{id}/run
    → WorkflowRunner.run()
      → WorkflowRunner.start()    # validate + create Run + AgentExecutions
      → WorkflowRunner.execute_run()  # for-loop over agent_sequence
        → ContextAssembler.assemble()
        → Provider.generate()
        → observatory_service.complete_execution()

Phase 3:
  POST /workflows/{id}/run
    → RunnerFactory.create(workflow)  # NEW: dispatches to correct runner
      → SequentialRunner (renamed WorkflowRunner)  # unchanged logic
      → SupervisorRunner  # NEW: while-loop with dispatch
      → HandoffSwarmRunner  # NEW: chain with handoff decisions
```

### RunnerFactory pattern

```python
def create_runner(db: Session, workflow: Workflow) -> BaseRunner:
    settings = get_settings()
    provider = create_provider(settings)
    if workflow.workflow_type == "sequential":
        return SequentialRunner(db, provider, settings)
    if workflow.workflow_type == "supervisor":
        return SupervisorRunner(db, provider, settings)
    if workflow.workflow_type == "handoff_swarm":
        return HandoffSwarmRunner(db, provider, settings)
    raise ValueError(f"Unknown workflow type: {workflow.workflow_type}")
```

Each runner implements a common `BaseRunner` interface: `start(workflow, task) → Run`, `execute_run(run_id) → Run`, `fail_run(run_id, error) → Run`.

This is NOT a pluggable runtime framework — it's a simple dispatch to three concrete classes. No plugin registry, no dynamic loading, no configuration-driven behavior.

## 5. Supervisor Workflow Design

### Product goal

A single supervisor agent coordinates N worker agents. The supervisor receives a task, decides which worker to delegate to, sends instructions, receives the worker's output, and repeats until the task is complete. The supervisor makes the final decision about when to stop.

### Execution loop

```
1. Create Run + supervisor AgentExecution + N worker AgentExecutions (queued)
2. Assemble supervisor context
3. Loop (max max_iterations):
   a. Supervisor generates decision: {action: "delegate"|"finish", agent_id?, instruction?}
   b. If "finish": break loop
   c. If "delegate":
      - Look up worker agent by agent_id
      - Validate worker is in graph_config.worker_agent_ids
      - Assemble worker context (includes supervisor's instruction as task)
      - Worker generates response
      - Append (worker_output) to supervisor's accumulated context
      - Loop back to step (a)
4. Final supervisor response becomes run output
5. Mark run completed
```

### Supervisor decision format

The supervisor agent must produce a structured JSON decision. The `ActionDecisionParser` extracts this from the agent's text output:

```json
{
  "action": "delegate",
  "agent_id": 2,
  "instruction": "Analyze the chargeback risk in this complaint and report back.",
  "reasoning": "The Policy Guardrail agent specializes in risk assessment."
}
```

or:

```json
{
  "action": "finish",
  "final_response": "Based on the triage analysis and policy review, here is the customer response...",
  "reasoning": "All necessary analysis is complete."
}
```

### ActionDecisionParser

A shared utility used by both SupervisorRunner and HandoffSwarmRunner:

1. Search agent output for JSON block (markdown fence or raw).
2. Parse JSON.
3. Validate against `SupervisorDecision` or `HandoffDecision` Pydantic schema.
4. If validation fails, attempt 3-attempt JSON repair (same strategy as review_service).
5. If repair fails, fall back: treat entire output as `{action: "finish", final_response: raw_text}`.
6. Emit trace events for parse success/failure.

### graph_config for supervisor

```json
{
  "supervisor_agent_id": 1,
  "worker_agent_ids": [2, 3, 4],
  "max_iterations": 10
}
```

- `supervisor_agent_id` (required): which agent acts as supervisor.
- `worker_agent_ids` (required): which agents the supervisor can delegate to.
- `max_iterations` (optional, default 10): safety limit to prevent infinite loops.

### Supervisor context assembly

The supervisor's context includes:
1. Platform safety rules (standard)
2. Soul/persona (standard)
3. Agent role: "supervisor" (standard)
4. System prompt: includes delegation instructions
5. Agent-specific context entries (standard)
6. Agent-specific memory (standard)
7. **Accumulated worker outputs** (NEW — scoped to this run): a running log of "(worker_name): (worker_output)" for each delegation so far, plus "(iteration N of M)".
8. Current task / next decision prompt
9. Output format instruction: must produce JSON with action/agent_id/instruction or action/final_response

Worker context is standard — the supervisor's `instruction` field becomes the worker's task.

### Isolation invariants

- Supervisor cannot access worker agents' private memory or context.
- Workers receive only the supervisor's instruction text, not the supervisor's full context.
- Worker outputs are accumulated in the supervisor's run-scoped context (not persisted to any agent's memory).
- Agent-specific memory is only retrieved for the currently-executing agent.

## 6. Collaboration Observability Design

### parent_execution_id

Add a nullable `parent_execution_id` column to `agent_executions`:

```python
parent_execution_id: Mapped[Optional[int]] = mapped_column(
    ForeignKey("agent_executions.id"), nullable=True, index=True
)
```

For sequential workflows: all `parent_execution_id` are NULL (no hierarchy).
For supervisor: worker executions have `parent_execution_id` pointing to the supervisor execution.
For handoff: each handoff creates a new execution with `parent_execution_id` pointing to the previous agent's execution (chain).

### New trace event types

| Event type | Emitted when | payload |
|-----------|-------------|---------|
| `supervisor_delegated` | Supervisor delegates to a worker | `{from_agent_id, to_agent_id, instruction, iteration}` |
| `worker_responded` | Worker completes and returns to supervisor | `{from_agent_id, to_agent_id, content_preview, elapsed_ms}` |
| `supervisor_decision` | Supervisor decides next action | `{decision: {action, agent_id?, instruction?, final_response?}, iteration}` |
| `handoff_requested` | Agent requests handoff to another agent | `{from_agent_id, to_agent_id, reason}` |
| `handoff_allowed` | HandoffEngine approves the handoff | `{from_agent_id, to_agent_id, payload_preview}` |
| `handoff_denied` | HandoffEngine denies the handoff | `{from_agent_id, to_agent_id, reason}` |
| `handoff_completed` | Handoff chain completes (agent decides not to hand off) | `{final_agent_id, chain_length, agent_sequence}` |
| `action_parse_succeeded` | ActionDecisionParser successfully parsed output | `{agent_id, parsed_decision}` |
| `action_parse_failed` | ActionDecisionParser fallback used | `{agent_id, raw_preview, error}` |

### Collaboration graph endpoint

`GET /runs/{run_id}/collaboration-graph` returns:

```json
{
  "run_id": 42,
  "workflow_type": "supervisor",
  "nodes": [
    {"agent_id": 1, "agent_name": "Supervisor", "role": "supervisor", "execution_count": 1},
    {"agent_id": 2, "agent_name": "Triage", "role": "escalation-triage", "execution_count": 1},
    {"agent_id": 3, "agent_name": "Policy", "role": "policy-guardrail", "execution_count": 1}
  ],
  "edges": [
    {"from_agent_id": 1, "to_agent_id": 2, "type": "delegation", "instruction": "...", "iteration": 1},
    {"from_agent_id": 2, "to_agent_id": 1, "type": "response", "content_preview": "...", "elapsed_ms": 1234},
    {"from_agent_id": 1, "to_agent_id": 3, "type": "delegation", "instruction": "...", "iteration": 2},
    {"from_agent_id": 3, "to_agent_id": 1, "type": "response", "content_preview": "...", "elapsed_ms": 987}
  ],
  "chain_summary": {
    "supervisor_iterations": 2,
    "total_handoffs": 0,
    "final_decision": "finish"
  }
}
```

For handoff workflows, edges use `type: "handoff"` instead of `delegation`/`response`.

### Frontend visualization

The Run Detail page gains a **Collaboration Graph** tab showing:
- A top-down tree for supervisor workflows (supervisor at top, workers below, edges labeled with iteration number)
- A left-to-right chain for handoff workflows (agents in sequence, edges labeled with handoff reason)
- Click on any node to navigate to that agent's execution detail
- Hover on any edge to see the instruction or content preview

## 7. Handoff Workflow Design

### Product goal

Agents in a handoff swarm process a task and voluntarily transfer it to the next agent based on their handoff_policy. Unlike supervisor (top-down dispatch), handoff is peer-to-peer: each agent decides "I've done my part, now Agent X should handle the next step." The chain ends when an agent decides not to hand off.

### Execution loop

```
1. Create Run + entry agent AgentExecution (queued)
2. Set current_agent = entry agent; chain = [entry_agent.id]
3. Loop (max max_handoffs):
   a. Assemble current_agent context (includes handoff history)
   b. Current agent generates response with handoff decision:
      {action: "handoff"|"finish", target_agent_id?, payload?, reasoning?}
   c. If "finish": break loop — current agent's output is final
   d. If "handoff":
      - Validate target_agent_id is in participant_agent_ids
      - HandoffEngine.evaluate(sender_policy, target_agent_id, payload)
      - If allowed:
        * Create AgentExecution for target agent (parent = current execution)
        * Emit handoff_allowed + handoff_completed (previous) events
        * Set current_agent = target agent; append to chain
      - If denied:
        * Emit handoff_denied event
        * Continue: current agent stays, but with "handoff denied; please try another agent or finish" feedback
4. Run completes with chain as output
```

### Handoff decision format

```json
{
  "action": "handoff",
  "target_agent_id": 3,
  "payload": {
    "summary": "Customer complaint involves a chargeback threat. Escalation triage complete — needs policy review.",
    "key_findings": ["Order #ORD-98234", "Chargeback threatened", "3 prior contacts"],
    "urgency": "high"
  },
  "reasoning": "Policy Guardrail should review chargeback risk before we draft a response."
}
```

### graph_config for handoff

```json
{
  "entry_agent_id": 1,
  "participant_agent_ids": [1, 2, 3, 4],
  "max_handoffs": 20
}
```

- `entry_agent_id` (required): which agent starts the chain.
- `participant_agent_ids` (required): agents allowed to participate (handoffs to non-participants are denied).
- `max_handoffs` (optional, default 20): safety limit to prevent infinite loops.

### Handoff context assembly

Each agent's context includes:
1-6. Standard sections (platform rules, soul, role, system prompt, context, memory)
7. **Handoff history** (NEW): a running log of "(from_agent N) → (to_agent M): (payload summary)" for each handoff in the chain so far.
8. Current task
9. Output format instruction: must produce JSON with action/target_agent_id/payload or action/final_response

### Isolation invariants

- The `payload` field is the ONLY information transferred between agents. No private context, memory, or tools leak.
- `HandoffEngine.evaluate()` checks `sender_policy.allow_handoff` AND `target_agent_id in sender_policy.allowed_agent_ids`.
- Handoff history is run-scoped, not persisted to any agent. Each agent sees only the chain so far as plain text.
- If an agent has `allow_handoff: false` or empty `allowed_agent_ids`, any handoff request from that agent is denied.

## 8. Soul Behavior Experiment Design

### Goal

Prove that soul/persona configuration produces measurably different multi-agent coordination behavior — not just different wording, but different action/coordination patterns.

### Experiment 1: Authoritative vs Collaborative Supervisor

**Setup**: Same supervisor agent, same 3 workers, same task. Only `soul_id` differs.

| Dimension | Authoritative Soul | Collaborative Soul |
|-----------|-------------------|---------------------|
| Decision style | "Decisive, assigns tasks without consultation, favors speed" | "Consensus-seeking, asks workers for input before deciding, favors thoroughness" |
| Collaboration style | "Directs workers with clear, brief instructions" | "Invites worker perspectives, synthesizes multiple inputs" |
| Escalation style | "Makes final call independently" | "Escalates only after attempting group resolution" |

**Task**: A complex customer complaint requiring triage, policy, and response input.

**Expected behavioral differences**:
- Authoritative: fewer iterations (1-2 delegations), shorter instructions, faster completion.
- Collaborative: more iterations (3-5), may delegate to same worker twice, more context in instructions.
- Both should produce a valid final resolution.

**Success criteria**: The observable coordination graph (delegation count, instruction length, iteration pattern) differs between souls in statistically significant ways across 5 runs each.

### Experiment 2: Risk-Averse vs Eager Handoff Agent

**Setup**: Same handoff chain (entry → policy → response). Only entry agent's soul differs.

| Dimension | Risk-Averse Soul | Eager Handoff Soul |
|-----------|-----------------|---------------------|
| Decision style | "Thorough, prefers to complete work independently before handing off" | "Fast, delegates quickly to keep the process moving" |
| Collaboration style | "Only hands off when absolutely necessary" | "Hands off as soon as relevant expertise is needed" |

**Expected behavioral differences**:
- Risk-averse: handoff later in chain (more of its own analysis first), longer payload content.
- Eager: handoff earlier, shorter payload, may skip steps that could be done by next agent.

**Success criteria**: Handoff chain length, payload size, and total tokens differ between souls.

### Experiment framework

Both experiments use the same template:
1. Create two souls with controlled differences
2. Clone the same agent twice, differing only in `soul_id`
3. Run the same task 5 times per soul variant
4. Compare delegation/handoff metrics using observatory data
5. Document statistical differences

**Existing APIs support this**: YES — `POST /souls`, `POST /agents`, `POST /workflows`, `POST /workflows/{id}/run` + observatory endpoints.

## 9. Teamwork Learning Demo Design

### Scenario

A complex customer complaint that requires coordinated multi-agent handling. The supervisor initially delegates poorly (wrong order, missing context). After reviewer feedback and learning, the supervisor improves its delegation.

### Demo agents

| Agent | Role | Purpose |
|-------|------|---------|
| Resolution Coordinator | `team-supervisor` | Supervisor — decides who handles what and when |
| Escalation Triage | `escalation-triage` | Worker — analyzes complaint severity and risk signals |
| Policy Guardrail | `policy-guardrail` | Worker — checks policy compliance and refund rules |
| Customer Response Writer | `customer-response-writer` | Worker — drafts empathetic customer response |
| Quality Reviewer | `quality-reviewer` | Reviewer — evaluates supervisor's delegation quality (not in workflow) |

### Workflow

```json
{
  "workflow_type": "supervisor",
  "graph_config": {
    "supervisor_agent_id": 1,
    "worker_agent_ids": [2, 3, 4],
    "max_iterations": 10
  }
}
```

### Complaint text

```
Complex Customer Case #TK-7712:
Customer Sarah Chen has been a premium subscriber for 4 years ($299/mo).
She reports three issues in one complaint:
1. Billing: Charged twice last month ($299 x 2) — needs refund verification
2. Feature access: Premium features stopped working after the double-charge
3. Support experience: "I've called 5 times and each agent gives me a different answer.
   If this isn't resolved today I'm canceling and filing a BBB complaint."

Additional context from CRM:
- Previous refund request #REF-8821 denied (outside 30-day window, but double-charge is different)
- Customer has 12,000 loyalty points unused
- Last NPS score: 2/10 (detractor)
- Recent social media: "worst support experience of my life" (Twitter, 45 retweets)
```

### Learning loop steps

1. **Baseline run**: Supervisor delegates in wrong order — sends to Response Writer first (before Triage/Policy), resulting in incomplete resolution.

2. **Reviewer feedback**: Quality Reviewer evaluates the supervisor's delegation pattern:
   - FAIL: Delegated to Response Writer before Triage completed risk assessment.
   - FAIL: Did not provide Policy Guardrail with the double-charge context.
   - FAIL: Missed CRM context (loyalty points, NPS score, social media risk).
   - Evaluator type: `agent_reviewer`, memory_decision: `corrective`.

3. **Reflection → Proposed memory**:
   ```
   memory_type: "delegation_lesson"
   content: "For complex multi-issue complaints, always delegate to Triage first
   for risk assessment, then Policy for compliance check, then Response Writer
   for drafting. Include relevant CRM context in each delegation instruction.
   Never delegate to Response Writer before Triage and Policy have completed."
   importance: 90
   ```

4. **Approve → Active memory**.

5. **Re-run**: Supervisor now delegates in correct order (Triage → Policy → Response), includes CRM context in instructions.

6. **Re-review**: Quality Reviewer confirms improved delegation:
   - PASS: Correct delegation order
   - PASS: Context included in instructions
   - memory_decision: `none` (no further corrections needed)

### Frontend demo page updates

- Demo seed creates supervisor workflow instead of sequential.
- Acceptance checklist updated for multi-agent coordination.
- Collaboration graph visible in run detail to show delegation tree before/after.

## 10. Agent Action Decision Recommendation

### Question

Should agent action decisions (delegate, handoff, finish) be a separate service, embedded in runner logic, or part of the agent definition?

### Recommendation: Embedded in runner, with shared parsing

**Action decision parsing is a shared utility** (`ActionDecisionParser`), not a service. It is a pure function: text in → validated decision struct out.

**Decision execution is runner-specific**:
- `SupervisorRunner` owns the dispatch loop and interprets `delegate`/`finish` actions.
- `HandoffSwarmRunner` owns the handoff chain and interprets `handoff`/`finish` actions.

**The agent definition does NOT encode action decision logic**. The agent's system prompt instructs it to produce structured JSON, but the interpretation and execution of that JSON belongs to the runner.

**Rationale**:
1. **Simplicity**: A shared parser + runner-specific loops is simpler than a separate decision service with its own database state.
2. **Testability**: Each runner's decision handling is tested in isolation. The parser is tested with edge-case JSON.
3. **No new models**: Action decisions are ephemeral run state, not persisted entities. They appear in trace events but not in their own table.
4. **Consistency with current architecture**: The workflow runner already owns execution logic. Supervisor/Handoff runners follow the same pattern — they just have loops instead of a fixed sequence.

### Pydantic schemas for action decisions

```python
class SupervisorDecision(BaseModel):
    action: Literal["delegate", "finish"]
    agent_id: Optional[int] = None  # required for "delegate"
    instruction: Optional[str] = None  # required for "delegate"
    final_response: Optional[str] = None  # required for "finish"
    reasoning: Optional[str] = None

class HandoffDecision(BaseModel):
    action: Literal["handoff", "finish"]
    target_agent_id: Optional[int] = None  # required for "handoff"
    payload: Optional[dict] = None  # required for "handoff"
    final_response: Optional[str] = None  # required for "finish"
    reasoning: Optional[str] = None
```

## 11. Graph Config Proposal

### Current

```json
// sequential
{"agent_sequence": [1, 2, 3]}
```

### Proposed

```json
// sequential (unchanged)
{"agent_sequence": [1, 2, 3]}

// supervisor
{
  "supervisor_agent_id": 1,
  "worker_agent_ids": [2, 3, 4],
  "max_iterations": 10
}

// handoff_swarm
{
  "entry_agent_id": 1,
  "participant_agent_ids": [1, 2, 3, 4],
  "max_handoffs": 20
}
```

### Backward compatibility

- Sequential workflows continue to read `agent_sequence` from `graph_config`.
- New runners read their own keys (`supervisor_agent_id`, `entry_agent_id`, etc.).
- No migration needed — `graph_config` is already JSON with no fixed schema in the database.
- Schema validation can check that required keys are present per workflow_type (Pydantic `@field_validator` on WorkflowCreate/WorkflowUpdate).

### Extensibility

`graph_config` remains free-form JSON for future needs. The schema validation per workflow_type ensures required keys are present without constraining future extensions. Examples of future keys:

```json
// supervisor with worker-specific instructions
{
  "supervisor_agent_id": 1,
  "worker_agent_ids": [2, 3],
  "max_iterations": 10,
  "worker_instructions": {
    "2": "Focus on risk signals",
    "3": "Focus on policy compliance"
  }
}
```

## 12. Trace Event Proposal

### Existing events (kept, unchanged)

`run_started`, `workflow_loaded`, `agent_selected`, `context_assembled`, `memory_retrieved`, `llm_request_started`, `llm_response_received`, `agent_output`, `memory_proposed`, `memory_write_proposed`, `agent_completed`, `run_completed`, `run_failed`

### New events for multi-agent coordination

| Event | Workflow Type | payload |
|-------|--------------|---------|
| `supervisor_delegated` | supervisor | `{from_execution_id, to_agent_id, to_agent_name, instruction, iteration, total_iterations}` |
| `worker_responded` | supervisor | `{from_agent_id, from_agent_name, to_execution_id, content_preview, elapsed_ms}` |
| `supervisor_decision` | supervisor | `{execution_id, decision: {action, agent_id?, instruction?, final_response?}, iteration}` |
| `handoff_requested` | handoff_swarm | `{from_execution_id, from_agent_id, to_agent_id, requested_at}` |
| `handoff_allowed` | handoff_swarm | `{from_execution_id, from_agent_id, to_agent_id, to_execution_id, payload_summary}` |
| `handoff_denied` | handoff_swarm | `{from_execution_id, from_agent_id, to_agent_id, reason}` |
| `handoff_completed` | handoff_swarm | `{final_execution_id, final_agent_id, chain_agent_ids, total_handoffs, elapsed_ms}` |
| `action_parse_succeeded` | both | `{execution_id, parsed_action, raw_length}` |
| `action_parse_failed` | both | `{execution_id, error, raw_preview, fallback_action}` |

Event types are plain strings — no new enum or database migration needed. The new types document the coordination flow without changing the `trace_events` table.

## 13. Frontend UX Proposal

### Workflow form changes

**Workflow type selector** (already exists as a dropdown):
- Sequential: show agent_sequence editor (existing, unchanged)
- Supervisor: show supervisor picker + worker multi-select + max_iterations (NEW)
- Handoff Swarm: show entry agent picker + participant multi-select + max_handoffs (NEW)

**Agent picker**: Reuse the existing agent selection component. Filter to active agents.

### Run detail changes

**New tab: Collaboration** (between Trace and Monitor tabs):
- Supervisor view: delegation tree (SVG or CSS-based hierarchy diagram)
  - Supervisor node at top
  - Worker nodes below, connected by delegation edges
  - Edge labels: iteration number, instruction preview on hover
  - Worker→Supervisor response edges shown as dashed lines
- Handoff view: handoff chain (horizontal stepper)
  - Agent nodes in sequence
  - Edge labels: handoff reason, allowed/denied badge
  - Chain length and total handoffs summary

### Run monitor changes

- Show which agent is currently executing (already works via `active_agent_execution`).
- For supervisor: show iteration counter (e.g., "Iteration 2/10 — delegating to Policy Guardrail").
- For handoff: show chain position (e.g., "Handoff 3/20 — Triage → Policy").
- Active agent's collaboration context visible in execution detail.

### Agent detail changes

- No new fields. Existing `handoff_policy` JSON editor already supports `allow_handoff` + `allowed_agent_ids`.
- Optionally show handoff_policy in plain language: "This agent can hand off to: Policy Guardrail, Response Writer" or "Handoff disabled."

### Existing APIs support assessment

| UX Change | New API needed? |
|-----------|----------------|
| Workflow form (supervisor config) | NO — `POST /workflows` already accepts `graph_config` JSON |
| Workflow form (handoff config) | NO — same |
| Collaboration graph | YES — `GET /runs/{id}/collaboration-graph` (new) |
| Run monitor updates | PARTIAL — existing `GET /runs/{id}/monitor` suffices; add iteration/chain info to response |
| Agent handoff_policy view | NO — existing `GET /agents/{id}` already returns `handoff_policy` |

**One new API endpoint needed**: `GET /runs/{run_id}/collaboration-graph`. All other frontend needs are satisfied by existing APIs with minor response enrichment.

## 14. Backend/API Impact

### New files

| File | Purpose |
|------|---------|
| `backend/app/runtime/base_runner.py` | Abstract base class for all runners (start/execute/fail interface) |
| `backend/app/runtime/supervisor_runner.py` | SupervisorRunner class |
| `backend/app/runtime/handoff_swarm_runner.py` | HandoffSwarmRunner class |
| `backend/app/runtime/action_decision_parser.py` | ActionDecisionParser utility |
| `backend/app/schemas/actions.py` | SupervisorDecision, HandoffDecision Pydantic models |
| `backend/app/services/collaboration_service.py` | Build collaboration graph from trace events |

### Modified files

| File | Change |
|------|--------|
| `backend/app/runtime/workflow_runner.py` | Rename to `SequentialRunner`; extract shared logic to `BaseRunner`; keep all existing behavior |
| `backend/app/api/workflows.py` | `run_workflow` endpoint: use RunnerFactory instead of hardcoded WorkflowRunner |
| `backend/app/api/runs.py` | Add `GET /runs/{run_id}/collaboration-graph` endpoint |
| `backend/app/schemas/runs.py` | Add `CollaborationGraphResponse` schema |
| `backend/app/models/observatory.py` | Add `parent_execution_id` to `AgentExecution` |
| `backend/app/schemas/observatory.py` | Add `parent_execution_id` to execution schemas |
| `backend/app/runtime/context_assembler.py` | Add `assemble_for_coordination()` method supporting multi-agent context (accumulated outputs, handoff history) |
| `backend/app/database.py` | Add `parent_execution_id` column migration |
| `backend/app/services/demo_service.py` | Add supervisor demo seed option |

### No new API routers

All changes fit within existing routers:
- `POST /workflows/{id}/run` — runner dispatch (modify existing)
- `GET /runs/{id}/collaboration-graph` — new endpoint in existing runs router
- `GET /runs/{id}/monitor` — enrich response (modify existing)

### No breaking API changes

- Existing sequential workflows continue to run identically.
- `POST /workflows/{id}/run` response shape unchanged.
- `GET /runs/{id}/trace` response unchanged (new event types appear naturally).
- `GET /agents/{id}` response unchanged.
- All existing schemas backward-compatible.

## 15. Data Model Impact

### New column

**`agent_executions.parent_execution_id`** (nullable FK → `agent_executions.id`):

```python
parent_execution_id: Mapped[Optional[int]] = mapped_column(
    ForeignKey("agent_executions.id"), nullable=True, index=True
)
```

This is the ONLY new database column needed. No new tables.

### Why no new tables

- Action decisions are ephemeral — traced as events, not persisted as entities.
- Collaboration graph is derived from trace events and execution records — no storage needed.
- Supervision loops and handoff chains are captured by existing `AgentExecution` + `AgentExecutionEvent` tables with `parent_execution_id` providing the hierarchy.
- `graph_config` JSON already supports arbitrary workflow configuration.

### Migration approach

Use the existing inline migration pattern (`_ensure_local_schema_columns` in `database.py`):
1. Check if `parent_execution_id` column exists in `agent_executions`.
2. If not, `ALTER TABLE agent_executions ADD COLUMN parent_execution_id INTEGER REFERENCES agent_executions(id)`.
3. Create index if not exists.

### Schema changes

- `WorkflowCreate`/`WorkflowUpdate` validation: add `@field_validator("graph_config")` that checks required keys per `workflow_type`.
- `AgentExecutionRead` schema: add `parent_execution_id: Optional[int]`.
- New `CollaborationGraphResponse` schema for the graph endpoint.

## 16. Testing Strategy

### Unit tests

| Test file | What it tests |
|-----------|---------------|
| `test_action_decision_parser.py` | JSON extraction, validation, repair (3 attempts), fallback for malformed output, empty output, non-JSON output, markdown fence extraction |
| `test_supervisor_runner.py` | Start/execute/fail for supervisor workflows; delegate action; finish action; unknown agent_id; max_iterations exceeded; worker not in worker_agent_ids; empty worker list; single-worker supervisor; context assembly includes accumulated outputs |
| `test_handoff_swarm_runner.py` | Start/execute/fail for handoff workflows; handoff action (allowed + denied); finish action; handoff to non-participant; max_handoffs exceeded; circular handoff prevention; payload passing; handoff_policy enforcement |
| `test_runner_factory.py` | Correct runner returned per workflow_type; invalid type raises error |

### Integration tests

| Test | What it verifies |
|------|-----------------|
| Supervisor run creates correct trace events | `supervisor_delegated`, `worker_responded`, `supervisor_decision` events present and correctly ordered |
| Handoff run creates correct trace events | `handoff_requested`, `handoff_allowed`/`handoff_denied`, `handoff_completed` events present |
| parent_execution_id hierarchy | Worker executions reference supervisor; handoff chain executions reference previous |
| Collaboration graph endpoint | Correct nodes/edges for supervisor and handoff runs |
| Sequential unchanged | All 16 existing test files pass without modification |
| Isolation holds | Supervisor cannot access worker private memory; handoff payload isolation; cross-agent context leakage prevented |
| Config snapshot captures graph_config | Supervisor/handoff config appears in run config_snapshot |
| Mock provider determinism | Supervisor and handoff runs produce deterministic output with mock provider |

### Existing test safety

- `test_workflow_runtime.py` tests must continue to pass. Sequential workflow behavior is unchanged.
- All 123 existing tests must pass before and after Phase 3 changes.
- Mock provider must produce identical output for identical sequential workflow inputs.

### Test data hygiene

- All test-created records use TEST/E2E prefixes.
- Test fixtures clean up only records they created.
- Demo seed data never modified by tests.
- No broad cleanup or admin cleanup in tests.

## 17. Risks and Trade-offs

### Risk 1: LLM action decision reliability

**Risk**: Real LLMs may not reliably produce valid JSON action decisions, especially for handoff with complex payloads.

**Mitigation**: 3-attempt JSON repair strategy (proven in review_service). Fallback: treat unparseable output as `{action: "finish", final_response: raw_text}`. In supervisor, this means the run ends; in handoff, the chain ends. Neither case is catastrophic — the run completes with whatever output the agent produced.

**Trade-off**: The fallback favors completion over correctness. A supervisor stuck in a parse loop would be worse than a supervisor that falls back to finishing.

### Risk 2: Infinite loops

**Risk**: Supervisor could delegate forever; handoff chain could circle.

**Mitigation**: `max_iterations` (default 10) and `max_handoffs` (default 20) are hard limits. When exceeded, the run is marked `failed` with a clear error message. The limits are configurable per workflow in `graph_config`.

**Trade-off**: Hard limits may cut off legitimate long chains. Users can increase limits if needed.

### Risk 3: Mock provider determinism

**Risk**: New runners may break mock determinism, cascading to learning loop and demo tests.

**Mitigation**: Keep mock provider unchanged. New runners must produce deterministic output with mock provider. Test that identical supervisor/handoff runs produce identical trace event sequences with the mock provider.

**Trade-off**: Mock provider produces the same output regardless of action decision — it won't simulate realistic delegation patterns. Realistic multi-agent behavior requires real LLM testing.

### Risk 4: Context assembler complexity

**Risk**: Adding accumulated outputs and handoff history to context assembly may bloat prompts beyond token limits.

**Mitigation**: Truncate accumulated outputs to last N characters per worker response (e.g., last 2000 chars). Show iteration markers so agents know how much history exists. Token usage tracking already monitors prompt size — excessive prompts will be visible in observatory.

**Trade-off**: Truncation may lose important context from early delegations. A more sophisticated solution (summarization) is deferred to Phase 4.

### Risk 5: Sequential regression

**Risk**: Refactoring `WorkflowRunner` into `SequentialRunner` + `BaseRunner` may introduce regressions in the most-tested code path.

**Mitigation**: Extract `BaseRunner` with minimal changes. `SequentialRunner` keeps the same method signatures and logic. All 123 existing tests must pass before any new runner code is considered complete. Run the full test suite after each refactoring step.

**Trade-off**: Some code duplication between runners is acceptable to avoid over-abstraction. Three concrete runner classes with ~100-200 lines each is better than one 1000-line runner with complex branching.

### Risk 6: Frontend complexity

**Risk**: Collaboration graph visualization may be complex to implement from scratch.

**Mitigation**: Start with a simple tree/stepper using CSS + existing shadcn/ui components. Defer advanced graph libraries (D3, Cytoscape) to Phase 4 unless the simple version proves insufficient.

**Trade-off**: Simple visualization may not show all edge details at once. Acceptable for MVP — users can click through to execution details for full information.

## 18. Open Questions

1. **Should supervisor be able to delegate to itself?** The current design assumes the supervisor is separate from workers. Self-delegation could be useful for the supervisor to do its own analysis before dispatching. Decision: allow it if supervisor is in `worker_agent_ids`; default to NOT including supervisor in workers.

2. **Should handoff agents be allowed to hand off back to a previous agent?** Could cause loops. Current design allows it but `max_handoffs` limits total steps. A `allow_circular_handoffs` flag (default false) could be added to `graph_config` if needed.

3. **Should the collaboration graph be computed from trace events or stored as a separate artifact?** Design choice: compute from trace events (no new storage). Trade-off: slower for long chains but always consistent with event log. If performance becomes an issue, cache the graph in `run.output` metadata.

4. **Should supervisor and handoff workflows support tools?** The provider interface has `tool_call()` but it's unimplemented in mock. The context assembler supports agent-tool assignments. Decision: defer tool support in multi-agent workflows to a later milestone. First prove the coordination patterns work without tools.

5. **Should we add a `workflow_run_config` override to `POST /workflows/{id}/run`?** Currently the endpoint only accepts `{task}`. For multi-agent runs, users might want to override `max_iterations` or `max_handoffs` per run. Decision: add optional `run_config` field to the request body, merged with `graph_config` defaults.

6. **Do we need to visualize agent-to-agent communication during a live run (not just after)?** Current monitor polls every 2s. For multi-agent runs, showing the emerging collaboration graph during a live run would be valuable. Decision: add collaboration snapshot to monitor response (nodes + edges discovered so far). Full implementation in M2.

7. **Should the learning loop work on supervisor delegation quality, not just agent output quality?** Product question: when a reviewer evaluates a supervisor run, should it evaluate the delegation pattern or the final output? Design position: both. The reviewer receives the full trace including delegation events, and can critique coordination quality. The system prompt for the reviewer agent determines what it focuses on.

## 19. Recommended Next Implementation Milestone

### Start with M1: Supervisor Workflow Runtime

**Why**:
1. Supervisor is the simpler multi-agent pattern — one dispatcher, N workers, clear hierarchy.
2. It validates the core Phase 3 architecture decisions (RunnerFactory, ActionDecisionParser, collaboration events, parent_execution_id) with minimal risk.
3. It provides immediate value — users can compose supervisor-directed teams of agents.
4. It unlocks the Teamwork Learning Demo (M5) which depends on supervisor functionality.
5. Handoff (M4) benefits from lessons learned in supervisor implementation.

**Estimated scope**: 2-3 sessions.

**First session deliverables**:
- `BaseRunner` extracted from `WorkflowRunner`
- `SequentialRunner` (renamed, same behavior)
- `RunnerFactory` dispatching to correct runner
- `ActionDecisionParser` with JSON repair
- `SupervisorRunner` with start/execute/fail
- Supervisor context assembly (accumulated outputs section)
- Supervisor trace events
- All 123 existing tests still pass
- 10+ new tests for supervisor runner

**Second session deliverables**:
- `parent_execution_id` column + migration
- Supervisor run via API (end-to-end with mock provider)
- Frontend: supervisor workflow config form
- Frontend: run detail showing supervisor delegation (simple tree, pre-collaboration-graph endpoint)
- 5+ integration tests

**Third session (if needed)**:
- Real LLM supervisor testing
- Edge cases: max_iterations exceeded, invalid agent_id, empty worker list
- Documentation: supervisor workflow guide

**Success criteria for M1**:
- `POST /workflows/{id}/run` works for `workflow_type: "supervisor"` with mock and real LLM.
- Supervisor delegates to workers, collects responses, and finishes.
- Trace events capture the full delegation tree.
- Sequential workflows run identically to pre-Phase-3 behavior.
- All existing tests pass.
