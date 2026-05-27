# Manual End-to-End Test Guide

## 1. Purpose

This guide verifies the core Persona Agent Lab user journey end to end from the browser and backend together. It is written for a new user opening the app for the first time.

The test creates reusable souls, creates agents, assigns souls and tools, adds context and memory, builds a sequential workflow, runs a BI dashboard discrepancy task, inspects run traces and observability pages, adds feedback, approves a proposed memory, re-runs the workflow, and checks that agent-specific memory remains isolated.

## 2. Prerequisites

Before starting, make sure:

- Docker is running.
- PostgreSQL is running through Docker Compose.
- Qdrant is running through Docker Compose if you want the full local stack available.
- The backend is running at `http://localhost:8000`.
- The frontend is running at `http://localhost:3000`.
- The recommended provider for this manual test is `mock`.
- Optional `openai_compatible` provider configuration may be used, but mock mode is safer for repeatable local testing.
- LLM API keys are stored only in backend environment files or server-side secret stores.
- No API keys are placed in `frontend/.env.local`.

## 3. Environment Setup

From the repository root, start PostgreSQL and Qdrant:

```bash
docker compose up -d postgres qdrant
```

Start the backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Check backend health:

```bash
curl http://localhost:8000/health
```

Expected result: a JSON response with status information and `llm_provider` set to `mock` for the recommended local test.

Open the app:

```text
http://localhost:3000
```

## 4. Test Scenario Overview

Scenario name:

```text
BI Dashboard Discrepancy Resolution
```

Business case:

A customer says the April revenue number in the dashboard does not match their Excel report. The agent team should investigate internal dashboard causes before asking the customer for files.

The workflow uses three agents:

- Persistent Troubleshooter
- Critical Reviewer
- Customer Response Writer

## 5. Step-by-Step Manual Test

Use a unique suffix in names, such as today's date or your initials, so your test records are easy to find later.

Example suffix:

```text
Manual 2026-05-26
```

### A. Create Souls

1. Open `http://localhost:3000`.
2. Select **Souls**.
3. Select **New soul**.
4. Create the first soul using the sample content in section 6.
5. Select **Save soul**.
6. Return to **Souls** and confirm the new soul appears in the list.
7. Repeat for the Critical Reviewer soul and Customer-Centric Consultant soul.

Expected result:

- Each saved soul appears in the Souls list.
- Opening a soul shows its editable persona fields.

### B. Create Agents

1. Select **Agents**.
2. Select **New agent**.
3. Create **E2E Persistent Troubleshooter** using the sample content in section 6.
4. In **Soul / persona**, select the Persistent Problem Solver soul you created.
5. Set **Provider** to `mock`.
6. Set **Model** to `mock-deterministic`.
7. Set **Temperature** to `0.2`.
8. Set **Max tokens** to `1024`.
9. Confirm **Agent is active** is checked.
10. Confirm the policy JSON fields use the defaults in section 6.
11. Select **Save agent**.
12. Repeat for Critical Reviewer and Customer Response Writer.

Expected result:

- Each agent opens on its detail page after saving.
- The Agent Summary shows the selected soul.
- The active status badge shows **Active**.
- The Policy Summary shows memory, context, and handoff policy JSON.

### C. Assign Souls To Agents

If you did not assign a soul during agent creation:

1. Open the agent detail page from **Agents**.
2. In the edit form, choose the correct **Soul / persona**.
3. Select **Save agent**.

Expected result:

- The Agent Summary updates to show the selected soul name.

### D. Configure Provider And Model

For each agent:

1. Open the agent detail page.
2. Set **Provider** to `mock`.
3. Set **Model** to `mock-deterministic`.
4. Set **Temperature** to `0.2`.
5. Set **Max tokens** to `1024`.
6. Select **Save agent**.

Expected result:

- The Agent Summary shows `mock:mock-deterministic`.

### E. Configure Policies

For each agent, use these policy values unless you are intentionally testing a different configuration:

Memory policy:

```json
{
  "write_mode": "manual_review",
  "retrieval_enabled": true
}
```

Context policy:

```json
{
  "include_active_context": true
}
```

Handoff policy:

```json
{
  "allow_handoff": false,
  "allowed_agent_ids": []
}
```

Expected result:

- Invalid JSON is rejected in the browser before saving.
- Valid JSON saves successfully.

### F. Add Contexts

Open each agent detail page and use **Agent Context**.

For Persistent Troubleshooter:

1. Add the BI Dashboard Discrepancy Troubleshooting Playbook from section 6.
2. Confirm **Active** is checked.
3. Select **Add context**.

For Critical Reviewer:

1. Add the Troubleshooting Plan Review Standards context.
2. Select **Add context**.

For Customer Response Writer:

1. Add the Customer Communication Style Guide context.
2. Select **Add context**.

Expected result:

- Each context appears in the agent's context list.
- Active contexts show an **Active** badge.
- Edit and Delete buttons are available.

### G. Add Memories

Open the Persistent Troubleshooter detail page and use **Agent Memory**.

1. Set **Type** to `lesson`.
2. Set **Source** to `manual_test`.
3. Set **Importance** to `95`.
4. Set **Status** to `active`.
5. Paste the memory content from section 6.
6. Select **Add memory**.

Expected result:

- The memory appears in the list.
- It shows **Active**.
- Active memory is eligible for future retrieval by this same agent.

### H. Create A Tool

1. Open **Tool Registry** from the app navigation.
2. Create a tool with the sample content in section 6.
3. Confirm **Active** is checked.
4. Select **Register tool**.

Expected result:

- The tool appears in the list.
- It shows **Active**.
- Edit and Delete buttons are available.

### I. Assign Tool To Agent

1. Open the Persistent Troubleshooter agent detail page.
2. Find **Assigned Tools**.
3. Select the tool you created from **Available tool**.
4. Select **Assign**.

Expected result:

- The tool appears in the assigned tools list for this agent.
- Other agents do not automatically receive the tool.
- Removing a tool-assignment relationship is labeled **Unassign**. It removes only the assignment and does not delete the agent or tool.

### J. Create Workflow Using Agent Picker

1. Open **Workflows**.
2. Select **New workflow**.
3. Enter the workflow name from section 6.
4. Set **Workflow type** to `sequential`.
5. In **Available agent**, select Persistent Troubleshooter and select **Add**.
6. Select Critical Reviewer and select **Add**.
7. Select Customer Response Writer and select **Add**.
8. Confirm the **Agent sequence** displays the three agent names in that order.
9. Select **Save workflow**.

Expected result:

- The workflow saves successfully.
- The workflow edit page opens.
- The workflow sequence is selected by agent name, not by typing backend IDs.

### K. Run Workflow

1. Open **Workflows**.
2. Find your workflow.
3. Select **Run**.
4. Paste the workflow task input from section 6.
5. Select **Run workflow**.

Expected result:

- A run is created.
- The app immediately opens the run monitor page.
- The monitor shows workflow status, active agent, queued/running/completed agent cards, event timeline, latest output, and token usage.
- Event payloads are collapsed by default. Select **Expand** on an event row to inspect formatted JSON, or use **Expand all** and **Collapse all**.

### L. Inspect Run Detail And Trace

1. From the monitor page, select **Trace**.
2. Confirm the run status is `completed`.
3. Confirm **Run Input** contains the BI dashboard discrepancy task.
4. Confirm **Run Output** contains a mock response with dashboard and Excel terms.
5. Confirm **Trace Events** contains:
   - `run_started`
   - `workflow_loaded`
   - `agent_selected`
   - `context_assembled`
   - `memory_retrieved`
   - `llm_request_started`
   - `llm_response_received`
   - `agent_completed`
   - `run_completed`

Expected result:

- Trace events are visible and ordered.
- Context and memory events appear per participating agent.

### M. Inspect Monitor, Executions, And Token Usage

From the monitor page:

1. Confirm status eventually becomes `completed`.
2. Confirm each workflow agent appears as an agent status card.
3. Confirm token usage is shown.
4. Use the event filters to show only memory events, then return to **All events**.
5. Select **Expand** on one event and confirm the JSON payload appears.
6. Select **Collapse** and confirm the JSON payload is hidden again.
7. Select **Executions**.
8. Open an execution detail.
9. Confirm **Assembled Context**, **Retrieved Memories**, **Output Payload**, and **Token Usage** sections are visible.
10. Return to the monitor and select **Token Usage**.

Expected result:

- Monitor and execution pages are available.
- Execution detail shows only the context and memory injected into that specific agent execution.
- Long JSON payloads stay inside scrollable code blocks and do not stretch the page horizontally.

### N. Add Feedback

1. Return to the run trace page.
2. In **Learning Feedback**, choose Persistent Troubleshooter.
3. Set **Feedback type** to `improvement`.
4. Set **Rating** to `3`.
5. Paste the feedback text from section 6.
6. Select **Save feedback**.

Expected result:

- The page confirms feedback was saved for the selected run and agent.

### O. Generate Proposed Memory

1. Select **Generate proposed memory**.
2. Confirm a proposed memory appears.
3. Confirm its status is `pending`.
4. Confirm the content mentions dashboard filters, date range, metric definition, refresh timestamp, and ETL logic.

Expected result:

- Proposed memory starts as pending.
- The proposed memory does not affect future runs until approved.
- The sidebar **Agents** item shows a red pending feedback memory approval badge.
- The Agents list shows the same red badge only on the agent that owns the feedback-derived pending proposed memory.
- Manually added pending memories do not show this badge.

### P. Approve Proposed Memory

1. Select **Review on agent page**.
2. Find **Proposed Memories**.
3. Confirm the **Proposed Memories** section shows a red pending feedback memory approval badge.
4. In the Pending group, select **Approve**.

Expected result:

- The proposed memory moves to approved.
- The app says it was written as active agent memory.
- The approved memory appears as active memory for the same agent.
- The red approval badge disappears after all feedback-derived pending proposed memories for that agent are approved or rejected.

### Q. Re-Run Workflow

1. Open **Workflows**.
2. Run the same workflow again with the same BI discrepancy task.
3. Open the new run trace.
4. Open **Executions** and inspect the Persistent Troubleshooter execution.

Expected result:

- The Persistent Troubleshooter execution includes the approved memory in its assembled context.
- Critical Reviewer and Customer Response Writer do not show that feedback-derived memory as their own retrieved memory.
- Any cross-agent information they receive should come only through explicit sequential workflow output.

### R. Check Agent Evolution Page

1. Open the Persistent Troubleshooter agent detail page.
2. Select **View evolution**.

Expected result:

- The page shows the agent's memories, feedback, proposed memories, learning events, executions, and token usage.
- It does not show private learning data from other agents.

### S. Manage And Clean Up Runs

1. Open **Runs** from the sidebar.
2. Confirm the page lists the runs you created.
3. Use the status filter to show `completed` runs.
4. Use the workflow filter to show only the BI Dashboard Discrepancy workflow.
5. Open a run with **Monitor**, **Trace**, **Executions**, and **Token Usage**.
6. Return to **Runs**.
7. Select one old test run with its checkbox.
8. Select **Archive Selected**.
9. Confirm the in-app dialog.
10. Switch the archive filter to **Archived runs**.
11. Confirm archived rows show **Activate**.
12. Select one archived run and choose **Activate Selected**.
13. Confirm the in-app dialog.
14. Switch back to **Active runs**.

Expected result:

- The selected run disappears from the default Active runs list.
- Switching the archive filter to **Archived runs** shows the archived run with an Archived badge.
- Activating the run removes it from the Archived runs view and restores it to Active runs.
- Trace, feedback, proposed memories, learning events, agents, workflows, souls, tools, contexts, and active approved memories remain available.
- If archiving fails, the page shows the backend error message.
- If permanent delete is blocked by backend safety checks, the page opens a warning dialog and keeps the run archived.

### T. Manually Check Destructive Actions

Use unique test-only records for these checks.

1. Open **Souls** and create a disposable soul.
2. Return to **Souls**, select **Delete**, and confirm the in-app dialog appears.
3. Select **Cancel** and confirm the soul remains visible.
4. Select **Delete** again, confirm deletion, and verify the success message appears and the soul disappears.
5. Create another soul, assign it to a test agent, then try deleting the soul from **Souls**.
6. Confirm the delete is blocked with a readable error telling you to reassign or delete agents first.
7. Open an agent detail page and add a context entry. Edit it, then delete it through the confirmation dialog.
8. Add a memory entry. Edit it, then delete it through the confirmation dialog.
9. Open **Tools**, create a disposable tool, delete it, and verify the tool disappears from the list.
10. Open **Workflows**, create a disposable workflow without runs, delete it, and verify the workflow disappears.
11. Try deleting a workflow that has run history. The app should show a readable error until the related runs are deleted.
	12. Open **Experiments**, create a disposable experiment without running it, delete it from the list, and verify the confirmation dialog appears and the experiment disappears after confirming.
	13. Create another experiment, run it, then try deleting it from both the list and the detail page. Confirm the delete is blocked with a readable error explaining that experiment runs must be deleted first.

Expected result:

- Every destructive action has a visible confirmation dialog.
- Cancel keeps the record.
- Confirm shows loading state and then a success message or readable error.
- Lists refresh after successful delete or removal.
- Relationship removal uses **Unassign** or **Remove**, not **Delete**.

## 6. Exact Sample Content

Use a unique suffix at the end of each name.

### Souls

Persistent Problem Solver name:

```text
E2E Persistent Problem Solver Manual 2026-05-26
```

Description:

```text
Persistent troubleshooting persona for business analytics investigations.
```

Principles:

```text
Start with available evidence. Prefer internal checks before requesting customer files.
```

Decision style:

```text
Systematic, evidence-first, and concise.
```

Collaboration style:

```text
Keeps reviewers and customer-facing writers informed.
```

Failure handling style:

```text
Names uncertainty and asks for the minimum missing information.
```

Escalation style:

```text
Escalate only after dashboard configuration, metric definitions, refresh timestamps, and ETL logic are checked.
```

Critical Reviewer name:

```text
E2E Critical Reviewer Manual 2026-05-26
```

Customer-Centric Consultant name:

```text
E2E Customer-Centric Consultant Manual 2026-05-26
```

Use similar persona text focused on review quality and customer-ready communication.

### Agent Prompts

Persistent Troubleshooter system prompt:

```text
Create practical troubleshooting plans for BI dashboard discrepancies. Check internal evidence before asking for customer files.
```

Critical Reviewer system prompt:

```text
Review the prior troubleshooting plan for missing evidence, weak assumptions, and customer readiness.
```

Customer Response Writer system prompt:

```text
Write short, customer-facing responses that are clear, calm, and specific about next steps.
```

### Context Entries

Persistent Troubleshooter context title:

```text
BI Dashboard Discrepancy Troubleshooting Playbook
```

Persistent Troubleshooter context content:

```text
For BI dashboard discrepancy work, check date range mismatch, metric definition mismatch, dashboard filters, refresh timestamp, and ETL logic before requesting customer files.
```

Critical Reviewer context title:

```text
Troubleshooting Plan Review Standards
```

Critical Reviewer context content:

```text
Check whether the plan covers internal dashboard filters, metric definitions, refresh timestamps, ETL logic, and minimum customer asks.
```

Customer Response Writer context title:

```text
Customer Communication Style Guide
```

Customer Response Writer context content:

```text
Use plain English. Acknowledge the discrepancy. Explain internal checks first, then ask only for minimum missing information.
```

### Memory Entry

Persistent Troubleshooter memory:

```text
For BI discrepancy investigations, first check filters, date range, metric definition, refresh timestamp, and ETL logic before asking for customer files.
```

### Tool

Tool name:

```text
manual_dashboard_lookup
```

Tool type:

```text
internal_reference
```

Tool config JSON:

```json
{
  "mode": "mock",
  "purpose": "manual_e2e"
}
```

### Workflow Task Input

```text
A customer says the April revenue number in the dashboard does not match their Excel report.

Dashboard revenue: $1.28M.
Excel revenue: $1.34M.

The customer has not provided the Excel file or raw source data yet.

Please produce:
1. A practical troubleshooting plan.
2. Likely causes.
3. Internal checks first.
4. Minimum information needed from the customer.
5. A short customer-facing response.
```

### Feedback Text

```text
This agent should first check dashboard filters, date range, metric definition, refresh timestamp, and ETL logic internally before asking the customer for files.
```

## 7. Expected Results

- After creating a soul, it appears in the Souls list.
- After creating an agent, the agent detail page shows the selected soul.
- Agent provider/model shows `mock:mock-deterministic`.
- Policy JSON saves when valid and shows in Policy Summary.
- Context entries appear under the same agent only.
- Active memory appears under the same agent only.
- Tools can be created and assigned to one agent.
- Workflow sequence displays selected agents by name and in order.
- Running the workflow creates a completed run.
- Run detail shows status, input, output, config snapshot, and trace events.
- Trace shows context assembly, memory retrieval, LLM request/response, agent completion, and run completion.
- Monitor and execution pages show token usage and execution detail.
- Monitor event payloads are collapsed by default and expandable on demand.
- Proposed memory starts as pending.
- Approved proposed memory becomes active memory.
- Re-running the workflow includes approved memory for the same agent only.
- Runs page lists run history and links to monitor, trace, executions, and token usage.
- Deleting an old run removes the run result but keeps agent and workflow configuration. Approved memories and their approved proposed-memory records are preserved.

## 8. Troubleshooting

Backend not running:

- Symptom: frontend pages show backend unavailable or E2E tests fail health checks.
- Fix: start the backend with `uvicorn app.main:app --reload`.

Frontend cannot reach backend:

- Symptom: lists do not load or save actions fail.
- Fix: confirm `VITE_API_BASE_URL` is unset or set to `http://localhost:8000`.

CORS error:

- Symptom: browser console shows CORS blocked requests.
- Fix: confirm backend `CORS_ORIGINS` includes `http://localhost:3000`.

Database not running:

- Symptom: backend startup or API requests fail with database connection errors.
- Fix: run `docker compose up -d postgres`.

Workflow run button does nothing:

- Symptom: no run appears after selecting **Run workflow**.
- Fix: check the browser page for an error message and confirm the backend is running.

Invalid workflow configuration:

- Symptom: workflow save or run fails.
- Fix: make sure at least one active agent appears in the Agent sequence.

No monitor opens after running:

- Symptom: the app stays on the workflow run page after selecting **Run workflow**.
- Fix: inspect the backend terminal logs and confirm the workflow has active agents.

Run archive fails:

- Symptom: the Runs page shows an error after selecting **Archive**, **Archive Selected**, **Activate**, or **Activate Selected**.
- Fix: refresh the Runs page and check backend logs. Confirm the backend is running and the run still exists.

Permanent run delete is blocked:

- Symptom: the Runs page opens a warning dialog after selecting **Delete permanently**.
- Fix: keep the run archived. Runs with feedback, evaluations, learning events, or experiment result references are protected so learning history is not broken.

Configuration delete is blocked:

- Symptom: a delete confirmation closes and the page shows a warning such as "Deactivate this soul", "Unassign or deactivate this tool", or "Deactivate this workflow".
- Fix: this is expected safety behavior. Use **Deactivate** for referenced reusable configuration, or use **Unassign** for relationship rows such as agent-tool assignments.

Provider configuration error:

- Symptom: run fails during model generation.
- Fix: use `LLM_PROVIDER=mock` for this test, or verify backend-only provider keys for `openai_compatible`.

Tavily API key missing:

- Symptom: a Tavily tool call fails.
- Fix: this manual test does not require Tavily. For Tavily-specific tests, set `TAVILY_API_KEY` in backend env only.

Qdrant unavailable:

- Symptom: vector search is disabled or unavailable.
- Fix: run `docker compose up -d qdrant`. The current memory flow can still use relational active memory.

Memory does not appear in a run:

- Symptom: execution context shows no memory.
- Fix: confirm the memory status is `active`, the memory belongs to the same agent, and the agent's memory policy has retrieval enabled.

Agent sequence empty:

- Symptom: workflow cannot save or run.
- Fix: use the Available agent picker and select **Add** for each agent.

Inactive agent selected:

- Symptom: workflow run fails because an agent is missing or inactive.
- Fix: open the agent detail page, check **Agent is active**, and save.

## 9. Pass/Fail Checklist

- [ ] Backend health check succeeds.
- [ ] Frontend dashboard opens.
- [ ] Three souls are created and visible.
- [ ] Three agents are created and active.
- [ ] Each agent has the correct soul selected.
- [ ] Provider/model settings are saved.
- [ ] Policy JSON is valid and saved.
- [ ] Agent contexts are created and active.
- [ ] Persistent Troubleshooter active memory is created.
- [ ] Tool is created and assigned only to Persistent Troubleshooter.
- [ ] Sequential workflow is created with agent picker.
- [ ] Workflow run completes.
- [ ] Run detail shows input and output.
- [ ] Trace events are visible.
- [ ] Monitor and execution pages are visible.
- [ ] Monitor events are collapsed by default.
- [ ] Expand and Collapse reveal and hide event JSON payloads.
- [ ] Token usage page opens from the monitor or Runs page.
- [ ] Feedback is saved for Persistent Troubleshooter.
- [ ] Proposed memory is generated with pending status.
- [ ] Sidebar and agent pages show pending feedback memory approval badges for feedback-derived pending proposed memories only.
- [ ] Proposed memory is approved.
- [ ] Pending feedback memory approval badges disappear after approval or rejection.
- [ ] Approved memory appears as active memory.
- [ ] Re-run includes approved memory for Persistent Troubleshooter.
- [ ] Re-run does not retrieve that memory for other agents.
- [ ] Agent evolution page shows the agent-specific timeline.
- [ ] Runs page lists active run history by default.
- [ ] Archiving a test run hides it from Active runs and shows it under Archived runs.
- [ ] Archived runs show **Activate**.
- [ ] **Activate Selected** restores selected archived runs to Active runs.
- [ ] Permanent delete safety failures open a warning dialog.
- [ ] Archiving a test run does not delete trace, feedback, proposed memories, learning events, agents, workflows, tools, souls, contexts, or active memories.
	- [ ] Experiment deletion shows confirmation dialog; cancel keeps the experiment.
	- [ ] Experiment without runs is deleted successfully after confirmation.
	- [ ] Experiment with runs is blocked from deletion with a readable error.

## 10. CRUD Cleanup Policy

Use these meanings consistently when manually testing either frontend:

- **Delete** permanently removes an unused record. If backend safety checks reject the delete, the UI should show the backend warning instead of failing silently.
- **Archive** hides runtime or historical records from default lists while preserving evidence and learning history.
- **Deactivate** keeps reusable configuration records such as agents, souls, tools, and workflows, but prevents treating them as active configuration.
- **Unassign** removes a relationship such as an agent-tool assignment. It does not delete either side of the relationship.

Experiments and runs should not create circular cleanup instructions. Archive experiments with related runs; archive runs with learning records. Related traces, feedback, proposed memories, approved memories, learning events, agents, workflows, souls, tools, and contexts should remain inspectable.

## 11. Current Limitations

- Sequential workflow is the primary supported runtime. Supervisor and handoff swarm workflow types are placeholders.
- Mock provider output is deterministic and simplified; it proves wiring and context injection rather than production-quality reasoning.
- Qdrant vector search is an adapter-level capability and semantic embedding retrieval may not be configured locally.
- Learning updates agent memory only. Soul/persona rewriting is not automatic.
- The before/after comparison flow is manual through run traces, execution details, and repeated workflow runs.
- Runtime monitoring uses polling rather than WebSockets.
- Run cleanup uses archive by default. Archived runs are hidden from the default Runs list, can be viewed with the Archived runs filter, and can be activated back into Active runs. Permanent delete is limited to archived runs that pass backend safety checks.
- Authentication and multi-user authorization are not implemented in the MVP.
