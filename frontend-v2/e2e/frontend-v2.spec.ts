import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:8000";
const suffix = `${Date.now()}`;
let backend: APIRequestContext;

test.describe.serial("frontend-v2 PoC", () => {
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
    await page.getByLabel("Description").fill("Created by frontend-v2 Playwright.");
    await page.getByLabel("Principles").fill("Prefer visible, safe CRUD.");
    await page.getByRole("button", { name: "Save soul" }).click();
    await expect(page.getByRole("heading", { name: "Edit Soul" })).toBeVisible();
    await page.getByLabel("Description").fill("Edited by frontend-v2 Playwright.");
    await page.getByRole("button", { name: "Save soul" }).click();
    await expect(page.getByText("Soul saved.")).toBeVisible();
    await page.getByRole("link", { name: "Back to souls" }).click();
    const card = cardWithText(page, name);
    await expect(card).toContainText("Edited by frontend-v2 Playwright.");
    await card.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog", { name: "Delete soul?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete soul" }).click();
    await expect(page.getByText("Soul deleted.")).toBeVisible();
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("creates, edits, deactivates, and deletes an agent with scoped context and memory", async ({ page }) => {
    const soul = await apiPost<{ id: number; name: string }>("/souls", { name: `V2E2E Agent Soul ${suffix}` });
    const agentName = `V2E2E Agent ${suffix}`;
    await page.goto("/agents/new");
    await page.getByLabel("Name").fill(agentName);
    await page.getByLabel("Role").fill("Frontend v2 validation agent");
    await page.getByLabel("Description").fill("Validates v2 agent configuration.");
    await page.getByLabel("Soul").selectOption({ label: soul.name });
    await page.getByLabel("Provider").selectOption("mock");
    await page.getByLabel("Model").fill("mock-deterministic");
    await page.getByLabel("System prompt").fill("Validate frontend-v2 agent CRUD.");
    await page.getByRole("button", { name: "Save agent" }).click();
    await expect(page.getByRole("heading", { name: "Agent Detail" })).toBeVisible();
    const agentId = idFromUrl(page.url());
    const agentForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Save agent" }) });

    await agentForm.getByLabel("Description").fill("Edited v2 agent.");
    await agentForm.getByLabel("Active").uncheck();
    await agentForm.getByRole("button", { name: "Save agent" }).click();
    await expect(page.getByText("Agent saved.")).toBeVisible();
    await expect(page.getByText("inactive")).toBeVisible();

    const contextForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add context" }) });
    await contextForm.getByLabel("Title").fill(`V2E2E Context ${suffix}`);
    await contextForm.getByLabel("Content").fill(`Initial context ${suffix}`);
    await contextForm.getByRole("button", { name: "Add context" }).click();
    await expect(page.getByText("Context created.")).toBeVisible();
    await page.locator("text=Initial context").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Edit" }).click();
    await page.locator("form").filter({ has: page.getByRole("button", { name: "Save context" }) }).getByLabel("Content").fill(`Edited context ${suffix}`);
    await page.getByRole("button", { name: "Save context" }).click();
    await expect(page.getByText(`Edited context ${suffix}`)).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.locator("text=Edited context").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Context deleted.")).toBeVisible();

    const memoryForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add memory" }) });
    await memoryForm.getByLabel("Type").fill("lesson");
    await memoryForm.getByLabel("Source").fill("frontend_v2_e2e");
    await memoryForm.getByLabel("Content").fill(`Initial memory ${suffix}`);
    await memoryForm.getByRole("button", { name: "Add memory" }).click();
    await expect(page.getByText("Memory created.")).toBeVisible();
    await page.locator("text=Initial memory").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Edit" }).click();
    await page.locator("form").filter({ has: page.getByRole("button", { name: "Save memory" }) }).getByLabel("Content").fill(`Edited memory ${suffix}`);
    await page.getByRole("button", { name: "Save memory" }).click();
    await expect(page.getByText(`Edited memory ${suffix}`)).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.locator("text=Edited memory").locator("xpath=ancestor::div[contains(@class,'border')][1]").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Memory deleted.")).toBeVisible();

    await page.goto("/agents");
    const agentCard = cardWithText(page, agentName);
    await agentCard.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete agent" }).click();
    await expect(page.getByText("Agent deleted.")).toBeVisible();
    await apiDelete(`/souls/${soul.id}`);
    expect(agentId).toBeGreaterThan(0);
  });

  test("creates, edits, and deletes a tool", async ({ page }) => {
    const toolName = `v2e2e_tool_${suffix}`;
    await page.goto("/tools/new");
    await page.getByLabel("Name").fill(toolName);
    await page.getByLabel("Description").fill("Created in frontend-v2.");
    await page.getByLabel("Tool type").fill("custom");
    await page.getByLabel("Config JSON").fill(JSON.stringify({ mode: "test" }, null, 2));
    await page.getByRole("button", { name: "Save tool" }).click();
    await expect(page.getByRole("heading", { name: "Edit Tool" })).toBeVisible();
    await page.getByLabel("Description").fill("Edited in frontend-v2.");
    await page.getByRole("button", { name: "Save tool" }).click();
    await expect(page.getByText("Tool saved.")).toBeVisible();
    await page.getByRole("link", { name: "Back to tools" }).click();
    const card = cardWithText(page, toolName);
    await expect(card).toContainText("Edited in frontend-v2.");
    await card.getByRole("button", { name: "Delete" }).click();
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
    const run = await apiPost<{ id: number }>(`/workflows/${workflow.id}/run`, { task: "Create a short frontend-v2 run result." });

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

    await apiPost(`/runs/${run.id}/archive`, {});
    await apiDelete(`/runs/${run.id}/hard-delete`);
    await apiDelete(`/workflows/${workflow.id}`);
    await apiDelete(`/agents/${agent.id}`);
  });
});

function cardWithText(page: Page, text: string) {
  return page.locator("div.rounded-md").filter({ hasText: text }).first();
}

function idFromUrl(url: string) {
  const id = Number(url.match(/\/(\d+)(?:$|\/|\?)/)?.[1]);
  expect(Number.isFinite(id)).toBeTruthy();
  return id;
}

async function createApiAgent(name: string) {
  return apiPost<{ id: number; name: string }>("/agents", {
    name,
    role: "frontend-v2 e2e agent",
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

async function apiDelete(path: string): Promise<void> {
  const response = await backend.delete(path);
  expect(response.ok(), `${path} should delete successfully`).toBeTruthy();
}
