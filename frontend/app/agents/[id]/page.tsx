import { AgentDetail } from "@/components/agents/AgentDetail";

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  return <AgentDetail agentId={Number(params.id)} />;
}
