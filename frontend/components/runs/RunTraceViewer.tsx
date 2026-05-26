"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Run, TraceEvent } from "@/lib/types";
import { JsonCollapsePanel } from "@/components/runs/JsonCollapsePanel";
import { RuntimeEventList } from "@/components/runs/RuntimeEventList";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { RunLearningPanel } from "@/components/runs/RunLearningPanel";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function RunTraceViewer({ runId }: { runId: number }) {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.getRun(runId), api.getRunTrace(runId)])
      .then(([runData, traceData]) => {
        setRun(runData);
        setEvents(traceData);
      })
      .catch(() => setError("Unable to load this run and trace."));
  }, [runId]);

  async function archiveRun() {
    setArchiving(true);
    setError("");
    setMessage("");
    try {
      const response = await api.archiveRun(runId);
      setRun((current) => (current ? { ...current, status: "archived", archived_at: response.archived_at } : current));
      setMessage(response.message);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive this run.");
    } finally {
      setArchiving(false);
      setConfirmArchiveOpen(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Run Trace"
        description="Inspect the ordered runtime events, assembled context payloads, model outputs, and config snapshot for reproducibility."
      />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {message ? <StatusMessage title="Archived" body={message} /> : null}
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
                  disabled={archiving || run.status === "archived"}
                  onClick={() => setConfirmArchiveOpen(true)}
                >
                  {run.status === "archived" ? "Archived" : archiving ? "Archiving..." : "Archive"}
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Status: {run.status}
              {run.archived_at ? ` · Archived: ${new Date(run.archived_at).toLocaleString()}` : ""} · Workflow: {run.workflow_id}
            </p>
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
      <ConfirmDialog
        open={confirmArchiveOpen}
        title="Archive run?"
        description="This will hide the run from the default Runs list but preserve trace, feedback, proposed memories, and learning history. Agent definitions and approved memories will not be deleted."
        confirmLabel="Archive run"
        loading={archiving}
        onCancel={() => setConfirmArchiveOpen(false)}
        onConfirm={archiveRun}
      />
    </>
  );
}
