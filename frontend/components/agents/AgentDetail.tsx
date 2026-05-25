"use client";

import Link from "next/link";
import { AgentForm } from "@/components/agents/AgentForm";
import { AgentContextManager } from "@/components/agents/AgentContextManager";
import { AgentMemoryManager } from "@/components/agents/AgentMemoryManager";
import { AgentProposedMemoryManager } from "@/components/agents/AgentProposedMemoryManager";

export function AgentDetail({ agentId }: { agentId: number }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link className="focus-ring rounded border border-line bg-white px-3 py-2 text-sm font-medium" href={`/agents/${agentId}/evolution`}>
          View evolution
        </Link>
      </div>
      <AgentForm mode="edit" agentId={agentId} />
      <AgentContextManager agentId={agentId} />
      <AgentProposedMemoryManager agentId={agentId} />
      <AgentMemoryManager agentId={agentId} />
    </div>
  );
}
