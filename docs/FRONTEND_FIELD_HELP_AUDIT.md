# Frontend Field-Level Help Audit

> Contextual tooltip audit for configuration forms across Agent Swarm Lab.
> Excludes: onboarding tours, product walkthroughs, tutorial overlays, beginner guidance.

---

## Summary

| Page/Form | Total Fields | Needs Help | Optional | No Help |
|-----------|-------------|------------|----------|---------|
| Agent Configuration | 13 | 6 | 2 | 5 |
| Soul Form | 8 | 5 | 0 | 3 |
| Tool Form | 5 | 1 | 1 | 3 |
| Agent Context | 5 | 2 | 0 | 3 |
| Agent Memory | 5 | 2 | 1 | 2 |
| Workflow Form | 7 | 2 | 1 | 4 |
| Experiment Form | 5 | 1 | 0 | 4 |
| Feedback Form | 4 | 0 | 0 | 4 |
| **Total** | **52** | **19** | **5** | **28** |

---

## 1. Agent Configuration

File: [AgentsPage.tsx](../frontend/src/pages/AgentsPage.tsx#L314-L367) — `AgentEditor`

| Field | Decision | Reason | Proposed Help Text | UI Pattern | Priority |
|-------|----------|--------|--------------------|------------|----------|
| Name | No help | Self-explanatory | — | — | — |
| Role | No help | Self-explanatory; label + input suffice | — | — | — |
| Description | No help | Self-explanatory | — | — | — |
| Soul | Optional | Non-obvious: soul vs system prompt separation is a core architectural concept users may not know | "Persona identity applied to this agent. Souls define behavioral style and principles independently from the system prompt. Leave empty for no persona." | Tooltip icon | Low |
| Provider | No help | Enum dropdown; provider names are self-documenting | — | — | — |
| Model | **Help** | Model identifier format varies by provider (e.g. `gpt-4o`, `claude-sonnet-4-6`, `mock-deterministic`). Users may not know valid values. | "Model identifier for the selected provider. For mock: use `mock-deterministic`. For Ollama: use the model tag (e.g. `llama3:8b`). For OpenAI-compatible: use the API model name." | Tooltip icon | High |
| Temperature | **Help** | Affects agent output randomness and creativity. Non-obvious range semantics (0–2). | "Controls output randomness. 0 = deterministic, predictable responses. 1 = balanced creativity. 2 = maximum variability. Lower values are safer for task-execution agents." | Tooltip icon | High |
| Max tokens | **Help** | Affects cost, output length, and truncation risk. Users may not know practical values. | "Maximum tokens the agent can generate in a single response. Higher values allow longer outputs but increase cost and latency. 1024–4096 is typical for task agents." | Tooltip icon | Medium |
| System prompt | Optional | Knowledgable users understand this; less experienced may benefit from distinguishing it from soul | "Operational instructions for the agent. Unlike the soul (which defines personality), the system prompt defines tasks, constraints, and output format." | Tooltip icon | Low |
| Active | No help | Self-explanatory checkbox | — | — | — |
| Memory policy JSON | **Help** | JSON with non-obvious schema; controls memory writeback mode and retrieval behavior — directly affects learning loop | "Controls how the agent manages memory. `write_mode`: `manual_review` (proposed memories need approval), `auto_commit` (auto-save), `disabled`. `retrieval_enabled`: whether the agent can recall past memories at runtime." | Popover with schema preview | High |
| Context policy JSON | **Help** | JSON with non-obvious schema; controls context assembly at runtime | "Controls which context entries are assembled at runtime. `include_active_context`: include all active context entries. Future: filter by type, priority threshold, etc." | Popover with schema preview | High |
| Handoff policy JSON | **Help** | JSON with non-obvious schema; controls agent-to-agent handoff permissions — security boundary | "Controls whether and how this agent can hand off to other agents. `allow_handoff`: enable/disable. `allowed_agent_ids`: list of agent IDs this agent may transfer to. An empty list with `allow_handoff: false` means no handoffs." | Popover with schema preview | High |

---

## 2. Soul Form

File: [SoulsPage.tsx](../frontend/src/pages/SoulsPage.tsx#L238-L276) — `SoulFormPage`

| Field | Decision | Reason | Proposed Help Text | UI Pattern | Priority |
|-------|----------|--------|--------------------|------------|----------|
| Name | No help | Self-explanatory | — | — | — |
| Description | No help | Self-explanatory | — | — | — |
| Principles | **Help** | Abstract concept; users won't know how this differs from description or how it affects agent behavior | "Core behavioral rules the agent should follow. Examples: 'Always cite sources', 'Prefer conciseness', 'Ask clarifying questions before acting'. These are injected as persona guidance, not system-level constraints." | Tooltip icon | High |
| Decision style | **Help** | Abstract concept; no obvious format or convention | "How the agent approaches decisions. Examples: 'Weigh pros and cons explicitly', 'Default to the simplest option', 'Request human input when confidence is below 70%'. Affects tone of reasoning, not tool access." | Tooltip icon | Medium |
| Collaboration style | **Help** | Abstract concept; no obvious format or convention | "How the agent interacts with other agents during handoffs or multi-agent workflows. Examples: 'Provide full context on handoff', 'Summarize only key findings', 'Escalate when blocked for more than 2 attempts'." | Tooltip icon | Medium |
| Failure handling style | **Help** | Abstract concept; no obvious format or convention | "How the agent responds to errors or blocked tasks. Examples: 'Retry up to 3 times with different approaches', 'Log failure and escalate immediately', 'Attempt fallback tool before giving up'." | Tooltip icon | Medium |
| Escalation style | **Help** | Abstract concept; no obvious format or convention | "When and how the agent escalates to a human or supervisor agent. Examples: 'Escalate when user safety is at risk', 'Escalate after 2 consecutive tool failures', 'Never escalate — handle all errors internally'." | Tooltip icon | Medium |
| Active | No help | Self-explanatory | — | — | — |

---

## 3. Tool Form

File: [ToolsPage.tsx](../frontend/src/pages/ToolsPage.tsx#L240-L267) — `ToolFormPage`

| Field | Decision | Reason | Proposed Help Text | UI Pattern | Priority |
|-------|----------|--------|--------------------|------------|----------|
| Name | No help | Self-explanatory | — | — | — |
| Description | No help | Self-explanatory | — | — | — |
| Tool type | Optional | Free-text; users may not know valid types. But the field is simple and validation will catch errors. | "Identifier for the tool category. Examples: `custom`, `web_search`, `code_execution`, `api_call`. The backend may validate this against registered tool types." | Tooltip icon | Low |
| Config JSON | **Help** | JSON schema varies dramatically by tool type. Users need to know what keys are valid. | "Tool-specific configuration. Structure depends on the tool type. For custom tools: any JSON object. For web_search: may include `base_url`, `api_key_ref`, `max_results`. Never put secrets directly in this field." | Popover with schema preview | High |
| Active | No help | Self-explanatory | — | — | — |

---

## 4. Agent Context

File: [AgentsPage.tsx](../frontend/src/pages/AgentsPage.tsx#L456-L462) — `ContextManager`

| Field | Decision | Reason | Proposed Help Text | UI Pattern | Priority |
|-------|----------|--------|--------------------|------------|----------|
| Title | No help | Self-explanatory | — | — | — |
| Type | **Help** | Free-text field; users need to know valid values and their meaning | "Context category. Common types: `note` (general information), `procedure` (step-by-step instructions), `policy` (rules or constraints), `reference` (external documentation). Used for filtering during context assembly." | Tooltip icon | Medium |
| Priority | **Help** | Number has non-obvious semantics (higher = more important? or lower = higher priority?) | "Retrieval priority. Higher values = more important. When context space is limited, lower-priority entries may be omitted. Typical range: 1 (lowest) to 100 (highest). Default: 100." | Tooltip icon | Medium |
| Content | No help | Self-explanatory | — | — | — |
| Active | No help | Self-explanatory | — | — | — |

---

## 5. Agent Memory

File: [AgentsPage.tsx](../frontend/src/pages/AgentsPage.tsx#L574-L580) — `MemoryManager`

| Field | Decision | Reason | Proposed Help Text | UI Pattern | Priority |
|-------|----------|--------|--------------------|------------|----------|
| Type | **Help** | Free-text field; users need to know conventional values | "Memory category. Common types: `lesson` (learned from feedback), `fact` (observed information), `preference` (user or agent preference), `procedure` (how to accomplish something). Affects retrieval filtering." | Tooltip icon | Medium |
| Source | Optional | Free-text; background info. Users may not know its significance. | "Origin of this memory. Examples: `frontend` (manually entered), `feedback` (derived from user feedback), `evaluation` (derived from agent evaluation). Used for traceability." | Tooltip icon | Low |
| Importance | **Help** | Same as context priority — non-obvious semantics | "Retrieval importance. 0 = least important (rarely recalled). 100 = most important (always recalled when relevant). Affects ranking in memory retrieval. Default: 50." | Tooltip icon | Medium |
| Status | No help | Dropdown with 4 self-explanatory options | — | — | — |
| Content | No help | Self-explanatory | — | — | — |

---

## 6. Proposed Memories

Page section in [AgentsPage.tsx](../frontend/src/pages/AgentsPage.tsx#L727-L798) — `ProposedMemoryManager`

Read-only display. No configurable fields. **No help needed.**

---

## 7. Workflow Form

File: [WorkflowsPage.tsx](../frontend/src/pages/WorkflowsPage.tsx#L267-L296) — `WorkflowFormPage`

| Field | Decision | Reason | Proposed Help Text | UI Pattern | Priority |
|-------|----------|--------|--------------------|------------|----------|
| Name | No help | Self-explanatory | — | — | — |
| Workflow type | **Help** | Three options with different execution semantics — non-obvious | "Execution strategy. `sequential`: agents run one after another in order. `supervisor`: a supervisor agent delegates to worker agents. `handoff_swarm`: agents hand off to each other dynamically based on handoff policy." | Tooltip icon | High |
| Description | No help | Self-explanatory | — | — | — |
| Active | No help | Self-explanatory | — | — | — |
| Agent sequence | Optional | Checkbox ordering may not be obvious — order is selection order, not alphabetical | "Check agents in execution order. The first checked agent runs first, the second runs next, etc. Uncheck and re-check to change order." | Tooltip icon | Low |
| Graph config JSON | **Help** | Raw JSON that drives execution; users may edit it directly | "Raw graph configuration sent to the workflow engine. The agent picker above is a convenience — the JSON is the source of truth. Edit directly for advanced configurations not supported by the picker." | Popover with schema preview | High |
| Run task | No help | Placeholder text already explains it | — | — | — |

---

## 8. Experiment Form

File: [ExperimentsPage.tsx](../frontend/src/pages/ExperimentsPage.tsx#L299-L326) — `ExperimentFormPage`

| Field | Decision | Reason | Proposed Help Text | UI Pattern | Priority |
|-------|----------|--------|--------------------|------------|----------|
| Name | No help | Self-explanatory | — | — | — |
| Description | No help | Self-explanatory | — | — | — |
| Agents | No help | Checkbox picker is self-explanatory | — | — | — |
| Task prompt | No help | Self-explanatory | — | — | — |
| Evaluation config JSON | **Help** | Controls evaluation rubric; users need to know the valid score dimensions | "Evaluation rubric configuration. Required score dimensions: task_completion, persistence, collaboration, evidence_discipline, tool_usage_quality, handoff_quality, customer_readiness, safety, clarity. Each scored 1–5. Additional keys may be added for custom evaluators." | Popover with schema preview | High |

---

## 9. Feedback Form

File: [RunsPage.tsx](../frontend/src/pages/RunsPage.tsx#L275-L471) — `LearningFeedbackSection`

All fields are self-explanatory: agent selection chips, feedback type dropdown, star rating, feedback textarea with placeholder. **No help needed.**

---

## 10. Monitor Page

File: [RunsPage.tsx](../frontend/src/pages/RunsPage.tsx#L485-L673) — `RunMonitorPage`

Display-only dashboard. No configurable fields. **No help needed.**

---

## Fields Explicitly Excluded from Help

These fields were considered and rejected per the audit criteria:

| Field | Reason for Exclusion |
|-------|---------------------|
| All **Name** fields | Universally self-explanatory |
| All **Description** fields | Universally self-explanatory |
| **Role** (agent) | Self-explanatory single-line text |
| **Title** (context) | Self-explanatory |
| **Content** (context, memory) | Obvious textareas |
| **System prompt** (agent) | Well-known concept; existing label suffices |
| **Provider** (agent) | Dropdown enum is self-documenting |
| **Active / Is Active** checkboxes | Universally understood |
| **Status** dropdowns | Self-explanatory enum options |
| **Rating** (feedback) | Visual star buttons are self-documenting |
| **Feedback type** (feedback) | Dropdown labels are self-explanatory |
| **Agent selection** (workflow, experiment, feedback) | Checkbox/button patterns are self-explanatory |
| **Task prompt** (experiment) | Label + context make it obvious |
| **Run task** (workflow) | Placeholder explains it |

---

## Reusable Component Recommendation

Create a single `FieldHelp` component with two variants:

```tsx
// Tooltip variant — small ? icon that shows text on hover
<FieldHelp pattern="tooltip" content="Short help text." />

// Popover variant — small ? icon that shows richer content on click
<FieldHelp pattern="popover" title="Field name" content="Longer help text." />

// Usage inside FormField:
<FormField label="Temperature" help={<FieldHelp pattern="tooltip" content="Controls randomness..." />}>
  <Input ... />
</FormField>
```

To support this, extend `FormField` to accept an optional `help` prop rendered adjacent to the label.

### Visual Style Recommendation

- **Icon**: `CircleHelp` (lucide-react), 14px, `text-muted-foreground`, hover → `text-amber-400`
- **Tooltip**: Radix UI Tooltip or CSS-only `:hover` popover, max-width 280px, dark background, 0.85 opacity
- **Popover**: Radix UI Popover or shadcn/ui HoverCard, max-width 360px, structured content with monospace font for JSON keys
- **Placement**: Always to the right of the label text, vertically centered
- **Do NOT use**: title attribute (browser-native tooltips) — they are unstyled, inaccessible, and have no hover delay control

---

## Implementation Plan

### Phase 1 — Foundation (low risk, enables all other work)
1. Create `FieldHelp` component with tooltip + popover variants
2. Extend `FormField` to accept optional `help` prop
3. Add `CircleHelp` icon to lucide-react imports

### Phase 2 — High-priority fields (most user impact)
1. Agent: Memory policy JSON, Context policy JSON, Handoff policy JSON (popover)
2. Agent: Temperature, Model (tooltip)
3. Workflow: Workflow type (tooltip)
4. Experiment: Evaluation config JSON (popover)
5. Soul: Principles (tooltip)

### Phase 3 — Medium-priority fields
1. Agent: Max tokens (tooltip)
2. Soul: Decision style, Collaboration style, Failure handling style, Escalation style (tooltip)
3. Tool: Config JSON (popover)
4. Agent Context: Type, Priority (tooltip)
5. Agent Memory: Type, Importance (tooltip)
6. Workflow: Graph config JSON (popover)

### Phase 4 — Low-priority / optional
1. Agent: Soul, System prompt (tooltip)
2. Tool: Tool type (tooltip)
3. Agent Memory: Source (tooltip)
4. Workflow: Agent sequence (tooltip)

### Verification
1. `npm run lint` — 0 warnings
2. `npx tsc --noEmit` — clean
3. `npm run build` — successful
4. Visual check: each help icon renders and the popover/tooltip content is readable
5. E2E: verify help icons appear on each targeted form page
