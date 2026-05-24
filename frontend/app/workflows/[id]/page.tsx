import { WorkflowForm } from "@/components/workflows/WorkflowForm";

export default function WorkflowDetailPage({ params }: { params: { id: string } }) {
  return <WorkflowForm mode="edit" workflowId={Number(params.id)} />;
}
