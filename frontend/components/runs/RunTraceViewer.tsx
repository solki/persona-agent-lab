"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Run, TraceEvent } from "@/lib/types";
import { JsonCollapsePanel } from "@/components/runs/JsonCollapsePanel";
import { RuntimeEventList } from "@/components/runs/RuntimeEventList";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { RunLearningPanel } from "@/components/runs/RunLearningPanel";

export function RunTraceViewer({ runId }: { runId: number }) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([api.getRun(runId), api.getRunTrace(runId)])
      .then(([runData, traceData]) => {
        setRun(runData);
        setEvents(traceData);
      })
      .catch(() => setError("Unable to load this run and trace."));
  }, [runId]);

  async function deleteRun() {
    if (!window.confirm(`Delete run ${runId}? This removes run-local records but keeps agents, workflows, tools, souls, contexts, and active memories.`)) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await api.deleteRun(runId);
      router.push("/runs");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this run.");
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Run Trace"
        description="Inspect the ordered runtime events, assembled context payloads, model outputs, and config snapshot for reproducibility."
      />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {run ? (
        <>
          <section className="mb-5 rounded border border-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Run {run.id}</h2>
              <div className="flex flex-wrap gap-2">
                <a className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href="/runs">
                  Back to Runs
                </a>
                <a className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}/monitor`}>
                  Monitor
                </a>
                <a className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}/executions`}>
                  Executions
                </a>
                <a className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}/token-usage`}>
                  Token Usage
                </a>
                <button
                  type="button"
                  className="focus-ring rounded border border-warning bg-white px-3 py-1 text-sm font-medium text-warning disabled:opacity-50"
                  disabled={deleting}
                  onClick={deleteRun}
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">Status: {run.status} · Workflow: {run.workflow_id}</p>
            <div className="mt-4 grid gap-3">
              <JsonCollapsePanel title="Run Input" value={run.input} defaultExpanded />
              <JsonCollapsePanel title="Run Output" value={run.output} defaultExpanded />
              <JsonCollapsePanel title="Config Snapshot" value={run.config_snapshot} />
            </div>
          </section>
          <RunLearningPanel run={run} />
        </>
      ) : null}
      <RuntimeEventList title="Trace Events" events={events} />
    </>
  );
}
