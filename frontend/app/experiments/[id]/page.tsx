import { ExperimentRunner } from "@/components/experiments/ExperimentRunner";

export default function ExperimentDetailPage({ params }: { params: { id: string } }) {
  return <ExperimentRunner experimentId={Number(params.id)} />;
}
