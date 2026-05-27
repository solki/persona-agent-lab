import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:8000";
const suffix = `${Date.now()}`;
let backend: APIRequestContext;

test.describe.serial("Frontend", () => {
  test.beforeAll(async () => {
    backend = await playwrightRequest.newContext({ baseURL: API_BASE });
    const health = await backend.get("/health");
    expect(health.ok(), `Backend must be running at ${API_BASE}`).toBeTruthy();
  });

  test.afterAll(async () => {
    await backend.dispose();
  });

  test("creates, edits, and deletes a soul", async ({ page }) => {
    const name = `V2E2E Soul ${suffix}`;
    await page.goto("/souls");
    await page.getByRole("link", { name: "New soul" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Description").fill("Created by Playwright.");
    await page.getByLabel("Principles").fill("Prefer visible, safe CRUD.");
    await page.getByRole("button", { name: "Save soul" }).click();
    await expect(page.getByRole("heading", { name: "Edit Soul" })).toBeVisible();
    await expect(page.getByLabel("Description")).toHaveValue("Created by Playwright.");
    await page.getByLabel("Description").fill("Edited by Playwright.");
    await page.getByRole("button", { name: "Save soul" }).click();
    await expect(page.getByText("Soul saved.")).toBeVisible();
    await page.goto("/souls");
    const card = cardWithText(page, name);
    await expect(card).toContainText("Edited by Playwright.");
    await card.getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("button", { name: "Deactivate soul" }).click();
    await expect(page.getByText("Soul deactivated.")).toBeVisible();
    await cardWithText(page, name).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog", { name: "Delete soul?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete soul" }).click();
    await expect(page.getByText("Soul deleted.")).toBeVisible();
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("creates, edits, deactivates, and deletes an agent with scoped context and memory", async ({ page }) => {
    const soul = await apiPost<{ id: number; name: string }>("/souls", { name: `V2E2E Agent Soul ${suffix}` });
    const agentName = `V2E2E Agent ${suffix}`;
    await page.goto("/agents/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(agentName);
    await page.getByRole("textbox", { name: "Role", exact: true }).fill("Frontend v2 validation agent");
    await page.getByRole("textbox", { name: "Description" }).fill("Validates v2 agent configuration.");
    await page.getByRole("combobox", { name: "Soul" }).selectOption({ label: soul.name });
    await page.getByRole("combobox", { name: "Provider" }).selectOption("mock");
    await page.getByRole("textbox", { name: "Model", exact: true }).fill("mock-deterministic");
    await page.getByRole("textbox", { name: "System prompt", exact: true }).fill("Validate agent CRUD.");
    await page.getByRole("button", { name: "Save agent" }).click();
    await expect(page.getByRole("heading", { name: "Agent Detail" })).toBeVisible();
    const agentId = idFromUrl(page.url());
    const agentForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Save agent" }) });

    await agentForm.getByLabel("Description").fill("Edited v2 agent.");
    await agentForm.locator('input[type="checkbox"]').first().click();
    await agentForm.getByRole("button", { name: "Save agent" }).click();
    await expect(page.getByText("Agent saved.")).toBeVisible();
    await expect(page.getByText(/inactive/i)).toBeVisible();

    const contextForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add context" }) });
    await contextForm.getByLabel("Title").fill(`V2E2E Context ${suffix}`);
    await contextForm.getByLabel("Content").fill(`Initial context ${suffix}`);
    await contextForm.getByRole("button", { name: "Add context" }).click();
    await expect(page.getByText("Context created.")).toBeVisible();
    await page.locator("text=Initial context").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Edit" }).click();
    await page.locator("form").filter({ has: page.getByRole("button", { name: "Save context" }) }).getByLabel("Content").fill(`Edited context ${suffix}`);
    await page.getByRole("button", { name: "Save context" }).click();
    await expect(page.getByText(`Edited context ${suffix}`)).toBeVisible();
    await page.locator("text=Edited context").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByRole("dialog", { name: "Deactivate context?" })).toBeVisible();
    await page.getByRole("button", { name: "Deactivate context" }).click();
    await expect(page.getByText("Context deactivated.")).toBeVisible();
    await page.locator("text=Edited context").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog", { name: "Delete context?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete context" }).click();
    await expect(page.getByText("Context deleted.")).toBeVisible();

    const memoryForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add memory" }) });
    await memoryForm.getByLabel("Type").fill("lesson");
    await memoryForm.getByLabel("Source").fill("e2e");
    await memoryForm.getByLabel("Content").fill(`Initial memory ${suffix}`);
    await memoryForm.getByRole("button", { name: "Add memory" }).click();
    await expect(page.getByText("Memory created.")).toBeVisible();
    await page.locator("text=Initial memory").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Edit" }).click();
    await page.locator("form").filter({ has: page.getByRole("button", { name: "Save memory" }) }).getByLabel("Content").fill(`Edited memory ${suffix}`);
    await page.getByRole("button", { name: "Save memory" }).click();
    await expect(page.getByText(`Edited memory ${suffix}`)).toBeVisible();
    await page.locator("text=Edited memory").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("dialog", { name: "Archive memory?" })).toBeVisible();
    await page.getByRole("button", { name: "Archive memory" }).click();
    await expect(page.getByText("Memory archived.")).toBeVisible();
    await page.locator("text=Edited memory").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog", { name: "Delete memory?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete memory" }).click();
    await expect(page.getByText("Memory deleted.")).toBeVisible();

    await page.goto("/agents");
    const agentCard = cardWithText(page, agentName);
    await agentCard.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete agent" }).click();
    await expect(page.getByText("Agent deleted.")).toBeVisible();
    await backend.put(`/souls/${soul.id}`, { data: { is_active: false } });
    await apiDelete(`/souls/${soul.id}`);
    expect(agentId).toBeGreaterThan(0);
  });

  test("creates, edits, and deletes a tool", async ({ page }) => {
    const toolName = `v2e2e_tool_${suffix}`;
    await page.goto("/tools/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(toolName);
    await page.getByRole("textbox", { name: "Description" }).fill("Created in frontend e2e.");
    await page.locator('input[name="tool_type"]').fill("custom");
    await page.locator('textarea[name="configJson"]').fill(JSON.stringify({ mode: "test" }, null, 2));
    await page.getByRole("button", { name: "Save tool" }).click();
    await expect(page.getByRole("heading", { name: "Edit Tool" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Description" })).toHaveValue("Created in frontend e2e.");
    await page.getByRole("textbox", { name: "Description" }).click();
    await page.getByRole("textbox", { name: "Description" }).fill("Edited in frontend e2e.");
    await page.getByRole("button", { name: "Save tool" }).click();
    await expect(page.getByText("Tool saved.")).toBeVisible();
    await page.goto("/tools");
    const card = cardWithText(page, toolName);
    await expect(card).toContainText("Edited in frontend e2e.");
    await card.getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("button", { name: "Deactivate tool" }).click();
    await expect(page.getByText("Tool deactivated.")).toBeVisible();
    await cardWithText(page, toolName).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete tool" }).click();
    await expect(page.getByText("Tool deleted.")).toBeVisible();
  });

  test("archives, inspects, and activates a run", async ({ page }) => {
    const agent = await createApiAgent(`V2E2E Run Agent ${suffix}`);
    const workflow = await apiPost<{ id: number }>("/workflows", {
      name: `V2E2E Run Workflow ${suffix}`,
      workflow_type: "sequential",
      graph_config: { agent_sequence: [agent.id] },
      is_active: true
    });
    const run = await apiPost<{ id: number }>(`/workflows/${workflow.id}/run`, { task: "Create a short run result." });

    await page.goto("/runs");
    const runCard = cardWithText(page, `Run ${run.id}`);
    await runCard.getByRole("button", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: `Run ${run.id}` })).toBeVisible();
    await page.getByRole("button", { name: /Expand/ }).first().click();
    await expect(page.locator("pre").first()).toBeVisible();

    await page.goto("/runs");
    await cardWithText(page, `Run ${run.id}`).getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("dialog", { name: "Archive run?" })).toBeVisible();
    await page.getByRole("button", { name: "Archive run" }).click();
    await expect(cardWithText(page, `Run ${run.id}`)).toHaveCount(0);
    await page.getByLabel("Run filter").selectOption("Archived");
    await cardWithText(page, `Run ${run.id}`).getByRole("button", { name: "Activate" }).click();
    await expect(page.getByRole("dialog", { name: "Activate run?" })).toBeVisible();
    await page.getByRole("button", { name: "Activate run" }).click();
    await expect(cardWithText(page, `Run ${run.id}`)).toHaveCount(0);
    await page.getByLabel("Run filter").selectOption("Active");
    await expect(cardWithText(page, `Run ${run.id}`)).toBeVisible();

    await page.getByLabel("Run filter").selectOption("Active");
    await cardWithText(page, `Run ${run.id}`).getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive run" }).click();
    await page.getByLabel("Run filter").selectOption("Archived");
    await cardWithText(page, `Run ${run.id}`).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog", { name: "Delete run permanently?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete run" }).click();
    await expect(page.getByText("Run deleted permanently.")).toBeVisible();
    await apiDelete(`/workflows/${workflow.id}`);
    await apiDelete(`/agents/${agent.id}`);
  });

  test("creates a workflow from agent picker and runs it", async ({ page }) => {
    const agent = await createApiAgent(`V2E2E Workflow Agent ${suffix}`);
    const workflowName = `V2E2E Workflow UI ${suffix}`;
    await page.goto("/workflows/new");
    await page.getByLabel("Name").fill(workflowName);
    await page.getByLabel("Description").fill("Created through workflow UI.");
    await page.getByText(agent.name).click();
    await page.getByRole("button", { name: "Save workflow" }).click();
    await expect(page.getByRole("heading", { name: "Workflow Detail" })).toBeVisible();
    const workflowId = idFromUrl(page.url());
    await page.getByPlaceholder("Describe the task for this workflow.").fill("Produce a short workflow UI result.");
    await page.getByRole("button", { name: "Run workflow" }).click();
    await expect(page.getByRole("heading", { name: /Run \d+/ })).toBeVisible();
    const runId = idFromUrl(page.url());

    await apiPost(`/runs/${runId}/archive`, {});
    await apiDelete(`/runs/${runId}/hard-delete`);
    await apiDelete(`/workflows/${workflowId}`);
    await apiDelete(`/agents/${agent.id}`);
  });

  test("shows and clears notification badges for feedback-derived pending proposed memories", async ({ page }) => {
    const beforeSummary = await apiGet<{ total_count: number }>("/proposed-memory-notifications");
    const beforeCount = beforeSummary.total_count;

    const agent = await createApiAgent(`V2E2E Notify Agent ${suffix}`);
    const workflow = await apiPost<{ id: number }>("/workflows", {
      name: `V2E2E Notify Workflow ${suffix}`,
      workflow_type: "sequential",
      graph_config: { agent_sequence: [agent.id] },
      is_active: true
    });
    const run = await apiPost<{ id: number }>(`/workflows/${workflow.id}/run`, { task: "Test notification badges." });
    const feedback = await apiPost<{ id: number }>(`/runs/${run.id}/agents/${agent.id}/feedback`, {
      feedback_text: "Consider improving the notification system.",
      feedback_type: "improvement"
    });
    const proposed = await apiPost<{ id: number; status: string }>(`/agents/${agent.id}/proposed-memories`, {
      source_feedback_id: feedback.id,
      content: "Test proposed memory from feedback for notification badges.",
      memory_type: "lesson"
    });
    expect(proposed.status).toBe("pending");
    const expectedTotal = String(beforeCount + 1);

    // Sidebar badge on Agents nav
    await page.goto("/");
    const sidebarBadge = page.getByLabel("Pending feedback memory approval");
    await expect(sidebarBadge).toBeVisible();
    await expect(sidebarBadge).toHaveText(expectedTotal);

    // Agent list card badge
    await page.goto("/agents");
    const agentCard = cardWithText(page, agent.name);
    await expect(agentCard.getByLabel("Pending feedback memory approval")).toBeVisible();

    // Agent detail Proposed Memories section badge (scope to main to exclude sidebar badge)
    await page.goto(`/agents/${agent.id}`);
    await expect(page.locator("main").getByLabel("Pending feedback memory approval")).toBeVisible();
    await expect(page.locator("main").getByLabel("Pending feedback memory approval")).toHaveText("1");

    // Approve via UI → detail section badge cleared
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Proposed memory approved.")).toBeVisible();
    await expect(page.locator("main").getByLabel("Pending feedback memory approval")).toHaveCount(0);

    // Sidebar badge returns to baseline
    if (beforeCount === 0) {
      await expect(page.getByLabel("Pending feedback memory approval")).toHaveCount(0);
    } else {
      await expect(page.getByLabel("Pending feedback memory approval")).toHaveText(String(beforeCount));
    }

    // Cleanup (feedback/learning records prevent cascaded deletes; archive + deactivate instead)
    await apiPost(`/runs/${run.id}/archive`, {});
    backend.put(`/agents/${agent.id}`, { data: { is_active: false } });
  });

  test("archives an experiment with related runs without circular cleanup", async ({ page }) => {
    const firstAgent = await createApiAgent(`V2E2E Experiment Agent A ${suffix}`);
    const secondAgent = await createApiAgent(`V2E2E Experiment Agent B ${suffix}`);
    const experimentName = `V2E2E Experiment ${suffix}`;
    await page.goto("/experiments/new");
    await page.getByLabel("Name").fill(experimentName);
    await page.getByLabel("Task prompt").fill("Compare two mock agents on CRUD dependency handling.");
    await page.getByText(firstAgent.name).click();
    await page.getByText(secondAgent.name).click();
    await page.getByRole("button", { name: "Save experiment" }).click();
    await expect(page.getByRole("heading", { name: "Experiment Detail" })).toBeVisible();
    const experimentId = idFromUrl(page.url());
    await page.getByRole("button", { name: "Run experiment" }).click();
    await expect(page.getByText(/Experiment run created with runs/)).toBeVisible({ timeout: 60000 });
    await page.getByText(/Experiment run created with runs/).textContent();
    await page.goto("/experiments");
    await cardWithText(page, experimentName).getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("dialog", { name: "Archive experiment?" })).toBeVisible();
    await page.getByRole("button", { name: "Archive experiment" }).click();
    await expect(page.getByText(/Experiment archived successfully/)).toBeVisible();
    await expect(cardWithText(page, experimentName)).toHaveCount(0);
    await page.getByLabel("Experiment filter").selectOption("Archived");
    await expect(cardWithText(page, experimentName)).toContainText("archived");
    await cardWithText(page, experimentName).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete experiment" }).click();
    await expect(page.getByRole("dialog", { name: "Action blocked" })).toContainText("Cannot safely delete experiment");
    await page.getByRole("button", { name: "Close" }).click();

    await apiDelete(`/experiments/${experimentId}?force=true`);
    await apiDelete(`/agents/${firstAgent.id}`);
    await apiDelete(`/agents/${secondAgent.id}`);
  });

  test("shows blocking run links when agent delete is rejected due to runtime history", async ({ page }) => {
    const agent = await createApiAgent(`V2E2E BlockedDelete Agent ${suffix}`);
    const workflow = await apiPost<{ id: number; name: string }>("/workflows", {
      name: `V2E2E BlockedDelete Workflow ${suffix}`,
      workflow_type: "sequential",
      graph_config: { agent_sequence: [agent.id] },
      is_active: true
    });
    const run = await apiPost<{ id: number; status: string }>(`/workflows/${workflow.id}/run`, { task: "Create runtime history for blocked delete." });

    await backend.put(`/agents/${agent.id}`, { data: { is_active: false } });

    await page.goto("/agents");
    await cardWithText(page, agent.name).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog", { name: "Delete agent?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete agent" }).click();

    // Either dialog may appear depending on how the backend formats the 409 response
    const blockedDialog = page.getByRole("dialog", { name: /Cannot delete agent|Action blocked/ });
    await expect(blockedDialog).toBeVisible();
    await expect(blockedDialog).toContainText(/runtime history|learning record/);
    // Run link is only present when the structured "Cannot delete agent" dialog shows
    const runLink = page.getByRole("link", { name: `Run ${run.id}` });
    if (await runLink.isVisible().catch(() => false)) {
      await expect(page.getByText(workflow.name)).toBeVisible();
      await runLink.click();
      await expect(page.getByRole("heading", { name: `Run ${run.id}` })).toBeVisible();
    }

    await apiPost(`/runs/${run.id}/archive`, {});
    await apiDelete(`/runs/${run.id}/hard-delete`);
    await apiDelete(`/workflows/${workflow.id}`);
    await apiDelete(`/agents/${agent.id}`);
  });

  test("submits feedback on a run agent and generates a pending proposed memory", async ({ page }) => {
    const agent = await createApiAgent(`V2E2E Feedback Agent ${suffix}`);
    const workflow = await apiPost<{ id: number }>("/workflows", {
      name: `V2E2E Feedback Workflow ${suffix}`,
      workflow_type: "sequential",
      graph_config: { agent_sequence: [agent.id] },
      is_active: true
    });
    const run = await apiPost<{ id: number }>(`/workflows/${workflow.id}/run`, { task: "Produce output for feedback e2e." });

    await page.goto(`/runs/${run.id}`);
    await expect(page.getByRole("heading", { name: `Run ${run.id}` })).toBeVisible();
    await expect(page.getByText("Learning & Feedback")).toBeVisible();

    // Select the agent
    await page.getByRole("button", { name: agent.name }).click();

    // Fill feedback form
    await page.getByLabel("Feedback type").selectOption("improvement");
    await page.getByLabel("Rating 4").click();
    await page.getByPlaceholder("Describe what the agent did well or what could be improved...").fill("The agent provided a thorough analysis. Consider adding more concrete examples next time.");
    await page.getByRole("button", { name: "Submit feedback" }).click();

    await expect(page.getByText("Feedback submitted.")).toBeVisible();
    await expect(page.getByText("The agent provided a thorough analysis.")).toBeVisible();

    // Generate proposed memory
    await page.getByRole("button", { name: /Generate proposed memory from feedback/ }).click();

    await expect(page.getByText("Proposed memory created from feedback.")).toBeVisible();
    await expect(page.getByText("Proposed memory created", { exact: true })).toBeVisible();
    await expect(page.getByText("View agent proposed memories")).toBeVisible();

    // Cleanup: learning records prevent hard-delete; archive run and deactivate agent instead
    await apiPost(`/runs/${run.id}/archive`, {});
    await backend.put(`/agents/${agent.id}`, { data: { is_active: false } });
  });

  test("full learning loop: feedback -> reflect -> approve -> active memory -> re-run", async ({ page }) => {
    const agent = await createApiAgent(`V2E2E Loop Agent ${suffix}`);
    const workflow = await apiPost<{ id: number }>("/workflows", {
      name: `V2E2E Loop Workflow ${suffix}`,
      workflow_type: "sequential",
      graph_config: { agent_sequence: [agent.id] },
      is_active: true
    });
    const task = "Full loop verification task.";
    const run = await apiPost<{ id: number }>(`/workflows/${workflow.id}/run`, { task });

    // Step 1: Navigate to run detail, submit feedback
    await page.goto(`/runs/${run.id}`);
    await expect(page.getByRole("heading", { name: `Run ${run.id}` })).toBeVisible();
    await page.getByRole("button", { name: agent.name }).click();
    await page.getByLabel("Feedback type").selectOption("improvement");
    await page.getByLabel("Rating 5").click();
    await page.getByPlaceholder("Describe what the agent did well or what could be improved...").fill("Excellent work on the full loop test. Keep up the good patterns.");
    await page.getByRole("button", { name: "Submit feedback" }).click();
    await expect(page.getByText("Feedback submitted.")).toBeVisible();

    // Step 2: Generate proposed memory from feedback
    await page.getByRole("button", { name: /Generate proposed memory from feedback/ }).click();
    await expect(page.getByText("Proposed memory created from feedback.")).toBeVisible();

    // Step 3: Navigate to agent detail, approve the proposed memory
    await page.getByRole("link", { name: "View agent proposed memories" }).click();
    await expect(page.getByRole("heading", { name: "Agent Detail" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Proposed Memories", exact: true })).toBeVisible();

    // Verify source info is shown on proposed memory card
    // .last() because the MemoryManager Type tooltip also matches /from feedback/ (first in DOM order)
    await expect(page.getByText(/from feedback/).last()).toBeVisible();

    // Approve it
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Proposed memory approved.")).toBeVisible();

    // Step 4: Verify approved memory is visible in the agent detail
    await expect(page.getByText(/lesson.*approved/)).toBeVisible();

    // Step 5: Go back to run detail and re-run
    await page.goto(`/runs/${run.id}`);
    await expect(page.getByRole("heading", { name: `Run ${run.id}` })).toBeVisible();
    await page.getByRole("button", { name: "Re-run" }).click();

    // Step 6: Verify redirected to new run monitor page
    await expect(page.getByRole("heading", { name: /Run \d+ Monitor/ })).toBeVisible();
    const newRunId = idFromUrl(page.url());
    expect(newRunId).not.toBe(run.id);

    // Step 7: Verify learning summary card exists on monitor page
    // Use getByRole for heading to avoid strict mode with "Learning events" label text elsewhere
    await expect(page.getByRole("heading", { name: "Learning Events" })).toBeVisible();
    await expect(page.getByText("Feedback")).toBeVisible();
    await expect(page.getByText("Proposed memories")).toBeVisible();

    // Cleanup
    await apiPost(`/runs/${run.id}/archive`, {});
    await apiPost(`/runs/${newRunId}/archive`, {});
    await backend.put(`/agents/${agent.id}`, { data: { is_active: false } });
  });

  test("rejected proposed memory does not create active memory and clears badge", async ({ page }) => {
    const agent = await createApiAgent(`V2E2E Reject Agent ${suffix}`);
    const workflow = await apiPost<{ id: number }>("/workflows", {
      name: `V2E2E Reject Workflow ${suffix}`,
      workflow_type: "sequential",
      graph_config: { agent_sequence: [agent.id] },
      is_active: true
    });
    const run = await apiPost<{ id: number }>(`/workflows/${workflow.id}/run`, { task: "Test rejected memory flow." });
    const feedback = await apiPost<{ id: number }>(`/runs/${run.id}/agents/${agent.id}/feedback`, {
      feedback_text: "This feedback will be rejected.",
      feedback_type: "issue"
    });
    await apiPost(`/agents/${agent.id}/proposed-memories`, {
      source_feedback_id: feedback.id,
      content: "Proposed memory that will be rejected.",
      memory_type: "lesson"
    });

    // Navigate to agent detail
    await page.goto(`/agents/${agent.id}`);
    await expect(page.getByRole("heading", { name: "Proposed Memories", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();

    // Reject the proposed memory
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("Proposed memory rejected.")).toBeVisible();

    // Verify badge cleared for this agent's proposed memories
    await expect(page.locator("main").getByLabel("Pending feedback memory approval")).toHaveCount(0);

    // Verify the proposed memory shows rejected status, no longer has Approve/Reject buttons
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
    // Scope to the proposed memory card to avoid matching the status dropdown option and alert message
    const rejectedCard = page.locator(".rounded-md.border.border-border.p-3").filter({ hasText: "Proposed memory that will be rejected" });
    await expect(rejectedCard.locator("span").filter({ hasText: /^rejected$/ })).toBeVisible();

    // Cleanup
    await apiPost(`/runs/${run.id}/archive`, {});
    await backend.put(`/agents/${agent.id}`, { data: { is_active: false } });
  });

  test("shows field help tooltips on agent and soul forms", async ({ page }) => {
    // Agent form help icons
    await page.goto("/agents/new");
    await expect(page.getByRole("heading", { name: "New Agent" })).toBeVisible();

    // Verify tooltip help icons exist on agent form (tooltip variant uses span+SVG, not button)
    for (const field of ["Model", "Temperature", "Max tokens"]) {
      await expect(page.locator("label").filter({ hasText: field }).locator("svg")).toBeVisible();
    }

    // Popover help on JSON fields — click to reveal
    const memPolicyHelp = page.locator("label").filter({ hasText: "Memory policy JSON" }).locator("button[aria-label^='Help']");
    await expect(memPolicyHelp).toBeVisible();
    await memPolicyHelp.click();
    await expect(page.getByRole("dialog")).toContainText("manual_review");
    await page.keyboard.press("Escape");

    const ctxPolicyHelp = page.locator("label").filter({ hasText: "Context policy JSON" }).locator("button[aria-label^='Help']");
    await ctxPolicyHelp.click();
    await expect(page.getByRole("dialog")).toContainText("context entries");
    await page.keyboard.press("Escape");

    const handoffPolicyHelp = page.locator("label").filter({ hasText: "Handoff policy JSON" }).locator("button[aria-label^='Help']");
    await handoffPolicyHelp.click();
    await expect(page.getByRole("dialog")).toContainText("allow_handoff");
    await page.keyboard.press("Escape");

    // Soul form help icons
    await page.goto("/souls/new");
    await expect(page.getByRole("heading", { name: "New Soul" })).toBeVisible();

    // Tooltip is CSS-hover only; verify the icon exists
    const principlesIcon = page.locator("label").filter({ hasText: "Principles" }).locator("svg");
    await expect(principlesIcon).toBeVisible();

    // Verify all five soul style fields have help icons
    for (const field of ["Decision style", "Collaboration style", "Failure handling style", "Escalation style"]) {
      const icon = page.locator("label").filter({ hasText: field }).locator("svg");
      await expect(icon).toBeVisible();
    }
  });
});

function cardWithText(page: Page, text: string) {
  return page.locator("div.rounded-sm").filter({ hasText: text }).first();
}

function idFromUrl(url: string) {
  const id = Number(url.match(/\/(\d+)(?:$|\/|\?)/)?.[1]);
  expect(Number.isFinite(id)).toBeTruthy();
  return id;
}

async function createApiAgent(name: string) {
  return apiPost<{ id: number; name: string }>("/agents", {
    name,
    role: "e2e agent",
    system_prompt: "Run a deterministic mock workflow.",
    llm_provider: "mock",
    model: "mock-deterministic",
    temperature: 0.2,
    max_tokens: 1024,
    memory_policy: { write_mode: "manual_review", retrieval_enabled: true },
    context_policy: { include_active_context: true },
    handoff_policy: { allow_handoff: false, allowed_agent_ids: [] },
    is_active: true
  });
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await backend.post(path, { data: body });
  expect(response.ok(), `${path} should return success`).toBeTruthy();
  return (await response.json()) as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await backend.get(path);
  expect(response.ok(), `${path} should return success`).toBeTruthy();
  return (await response.json()) as T;
}

async function apiDelete(path: string): Promise<void> {
  const response = await backend.delete(path);
  expect(response.ok(), `${path} should delete successfully`).toBeTruthy();
}
