import { RunTraceViewer } from "@/components/runs/RunTraceViewer";

export default function RunDetailPage({ params }: { params: { id: string } }) {
  return <RunTraceViewer runId={Number(params.id)} />;
}
