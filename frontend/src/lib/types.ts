export interface Soul {
  id: number;
  name: string;
  description?: string | null;
  principles?: string | null;
  decision_style?: string | null;
  collaboration_style?: string | null;
  failure_handling_style?: string | null;
  escalation_style?: string | null;
  is_active: boolean;
}

export interface Agent {
  id: number;
  name: string;
  description?: string | null;
  role: string;
  system_prompt: string;
  soul_id?: number | null;
  llm_provider: "mock" | "openai_compatible" | "openai" | "anthropic" | "ollama";
  model: string;
  temperature: number;
  max_tokens: number;
  memory_policy: Record<string, unknown>;
  context_policy: Record<string, unknown>;
  handoff_policy: Record<string, unknown>;
  is_active: boolean;
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

export type MemoryStatus = "active" | "pending" | "rejected" | "archived";

export interface AgentMemory {
  id: number;
  agent_id: number;
  memory_type: string;
  content: string;
  source?: string | null;
  importance: number;
  status: MemoryStatus;
}

export interface Experiment {
  id: number;
  name: string;
  description?: string | null;
  task_prompt: string;
  agent_ids: number[];
  evaluation_config: Record<string, unknown>;
  archived_at?: string | null;
}

export interface ExperimentRun {
  id: number;
  experiment_id: number;
  run_ids: number[];
  comparison_result?: Record<string, unknown> | null;
}

export interface ProposedMemory {
  id: number;
  agent_id: number;
  source_feedback_id?: number | null;
  source_evaluation_id?: number | null;
  source_type?: string | null;
  source_summary?: string | null;
  source_run_id?: number | null;
  memory_type: string;
  content: string;
  importance: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
}

export interface LearningEventSummary {
  feedback_count: number;
  evaluation_count: number;
  proposed_memory_count: number;
  learning_event_count: number;
}

export interface ProposedMemoryNotificationSummary {
  total_count: number;
  by_agent: Array<{ agent_id: number; count: number }>;
}

export interface Workflow {
  id: number;
  name: string;
  description?: string | null;
  workflow_type: string;
  graph_config: Record<string, unknown>;
  is_active: boolean;
}

export type RunStatus = "pending" | "running" | "completed" | "failed" | "archived";

export interface Run {
  id: number;
  workflow_id: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  status: RunStatus;
  config_snapshot: Record<string, unknown>;
  started_at?: string | null;
  ended_at?: string | null;
  archived_at?: string | null;
  created_at: string;
}

export interface TraceEvent {
  id: number;
  run_id: number;
  event_type: string;
  agent_id?: number | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AgentExecution {
  id: number;
  run_id: number;
  agent_id: number;
  agent_name_snapshot: string;
  status: string;
  sequence_index: number;
  started_at?: string | null;
  ended_at?: string | null;
  elapsed_ms?: number | null;
  input_payload: Record<string, unknown>;
  output_payload?: Record<string, unknown> | null;
  error_message?: string | null;
  provider: string;
  model: string;
  temperature: number;
  config_snapshot: Record<string, unknown>;
  created_at: string;
}

export interface AgentExecutionEvent {
  id: number;
  execution_id: number;
  run_id: number;
  agent_id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface RunMonitor {
  run_id: number;
  run_status: string;
  active_workflow_step?: number | null;
  active_agent_execution?: AgentExecution | null;
  agent_executions: AgentExecution[];
  latest_events: AgentExecutionEvent[];
  current_event_stream: AgentExecutionEvent[];
  started_at?: string | null;
  elapsed_ms?: number | null;
  token_usage_summary: {
    total_tokens: number;
    estimated_cost: number;
  };
  learning_event_summary: LearningEventSummary;
  errors: Array<Record<string, unknown>>;
}

export interface BlockingRun {
  run_id: number;
  status: string;
  workflow_name: string;
  created_at: string | null;
}

export interface AgentFeedback {
  id: number;
  run_id: number;
  agent_id: number;
  trace_event_id?: number | null;
  rating?: number | null;
  feedback_text: string;
  feedback_type: string;
  created_at: string;
}

export interface ReflectionResponse {
  run_id: number;
  agent_id: number;
  reflection: string;
  proposed_memory: ProposedMemory;
}
