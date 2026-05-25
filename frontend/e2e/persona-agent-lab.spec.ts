import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:8000";
const TASK_INPUT = `A customer says the April revenue number in the dashboard does not match their Excel report.

Dashboard revenue: $1.28M.
Excel revenue: $1.34M.

The customer has not provided the Excel file or raw source data yet.

Please produce:
1. A practical troubleshooting plan.
2. Likely causes.
3. Internal checks first.
4. Minimum information needed from the customer.
5. A short customer-facing response.`;

const DEFAULT_MEMORY_POLICY = JSON.stringify({ write_mode: "manual_review", retrieval_enabled: true }, null, 2);
const DEFAULT_CONTEXT_POLICY = JSON.stringify({ include_active_context: true }, null, 2);
const DEFAULT_HANDOFF_POLICY = JSON.stringify({ allow_handoff: false, allowed_agent_ids: [] }, null, 2);

interface ScenarioState {
  suffix: string;
  souls: Record<string, number>;
  agents: Record<string, number>;
  toolId?: number;
  workflowId?: number;
  runId?: number;
  learnedMemoryContent?: string;
}

let backend: APIRequestContext;
const scenario: ScenarioState = {
  suffix: `${Date.now()}`,
  souls: {},
  agents: {}
};

test.describe.serial("Persona Agent Lab E2E", () => {
  test.beforeAll(async () => {
    backend = await playwrightRequest.newContext({ baseURL: API_BASE });
    const health = await backend.get("/health");
    expect(health.ok(), `Backend must be running at ${API_BASE}`).toBeTruthy();
  });

  test.afterAll(async () => {
    await backend.dispose();
  });

  test("creates agents, configures a sequential workflow, runs it, and views run output", async ({ page }) => {
    const names = namesForScenario(scenario.suffix);

    scenario.souls.problemSolver = await createSoulViaUi(page, names.problemSolverSoul, {
      description: "Persistent troubleshooting persona for business analytics investigations.",
      principles: "Start with available evidence. Prefer internal checks before requesting customer files.",
      decisionStyle: "Systematic, evidence-first, and concise.",
      collaborationStyle: "Keeps reviewers and customer-facing writers informed.",
      failureHandlingStyle: "Names uncertainty and asks for the minimum missing information.",
      escalationStyle: "Escalate only after dashboard configuration, metric definitions, refresh timestamps, and ETL logic are checked."
    });
    scenario.souls.criticalReviewer = await createSoulViaUi(page, names.criticalReviewerSoul, {
      description: "Reviewer persona for checking reasoning quality.",
      principles: "Challenge weak evidence and missing internal checks.",
      decisionStyle: "Critical but practical.",
      collaborationStyle: "Improves the prior agent output without changing private memory boundaries.",
      failureHandlingStyle: "Identifies gaps clearly.",
      escalationStyle: "Escalates unresolved evidence gaps."
    });
    scenario.souls.customerConsultant = await createSoulViaUi(page, names.customerConsultantSoul, {
      description: "Customer-ready communication persona.",
      principles: "Be clear, calm, and action-oriented.",
      decisionStyle: "Translate internal findings into customer-friendly language.",
      collaborationStyle: "Preserve useful nuance from upstream agents.",
      failureHandlingStyle: "Avoid overclaiming.",
      escalationStyle: "Ask for the smallest set of customer details needed."
    });

    scenario.agents.troubleshooter = await createAgentViaUi(page, names.troubleshooterAgent, names.problemSolverSoul, {
      role: "Persistent BI discrepancy troubleshooter",
      description: "Investigates metric mismatches using internal dashboard evidence first.",
      systemPrompt: "Create practical troubleshooting plans for BI dashboard discrepancies. Check internal evidence before asking for customer files."
    });
    await addContextViaUi(page, {
      title: "BI Dashboard Discrepancy Troubleshooting Playbook",
      type: "playbook",
      priority: "10",
      content:
        "For BI dashboard discrepancy work, check date range mismatch, metric definition mismatch, dashboard filters, refresh timestamp, and ETL logic before requesting customer files."
    });
    await addMemoryViaUi(page, {
      type: "lesson",
      source: "manual_e2e",
      importance: "95",
      status: "active",
      content:
        "For BI discrepancy investigations, first check filters, date range, metric definition, refresh timestamp, and ETL logic before asking for customer files."
    });

    scenario.agents.reviewer = await createAgentViaUi(page, names.reviewerAgent, names.criticalReviewerSoul, {
      role: "Critical reviewer",
      description: "Reviews the troubleshooting plan for evidence discipline.",
      systemPrompt: "Review the prior troubleshooting plan for missing evidence, weak assumptions, and customer readiness."
    });
    await addContextViaUi(page, {
      title: "Troubleshooting Plan Review Standards",
      type: "standard",
      priority: "20",
      content: "Check whether the plan covers internal dashboard filters, metric definitions, refresh timestamps, ETL logic, and minimum customer asks."
    });

    scenario.agents.writer = await createAgentViaUi(page, names.writerAgent, names.customerConsultantSoul, {
      role: "Customer response writer",
      description: "Turns reviewed troubleshooting work into a customer-ready response.",
      systemPrompt: "Write short, customer-facing responses that are clear, calm, and specific about next steps."
    });
    await addContextViaUi(page, {
      title: "Customer Communication Style Guide",
      type: "style_guide",
      priority: "30",
      content: "Use plain English. Acknowledge the discrepancy. Explain internal checks first, then ask only for minimum missing information."
    });

    scenario.toolId = await createToolViaUi(page, names.toolName);
    await assignToolViaUi(page, scenario.agents.troubleshooter, names.toolName);

    scenario.workflowId = await createWorkflowViaUi(page, names.workflowName, [
      names.troubleshooterAgent,
      names.reviewerAgent,
      names.writerAgent
    ]);
    scenario.runId = await runWorkflowViaUi(page, scenario.workflowId, TASK_INPUT);

    await expect(page.getByRole("heading", { name: "Run Trace" })).toBeVisible();
    await expect(page.getByText("Status: completed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Run Input" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Run Output" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trace Events" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Monitor" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Executions" })).toBeVisible();

    const pageText = await page.locator("body").innerText();
    for (const eventType of [
      "run_started",
      "workflow_loaded",
      "agent_selected",
      "context_assembled",
      "memory_retrieved",
      "llm_request_started",
      "llm_response_received",
      "agent_completed",
      "run_completed"
    ]) {
      expect(pageText).toContain(eventType);
    }
    await expect(page.locator("body")).toContainText(/dashboard/i);
    await expect(page.locator("body")).toContainText(/Excel/i);
    await expect(page.locator("body")).toContainText(/date range|filters/i);
    await expect(page.locator("body")).toContainText(/customer/i);

    await page.getByRole("link", { name: "Monitor" }).click();
    await expect(page.getByRole("heading", { name: "Run Monitor" })).toBeVisible();
    await expect(page.getByText("Tokens")).toBeVisible();
    await page.goto(`/runs/${scenario.runId}/executions`);
    await expect(page.getByRole("heading", { name: "Agent Executions" })).toBeVisible();
  });

  test("adds feedback, generates proposed memory, approves it, and uses it in a later run", async ({ page }) => {
    expect(scenario.runId).toBeDefined();
    expect(scenario.workflowId).toBeDefined();
    const names = namesForScenario(scenario.suffix);

    await page.goto(`/runs/${scenario.runId}`);
    const learningSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Learning Feedback" }) });
    await learningSection.getByLabel("Agent").selectOption({ label: names.troubleshooterAgent });
    await learningSection.getByLabel("Feedback type").fill("improvement");
    await learningSection.getByLabel("Rating").fill("3");
    await learningSection.getByLabel("Feedback", { exact: true }).fill(
      "This agent should first check dashboard filters, date range, metric definition, refresh timestamp, and ETL logic internally before asking the customer for files."
    );
    await learningSection.getByRole("button", { name: "Save feedback" }).click();
    await expect(learningSection).toContainText("Feedback saved for this run and agent.");
    await learningSection.getByRole("button", { name: "Generate proposed memory" }).click();
    await expect(learningSection).toContainText("pending");
    await expect(learningSection).toContainText("dashboard filters");
    await learningSection.getByRole("link", { name: "Review on agent page" }).click();

    await expect(page.getByRole("heading", { name: "Proposed Memories" })).toBeVisible();
    const proposedSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Proposed Memories" }) });
    await proposedSection.getByRole("button", { name: "Approve" }).first().click();
    await expect(proposedSection).toContainText("Proposed memory approved and written as active agent memory.");

    const memories = await apiGet<Array<{ content: string; status: string }>>(`/agents/${scenario.agents.troubleshooter}/memories`);
    const approvedMemory = memories.find(
      (memory) => memory.status === "active" && memory.content.includes("dashboard filters") && memory.content.includes("ETL logic")
    );
    expect(approvedMemory).toBeTruthy();
    scenario.learnedMemoryContent = approvedMemory?.content;

    const secondRunId = await runWorkflowViaUi(page, scenario.workflowId as number, TASK_INPUT);
    const details = await executionDetailsByAgent(secondRunId);
    const troubleshooterDetail = JSON.stringify(details.get(scenario.agents.troubleshooter));
    const reviewerDetail = JSON.stringify(details.get(scenario.agents.reviewer));
    const writerDetail = JSON.stringify(details.get(scenario.agents.writer));

    expect(troubleshooterDetail).toContain(scenario.learnedMemoryContent);
    expect(reviewerDetail).not.toContain(scenario.learnedMemoryContent);
    expect(writerDetail).not.toContain(scenario.learnedMemoryContent);
  });

  test("keeps agent context and memory isolated during workflow execution", async () => {
    const suffix = `${scenario.suffix}-iso`;
    const agentA = await createAgentApi(`E2E Isolation Agent A ${suffix}`, "Isolation Agent A");
    const agentB = await createAgentApi(`E2E Isolation Agent B ${suffix}`, "Isolation Agent B");
    await apiPost(`/agents/${agentA.id}/contexts`, {
      title: `Private A Context ${suffix}`,
      context_type: "private",
      content: `PRIVATE_CONTEXT_AGENT_A_ONLY_${suffix}`,
      priority: 1,
      is_active: true
    });
    await apiPost(`/agents/${agentA.id}/memories`, {
      memory_type: "private",
      content: `PRIVATE_MEMORY_AGENT_A_ONLY_${suffix}`,
      importance: 100,
      status: "active"
    });
    await apiPost(`/agents/${agentB.id}/contexts`, {
      title: `Private B Context ${suffix}`,
      context_type: "private",
      content: `PRIVATE_CONTEXT_AGENT_B_ONLY_${suffix}`,
      priority: 1,
      is_active: true
    });
    await apiPost(`/agents/${agentB.id}/memories`, {
      memory_type: "private",
      content: `PRIVATE_MEMORY_AGENT_B_ONLY_${suffix}`,
      importance: 100,
      status: "active"
    });
    const workflow = await apiPost<{ id: number }>("/workflows", {
      name: `E2E Isolation Workflow ${suffix}`,
      workflow_type: "sequential",
      graph_config: { agent_sequence: [agentA.id, agentB.id] }
    });
    const run = await apiPost<{ id: number }>(`/workflows/${workflow.id}/run`, {
      task: "Verify isolation markers."
    });
    const details = await executionDetailsByAgent(run.id);
    const detailA = JSON.stringify(details.get(agentA.id));
    const detailB = JSON.stringify(details.get(agentB.id));

    expect(detailA).toContain(`PRIVATE_CONTEXT_AGENT_A_ONLY_${suffix}`);
    expect(detailA).toContain(`PRIVATE_MEMORY_AGENT_A_ONLY_${suffix}`);
    expect(detailA).not.toContain(`PRIVATE_CONTEXT_AGENT_B_ONLY_${suffix}`);
    expect(detailA).not.toContain(`PRIVATE_MEMORY_AGENT_B_ONLY_${suffix}`);

    expect(detailB).toContain(`PRIVATE_CONTEXT_AGENT_B_ONLY_${suffix}`);
    expect(detailB).toContain(`PRIVATE_MEMORY_AGENT_B_ONLY_${suffix}`);
    expect(detailB).not.toContain(`PRIVATE_CONTEXT_AGENT_A_ONLY_${suffix}`);
    expect(detailB).not.toContain(`PRIVATE_MEMORY_AGENT_A_ONLY_${suffix}`);
  });
});

function namesForScenario(suffix: string) {
  return {
    problemSolverSoul: `E2E Persistent Problem Solver ${suffix}`,
    criticalReviewerSoul: `E2E Critical Reviewer ${suffix}`,
    customerConsultantSoul: `E2E Customer-Centric Consultant ${suffix}`,
    troubleshooterAgent: `E2E Persistent Troubleshooter ${suffix}`,
    reviewerAgent: `E2E Critical Reviewer Agent ${suffix}`,
    writerAgent: `E2E Customer Response Writer ${suffix}`,
    workflowName: `E2E Dashboard Discrepancy Workflow ${suffix}`,
    toolName: `e2e_dashboard_lookup_${suffix}`
  };
}

async function createSoulViaUi(
  page: Page,
  name: string,
  values: {
    description: string;
    principles: string;
    decisionStyle: string;
    collaborationStyle: string;
    failureHandlingStyle: string;
    escalationStyle: string;
  }
) {
  await page.goto("/souls/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Description").fill(values.description);
  await page.getByLabel("Principles").fill(values.principles);
  await page.getByLabel("Decision style").fill(values.decisionStyle);
  await page.getByLabel("Collaboration style").fill(values.collaborationStyle);
  await page.getByLabel("Failure handling style").fill(values.failureHandlingStyle);
  await page.getByLabel("Escalation style").fill(values.escalationStyle);
  await page.getByRole("button", { name: "Save soul" }).click();
  await page.waitForURL(/\/souls\/\d+$/);
  await expect(page.getByRole("heading", { name: "Edit Soul" })).toBeVisible();
  return idFromUrl(page.url());
}

async function createAgentViaUi(
  page: Page,
  name: string,
  soulName: string,
  values: { role: string; description: string; systemPrompt: string }
) {
  await page.goto("/agents/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Role").fill(values.role);
  await page.getByLabel("Description").fill(values.description);
  await page.getByLabel("System prompt").fill(values.systemPrompt);
  await page.getByLabel("Soul / persona").selectOption({ label: soulName });
  await page.getByLabel("Agent is active").check();
  await page.getByLabel("Provider").selectOption("mock");
  await page.getByLabel("Model").fill("mock-deterministic");
  await page.getByLabel("Temperature").fill("0.2");
  await page.getByLabel("Max tokens").fill("1024");
  await page.getByLabel("Memory policy JSON").fill(DEFAULT_MEMORY_POLICY);
  await page.getByLabel("Context policy JSON").fill(DEFAULT_CONTEXT_POLICY);
  await page.getByLabel("Handoff policy JSON").fill(DEFAULT_HANDOFF_POLICY);
  await page.getByRole("button", { name: "Save agent" }).click();
  await page.waitForURL(/\/agents\/\d+$/);
  const summary = page.locator("section").filter({ has: page.getByRole("heading", { name: "Agent Summary" }) });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(soulName);
  return idFromUrl(page.url());
}

async function addContextViaUi(page: Page, values: { title: string; type: string; priority: string; content: string }) {
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Agent Context" }) });
  await section.getByLabel("Title").fill(values.title);
  await section.getByLabel("Type").fill(values.type);
  await section.getByLabel("Priority").fill(values.priority);
  await section.getByLabel("Content").fill(values.content);
  await section.getByRole("button", { name: "Add context" }).click();
  await expect(section).toContainText(values.title);
}

async function addMemoryViaUi(
  page: Page,
  values: { type: string; source: string; importance: string; status: string; content: string }
) {
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Agent Memory" }) });
  await section.getByLabel("Type").fill(values.type);
  await section.getByLabel("Source").fill(values.source);
  await section.getByLabel("Importance").fill(values.importance);
  await section.getByLabel("Status").selectOption(values.status);
  await section.getByLabel("Content").fill(values.content);
  await section.getByRole("button", { name: "Add memory" }).click();
  await expect(section).toContainText(values.content);
}

async function createToolViaUi(page: Page, toolName: string) {
  await page.goto("/tools");
  await page.getByLabel("Name").fill(toolName);
  await page.getByLabel("Type").fill("internal_reference");
  await page.getByLabel("Config JSON").fill(JSON.stringify({ mode: "mock", purpose: "e2e" }, null, 2));
  await page.getByLabel("Active").check();
  await page.getByLabel("Description").fill("E2E mock internal reference tool.");
  await page.getByRole("button", { name: "Register tool" }).click();
  await expect(page.getByText(toolName)).toBeVisible();
  const tools = await apiGet<Array<{ id: number; name: string }>>("/tools");
  return expectItem(tools, (tool) => tool.name === toolName).id;
}

async function assignToolViaUi(page: Page, agentId: number, toolName: string) {
  await page.goto(`/agents/${agentId}`);
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Assigned Tools" }) });
  const optionLabel = await section.getByLabel("Available tool").locator("option", { hasText: toolName }).first().textContent();
  expect(optionLabel).toBeTruthy();
  await section.getByLabel("Available tool").selectOption({ label: optionLabel!.trim() });
  await section.getByRole("button", { name: "Assign" }).click();
  await expect(section).toContainText("Tool assigned.");
  await expect(section).toContainText(toolName);
}

async function createWorkflowViaUi(page: Page, name: string, agentNames: string[]) {
  await page.goto("/workflows/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Description").fill("E2E sequential BI dashboard discrepancy workflow.");
  await page.getByLabel("Workflow type").selectOption("sequential");
  for (const agentName of agentNames) {
    await page.getByLabel("Available agent").selectOption({ label: agentName });
    await page.getByRole("button", { name: "Add" }).click();
  }
  for (const agentName of agentNames) {
    await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Agent sequence" }) })).toContainText(agentName);
  }
  await page.getByRole("button", { name: "Save workflow" }).click();
  await page.waitForURL(/\/workflows\/\d+$/);
  await expect(page.getByRole("heading", { name: "Edit Workflow" })).toBeVisible();
  return idFromUrl(page.url());
}

async function runWorkflowViaUi(page: Page, workflowId: number, task: string) {
  await page.goto(`/workflows/${workflowId}/run`);
  await page.getByLabel("Task prompt").fill(task);
  await page.getByRole("button", { name: "Run workflow" }).click();
  await expect(page.getByRole("link", { name: "View trace" })).toBeVisible();
  await page.getByRole("link", { name: "View trace" }).click();
  await page.waitForURL(/\/runs\/\d+$/);
  await expect(page.getByRole("heading", { name: "Run Trace" })).toBeVisible();
  return idFromUrl(page.url());
}

async function createAgentApi(name: string, role: string) {
  return apiPost<{ id: number; name: string }>("/agents", {
    name,
    role,
    system_prompt: `Use only context and memory scoped to ${name}.`,
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

async function executionDetailsByAgent(runId: number) {
  const executions = await apiGet<Array<{ id: number; agent_id: number }>>(`/runs/${runId}/executions`);
  const details = new Map<number, unknown>();
  for (const execution of executions) {
    details.set(execution.agent_id, await apiGet(`/runs/${runId}/executions/${execution.id}`));
  }
  return details;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await backend.get(path);
  expect(response.ok(), `${path} should return success`).toBeTruthy();
  return (await response.json()) as T;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await backend.post(path, { data: body });
  expect(response.ok(), `${path} should return success`).toBeTruthy();
  return (await response.json()) as T;
}

function idFromUrl(url: string) {
  const id = Number(url.match(/\/(\d+)(?:$|\?)/)?.[1]);
  expect(Number.isFinite(id), `Expected numeric id in ${url}`).toBeTruthy();
  return id;
}

function expectItem<T>(items: T[], predicate: (item: T) => boolean) {
  const item = items.find(predicate);
  expect(item).toBeTruthy();
  return item as T;
}
