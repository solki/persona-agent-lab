import type {
  Agent,
  AgentContext,
  AgentMemory,
  Experiment,
  ExperimentRun,
  Run,
  Soul,
  Tool,
  TraceEvent,
  Workflow
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type JsonBody = Record<string, unknown>;

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
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
    throw new ApiError(`Request failed: ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function jsonOptions(method: string, body: JsonBody): RequestInit {
  return { method, body: JSON.stringify(body) };
}

export const api = {
  listAgents: () => request<Agent[]>("/agents"),
  getAgent: (id: number) => request<Agent>(`/agents/${id}`),
  createAgent: (body: JsonBody) => request<Agent>("/agents", jsonOptions("POST", body)),
  updateAgent: (id: number, body: JsonBody) => request<Agent>(`/agents/${id}`, jsonOptions("PUT", body)),
  deleteAgent: (id: number) => request<void>(`/agents/${id}`, { method: "DELETE" }),

  listSouls: () => request<Soul[]>("/souls"),
  getSoul: (id: number) => request<Soul>(`/souls/${id}`),
  createSoul: (body: JsonBody) => request<Soul>("/souls", jsonOptions("POST", body)),
  updateSoul: (id: number, body: JsonBody) => request<Soul>(`/souls/${id}`, jsonOptions("PUT", body)),

  listTools: () => request<Tool[]>("/tools"),
  createTool: (body: JsonBody) => request<Tool>("/tools", jsonOptions("POST", body)),
  updateTool: (id: number, body: JsonBody) => request<Tool>(`/tools/${id}`, jsonOptions("PUT", body)),
  deleteTool: (id: number) => request<void>(`/tools/${id}`, { method: "DELETE" }),
  listAgentTools: (agentId: number) => request<Tool[]>(`/agents/${agentId}/tools`),
  assignTool: (agentId: number, toolId: number) =>
    request<void>(`/agents/${agentId}/tools/${toolId}`, { method: "POST" }),
  removeTool: (agentId: number, toolId: number) =>
    request<void>(`/agents/${agentId}/tools/${toolId}`, { method: "DELETE" }),

  listContexts: (agentId: number) => request<AgentContext[]>(`/agents/${agentId}/contexts`),
  createContext: (agentId: number, body: JsonBody) =>
    request<AgentContext>(`/agents/${agentId}/contexts`, jsonOptions("POST", body)),
  updateContext: (agentId: number, contextId: number, body: JsonBody) =>
    request<AgentContext>(`/agents/${agentId}/contexts/${contextId}`, jsonOptions("PUT", body)),
  deleteContext: (agentId: number, contextId: number) =>
    request<void>(`/agents/${agentId}/contexts/${contextId}`, { method: "DELETE" }),

  listMemories: (agentId: number) => request<AgentMemory[]>(`/agents/${agentId}/memories`),
  createMemory: (agentId: number, body: JsonBody) =>
    request<AgentMemory>(`/agents/${agentId}/memories`, jsonOptions("POST", body)),
  approveMemory: (agentId: number, memoryId: number) =>
    request<AgentMemory>(`/agents/${agentId}/memories/${memoryId}/approve`, { method: "POST" }),
  rejectMemory: (agentId: number, memoryId: number) =>
    request<AgentMemory>(`/agents/${agentId}/memories/${memoryId}/reject`, { method: "POST" }),

  listWorkflows: () => request<Workflow[]>("/workflows"),
  getWorkflow: (id: number) => request<Workflow>(`/workflows/${id}`),
  createWorkflow: (body: JsonBody) => request<Workflow>("/workflows", jsonOptions("POST", body)),
  updateWorkflow: (id: number, body: JsonBody) => request<Workflow>(`/workflows/${id}`, jsonOptions("PUT", body)),
  deleteWorkflow: (id: number) => request<void>(`/workflows/${id}`, { method: "DELETE" }),
  runWorkflow: (id: number, task: string) => request<Run>(`/workflows/${id}/run`, jsonOptions("POST", { task })),

  listRuns: () => request<Run[]>("/runs"),
  getRun: (id: number) => request<Run>(`/runs/${id}`),
  getRunTrace: (id: number) => request<TraceEvent[]>(`/runs/${id}/trace`),

  listExperiments: () => request<Experiment[]>("/experiments"),
  getExperiment: (id: number) => request<Experiment>(`/experiments/${id}`),
  createExperiment: (body: JsonBody) => request<Experiment>("/experiments", jsonOptions("POST", body)),
  runExperiment: (id: number) => request<ExperimentRun>(`/experiments/${id}/run`, { method: "POST" })
};
