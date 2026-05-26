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
  llm_provider: "mock" | "openai_compatible" | "openai" | "anthropic" | "ollama";
  model: string;
  temperature: number;
  max_tokens: number;
  memory_policy: MemoryPolicy;
  context_policy: ContextPolicy;
  handoff_policy: HandoffPolicy;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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
  created_at?: string;
  updated_at?: string;
}

export interface Tool {
  id: number;
  name: string;
  description?: string | null;
  tool_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AgentContext {
  id: number;
  agent_id: number;
  title: string;
  context_type: string;
  content: string;
  priority: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AgentMemory {
  id: number;
  agent_id: number;
  memory_type: string;
  content: string;
  source?: string | null;
  importance: number;
  status: MemoryStatus;
  created_at?: string;
  updated_at?: string;
  last_accessed_at?: string | null;
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

export interface AgentEvaluation {
  id: number;
  run_id: number;
  agent_id: number;
  evaluator_type: string;
  scores: Record<string, number>;
  issues: Record<string, unknown>;
  recommendations: Record<string, unknown>;
  created_at: string;
}

export type ProposedMemoryStatus = "pending" | "approved" | "rejected";

export interface ProposedMemory {
  id: number;
  agent_id: number;
  source_feedback_id?: number | null;
  source_evaluation_id?: number | null;
  memory_type: string;
  content: string;
  importance: number;
  status: ProposedMemoryStatus;
  created_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
}

export interface ProposedMemoryApproval {
  proposed_memory: ProposedMemory;
  agent_memory: AgentMemory;
}

export interface ProposedMemoryRejection {
  proposed_memory: ProposedMemory;
}

export interface ReflectionResponse {
  run_id: number;
  agent_id: number;
  reflection: string;
  proposed_memory: ProposedMemory;
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

export interface TokenUsage {
  id: number;
  run_id: number;
  execution_id: number;
  agent_id: number;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  raw_usage: Record<string, unknown>;
  created_at: string;
}

export interface TokenUsageSummary {
  run_id: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  by_agent: Array<Record<string, unknown>>;
  items: TokenUsage[];
}

export interface LearningEvent {
  id: number;
  run_id?: number | null;
  agent_id: number;
  event_type: string;
  source_type?: string | null;
  source_id?: number | null;
  content?: string | null;
  status?: string | null;
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
  token_usage_summary: TokenUsageSummary;
  learning_event_summary: Record<string, unknown>;
  errors: Array<Record<string, unknown>>;
}

export interface AgentExecutionDetail {
  execution: AgentExecution;
  events: AgentExecutionEvent[];
  token_usage?: TokenUsage | null;
  assembled_context?: Record<string, unknown> | null;
  retrieved_memory?: Record<string, unknown> | null;
  tool_calls: AgentExecutionEvent[];
  learning_events: LearningEvent[];
}

export interface AgentEvolution {
  agent_id: number;
  memories: Array<Record<string, unknown>>;
  feedback: Array<Record<string, unknown>>;
  evaluations: Array<Record<string, unknown>>;
  proposed_memories: Array<Record<string, unknown>>;
  learning_events: LearningEvent[];
  executions: AgentExecution[];
  token_usage: TokenUsage[];
}

export interface AgentPerformanceSummary {
  agent_id: number;
  execution_count: number;
  completed_count: number;
  failed_count: number;
  average_elapsed_ms?: number | null;
  total_tokens: number;
  estimated_cost: number;
}

export type WorkflowType = "sequential" | "supervisor" | "handoff_swarm";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "archived";

export interface Workflow {
  id: number;
  name: string;
  description?: string | null;
  workflow_type: WorkflowType;
  graph_config: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

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
  created_at?: string;
  updated_at?: string;
}

export interface RunArchiveResponse {
  id: number;
  status: "archived";
  archived: boolean;
  archived_at: string;
  message: string;
}

export interface TraceEvent {
  id: number;
  run_id: number;
  event_type: string;
  agent_id?: number | null;
  payload: Record<string, unknown>;
  created_at?: string;
}

export interface Experiment {
  id: number;
  name: string;
  description?: string | null;
  task_prompt: string;
  agent_ids: number[];
  evaluation_config: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
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
