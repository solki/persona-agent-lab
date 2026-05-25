import { AgentEvolutionView } from "@/components/agents/AgentEvolutionView";

export default function AgentEvolutionPage({ params }: { params: { id: string } }) {
  return <AgentEvolutionView agentId={Number(params.id)} />;
}
