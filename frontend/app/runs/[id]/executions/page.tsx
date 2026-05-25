import { RunExecutionsView } from "@/components/runs/RunExecutionsView";

export default function RunExecutionsPage({ params }: { params: { id: string } }) {
  return <RunExecutionsView runId={Number(params.id)} />;
}
