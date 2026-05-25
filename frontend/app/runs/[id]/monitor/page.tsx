import { RunMonitorView } from "@/components/runs/RunMonitorView";

export default function RunMonitorPage({ params }: { params: { id: string } }) {
  return <RunMonitorView runId={Number(params.id)} />;
}
