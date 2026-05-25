import { RunTokenUsageView } from "@/components/runs/RunTokenUsageView";

export default function RunTokenUsagePage({ params }: { params: { id: string } }) {
  return <RunTokenUsageView runId={Number(params.id)} />;
}
