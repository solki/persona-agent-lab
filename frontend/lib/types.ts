export type MemoryWriteMode = "off" | "manual_review" | "auto";
export type MemoryStatus = "active" | "pending" | "rejected" | "archived";

export interface MemoryPolicy {
  write_mode: MemoryWriteMode;
  retrieval_enabled: boolean;
}

export interface ContextPolicy {
  include_active_context: boolean;
}

export interface HandoffPolicy {
  allow_handoff: boolean;
  allowed_agent_ids: number[];
}

export interface Agent {
  id: number;
  name: string;
  description?: string | null;
  role: string;
  system_prompt: string;
  soul_id?: number | null;
  llm_provider: "mock" | "openai" | "anthropic" | "ollama";
  model: string;
  temperature: number;
  max_tokens: number;
  memory_policy: MemoryPolicy;
  context_policy: ContextPolicy;
  handoff_policy: HandoffPolicy;
  is_active: boolean;
}

export interface Soul {
  id: number;
  name: string;
  description?: string | null;
  principles?: string | null;
  decision_style?: string | null;
  collaboration_style?: string | null;
  failure_handling_style?: string | null;
  escalation_style?: string | null;
}

export interface Tool {
  id: number;
  name: string;
  description?: string | null;
  tool_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
}

export interface AgentContext {
  id: number;
  agent_id: number;
  title: string;
  context_type: string;
  content: string;
  priority: number;
  is_active: boolean;
}

export interface AgentMemory {
  id: number;
  agent_id: number;
  memory_type: string;
  content: string;
  source?: string | null;
  importance: number;
  status: MemoryStatus;
}

export type WorkflowType = "sequential" | "supervisor" | "handoff_swarm";
export type RunStatus = "pending" | "running" | "completed" | "failed";

export interface Workflow {
  id: number;
  name: string;
  description?: string | null;
  workflow_type: WorkflowType;
  graph_config: Record<string, unknown>;
  is_active: boolean;
}

export interface Run {
  id: number;
  workflow_id: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  status: RunStatus;
  config_snapshot: Record<string, unknown>;
}

export interface TraceEvent {
  id: number;
  run_id: number;
  event_type: string;
  agent_id?: number | null;
  payload: Record<string, unknown>;
}

export interface Experiment {
  id: number;
  name: string;
  description?: string | null;
  task_prompt: string;
  agent_ids: number[];
  evaluation_config: Record<string, unknown>;
}

export interface ExperimentAgentResult {
  agent_id: number;
  agent_name: string;
  run_id: number;
  trace_url: string;
  output: string;
}

export interface ExperimentRun {
  id: number;
  experiment_id: number;
  run_ids: number[];
  comparison_result?: {
    experiment_id: number;
    task_prompt: string;
    agent_results: ExperimentAgentResult[];
    evaluation_config: Record<string, unknown>;
  } | null;
}
