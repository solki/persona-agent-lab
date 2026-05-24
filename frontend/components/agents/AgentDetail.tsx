"use client";

import { AgentForm } from "@/components/agents/AgentForm";
import { AgentContextManager } from "@/components/agents/AgentContextManager";
import { AgentMemoryManager } from "@/components/agents/AgentMemoryManager";

export function AgentDetail({ agentId }: { agentId: number }) {
  return (
    <div className="space-y-6">
      <AgentForm mode="edit" agentId={agentId} />
      <AgentContextManager agentId={agentId} />
      <AgentMemoryManager agentId={agentId} />
    </div>
  );
}
