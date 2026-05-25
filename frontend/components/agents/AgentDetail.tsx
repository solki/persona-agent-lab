"use client";

import { AgentForm } from "@/components/agents/AgentForm";
import { AgentContextManager } from "@/components/agents/AgentContextManager";
import { AgentMemoryManager } from "@/components/agents/AgentMemoryManager";
import { AgentProposedMemoryManager } from "@/components/agents/AgentProposedMemoryManager";

export function AgentDetail({ agentId }: { agentId: number }) {
  return (
    <div className="space-y-6">
      <AgentForm mode="edit" agentId={agentId} />
      <AgentContextManager agentId={agentId} />
      <AgentProposedMemoryManager agentId={agentId} />
      <AgentMemoryManager agentId={agentId} />
    </div>
  );
}
