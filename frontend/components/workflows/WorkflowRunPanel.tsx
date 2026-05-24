"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Run, Workflow } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function WorkflowRunPanel({ workflowId }: { workflowId: number }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [task, setTask] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getWorkflow(workflowId).then(setWorkflow).catch(() => setError("Unable to load this workflow."));
  }, [workflowId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      setRun(await api.runWorkflow(workflowId, task));
    } catch {
      setError("Unable to run workflow. Sequential workflows require active agent ids in graph_config.agent_sequence.");
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
          <textarea className={inputClass} rows={5} value={task} onChange={(event) => setTask(event.target.value)} required />
        </Field>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
          Run workflow
        </button>
      </form>
      {run ? (
        <section className="mt-5 rounded border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Run {run.id}</h2>
              <p className="mt-1 text-sm text-slate-600">Status: {run.status}</p>
            </div>
            <Link className="focus-ring rounded bg-accent px-3 py-2 text-sm font-medium text-white" href={`/runs/${run.id}`}>
              View trace
            </Link>
          </div>
          <pre className="mt-4 max-h-80 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">
            {JSON.stringify(run.output, null, 2)}
          </pre>
        </section>
      ) : null}
    </>
  );
}
