import { WorkflowRunPanel } from "@/components/workflows/WorkflowRunPanel";

export default function RunWorkflowPage({ params }: { params: { id: string } }) {
  return <WorkflowRunPanel workflowId={Number(params.id)} />;
}
