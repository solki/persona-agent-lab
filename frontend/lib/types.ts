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
