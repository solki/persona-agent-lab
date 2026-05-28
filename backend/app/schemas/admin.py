from pydantic import BaseModel


class AdminCleanupResponse(BaseModel):
    deleted_feedback: int
    deleted_evaluations: int
    deleted_proposed_memories: int
    deleted_learning_events: int
    deleted_memories: int
    deleted_contexts: int
    deleted_agent_tool_assignments: int
    deleted_trace_events: int
    deleted_agent_execution_events: int
    deleted_token_usage: int
    deleted_agent_executions: int
    deleted_runs: int
    deleted_experiment_runs: int
    deleted_experiments: int
    deleted_workflows: int
    deleted_tools: int
    deleted_agents: int
    deleted_souls: int
