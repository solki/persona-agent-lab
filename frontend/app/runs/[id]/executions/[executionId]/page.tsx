import { AgentExecutionDetailView } from "@/components/runs/AgentExecutionDetailView";

export default function AgentExecutionDetailPage({ params }: { params: { id: string; executionId: string } }) {
  return <AgentExecutionDetailView runId={Number(params.id)} executionId={Number(params.executionId)} />;
}
