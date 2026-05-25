"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Workflow } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function WorkflowRunPanel({ workflowId }: { workflowId: number }) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [task, setTask] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.getWorkflow(workflowId).then(setWorkflow).catch(() => setError("Unable to load this workflow."));
  }, [workflowId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStarting(true);
    try {
      const run = await api.startWorkflowRun(workflowId, task);
      router.push(`/runs/${run.id}/monitor`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run workflow. Sequential workflows require active agents in graph_config.agent_sequence.");
      setStarting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Run Workflow"
        description="Run the selected workflow in mock LLM mode. Trace events and config snapshots are saved by the backend runtime."
      />
      {workflow ? (
        <div className="mb-4 rounded border border-line bg-white p-4">
          <h2 className="text-base font-semibold">{workflow.name}</h2>
          <p className="mt-2 text-sm text-slate-600">Type: {workflow.workflow_type}</p>
        </div>
      ) : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="grid gap-4 rounded border border-line bg-white p-5">
        <Field label="Task prompt">
          <textarea className={inputClass} disabled={starting} rows={5} value={task} onChange={(event) => setTask(event.target.value)} required />
        </Field>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={starting} type="submit">
          {starting ? "Starting monitor..." : "Run workflow"}
        </button>
      </form>
    </>
  );
}
