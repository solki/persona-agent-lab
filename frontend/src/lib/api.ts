import type {
  AdminCleanupResponse,
  Agent,
  AgentContext,
  AgentFeedback,
  AgentMemory,
  CollaborationGraph,
  DemoCleanupResponse,
  DemoSeedResponse,
  Experiment,
  ExperimentRun,
  ProposedMemory,
  ProposedMemoryNotificationSummary,
  ReflectionResponse,
  ReviewerEvaluationResponse,
  Run,
  RunMonitor,
  Soul,
  Tool,
  TraceEvent,
  Workflow
} from "@/lib/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

type JsonBody = Record<string, unknown>;

export class ApiError extends Error {
  constructor(message: string, public status?: number, public body?: Record<string, unknown>) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const { message, body: errorBody } = await parseError(response);
    throw new ApiError(message, response.status, errorBody);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function parseError(response: Response): Promise<{ message: string; body?: Record<string, unknown> }> {
  try {
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const body = (await response.json()) as Record<string, unknown>;
      if (typeof body.detail === "string") {
        return { message: body.detail, body };
      }
      if (typeof body.detail === "object" && body.detail !== null) {
        const detail = body.detail as Record<string, unknown>;
        if (typeof detail.message === "string") {
          return { message: detail.message, body: detail };
        }
        return { message: JSON.stringify(detail), body: detail };
      }
      if (typeof body.message === "string") {
        return { message: body.message, body };
      }
    }
    const text = await response.text();
    return { message: text || `Request failed: ${response.status}` };
  } catch {
    return { message: `Request failed: ${response.status}` };
  }
}

function body(method: string, payload: JsonBody): RequestInit {
  return { method, body: JSON.stringify(payload) };
}

export const api = {
  listSouls: () => request<Soul[]>("/souls"),
  getSoul: (id: number) => request<Soul>(`/souls/${id}`),
  createSoul: (payload: JsonBody) => request<Soul>("/souls", body("POST", payload)),
  updateSoul: (id: number, payload: JsonBody) => request<Soul>(`/souls/${id}`, body("PUT", payload)),
  deleteSoul: (id: number) => request<void>(`/souls/${id}`, { method: "DELETE" }),

  listAgents: () => request<Agent[]>("/agents"),
  getAgent: (id: number) => request<Agent>(`/agents/${id}`),
  createAgent: (payload: JsonBody) => request<Agent>("/agents", body("POST", payload)),
  updateAgent: (id: number, payload: JsonBody) => request<Agent>(`/agents/${id}`, body("PUT", payload)),
  deleteAgent: (id: number) => request<void>(`/agents/${id}`, { method: "DELETE" }),
  listAgentTools: (agentId: number) => request<Tool[]>(`/agents/${agentId}/tools`),
  assignToolToAgent: (agentId: number, toolId: number) => request<void>(`/agents/${agentId}/tools/${toolId}`, { method: "POST" }),
  unassignToolFromAgent: (agentId: number, toolId: number) => request<void>(`/agents/${agentId}/tools/${toolId}`, { method: "DELETE" }),

  listContexts: (agentId: number) => request<AgentContext[]>(`/agents/${agentId}/contexts`),
  createContext: (agentId: number, payload: JsonBody) => request<AgentContext>(`/agents/${agentId}/contexts`, body("POST", payload)),
  updateContext: (agentId: number, contextId: number, payload: JsonBody) =>
    request<AgentContext>(`/agents/${agentId}/contexts/${contextId}`, body("PUT", payload)),
  deleteContext: (agentId: number, contextId: number) =>
    request<void>(`/agents/${agentId}/contexts/${contextId}`, { method: "DELETE" }),

  listMemories: (agentId: number) => request<AgentMemory[]>(`/agents/${agentId}/memories`),
  createMemory: (agentId: number, payload: JsonBody) => request<AgentMemory>(`/agents/${agentId}/memories`, body("POST", payload)),
  updateMemory: (agentId: number, memoryId: number, payload: JsonBody) =>
    request<AgentMemory>(`/agents/${agentId}/memories/${memoryId}`, body("PUT", payload)),
  deleteMemory: (agentId: number, memoryId: number) => request<void>(`/agents/${agentId}/memories/${memoryId}`, { method: "DELETE" }),

  listProposedMemories: (agentId: number) => request<ProposedMemory[]>(`/agents/${agentId}/proposed-memories`),
  approveProposedMemory: (agentId: number, memoryId: number) =>
    request<{ proposed_memory: ProposedMemory }>(`/agents/${agentId}/proposed-memories/${memoryId}/approve`, { method: "POST" }),
  rejectProposedMemory: (agentId: number, memoryId: number) =>
    request<{ proposed_memory: ProposedMemory }>(`/agents/${agentId}/proposed-memories/${memoryId}/reject`, { method: "POST" }),
  getProposedMemoryNotifications: () => request<ProposedMemoryNotificationSummary>("/proposed-memory-notifications"),

  listTools: () => request<Tool[]>("/tools"),
  getTool: (id: number) => request<Tool>(`/tools/${id}`),
  createTool: (payload: JsonBody) => request<Tool>("/tools", body("POST", payload)),
  updateTool: (id: number, payload: JsonBody) => request<Tool>(`/tools/${id}`, body("PUT", payload)),
  deleteTool: (id: number, force = false) => request<void>(`/tools/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),

  listWorkflows: () => request<Workflow[]>("/workflows"),
  getWorkflow: (id: number) => request<Workflow>(`/workflows/${id}`),
  createWorkflow: (payload: JsonBody) => request<Workflow>("/workflows", body("POST", payload)),
  updateWorkflow: (id: number, payload: JsonBody) => request<Workflow>(`/workflows/${id}`, body("PUT", payload)),
  deleteWorkflow: (id: number) => request<void>(`/workflows/${id}`, { method: "DELETE" }),
  runWorkflow: (id: number, task: string) => request<Run>(`/workflows/${id}/run`, body("POST", { task })),

  listExperiments: (includeArchived = false) => request<Experiment[]>(`/experiments${includeArchived ? "?include_archived=true" : ""}`),
  getExperiment: (id: number) => request<Experiment>(`/experiments/${id}`),
  createExperiment: (payload: JsonBody) => request<Experiment>("/experiments", body("POST", payload)),
  deleteExperiment: (id: number, force = false) => request<void>(`/experiments/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
  archiveExperiment: (id: number) => request<{ message: string }>(`/experiments/${id}/archive`, { method: "POST" }),
  activateExperiment: (id: number) => request<{ message: string }>(`/experiments/${id}/activate`, { method: "POST" }),
  runExperiment: (id: number) => request<ExperimentRun>(`/experiments/${id}/run`, { method: "POST" }),
  listExperimentRuns: (id: number) => request<ExperimentRun[]>(`/experiments/${id}/runs`),

  listRuns: (includeArchived = false) => request<Run[]>(`/runs${includeArchived ? "?include_archived=true" : ""}`),
  getRun: (id: number) => request<Run>(`/runs/${id}`),
  getRunTrace: (id: number) => request<TraceEvent[]>(`/runs/${id}/trace`),
  getRunMonitor: (id: number) => request<RunMonitor>(`/runs/${id}/monitor`),
  getCollaborationGraph: (id: number) => request<CollaborationGraph>(`/runs/${id}/collaboration-graph`),
  archiveRun: (id: number) => request<{ message: string }>(`/runs/${id}/archive`, { method: "POST" }),
  activateRun: (id: number) => request<{ message: string }>(`/runs/${id}/activate`, { method: "POST" }),
  hardDeleteRun: (id: number) => request<{ message: string }>(`/runs/${id}/hard-delete`, { method: "DELETE" }),

  createFeedback: (runId: number, agentId: number, payload: JsonBody) => request<AgentFeedback>(`/runs/${runId}/agents/${agentId}/feedback`, body("POST", payload)),
  reflectOnFeedback: (runId: number, agentId: number, payload: JsonBody) => request<ReflectionResponse>(`/runs/${runId}/agents/${agentId}/reflect`, body("POST", payload)),

  reviewAgentOutput: (runId: number, targetAgentId: number, payload: JsonBody) =>
    request<ReviewerEvaluationResponse>(`/runs/${runId}/agents/${targetAgentId}/review`, body("POST", payload)),

  seedDemo: () => request<DemoSeedResponse>("/demo/seed", body("POST", {})),
  cleanupDemo: () => request<DemoCleanupResponse>("/demo/seed", { method: "DELETE" }),

  cleanupLabData: () => request<AdminCleanupResponse>("/admin/cleanup-lab-data", body("POST", {}))
};
