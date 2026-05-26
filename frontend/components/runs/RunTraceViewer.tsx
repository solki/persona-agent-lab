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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function RunTraceViewer({ runId }: { runId: number }) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [blockedDeleteWarning, setBlockedDeleteWarning] = useState("");
  const [message, setMessage] = useState("");
  const [mutating, setMutating] = useState(false);
  const [confirmLifecycleOpen, setConfirmLifecycleOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.getRun(runId), api.getRunTrace(runId)])
      .then(([runData, traceData]) => {
        setRun(runData);
        setEvents(traceData);
      })
      .catch(() => setError("Unable to load this run and trace."));
  }, [runId]);

  async function runLifecycleAction() {
    if (!run) {
      return;
    }
    const activating = run.status === "archived";
    setMutating(true);
    setError("");
    setWarning("");
    setMessage("");
    try {
      const response = activating ? await api.activateRun(runId) : await api.archiveRun(runId);
      setRun((current) =>
        current ? { ...current, status: activating ? "completed" : "archived", archived_at: response.archived_at ?? null } : current
      );
      setMessage(response.message);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : `Unable to ${activating ? "activate" : "archive"} this run.`);
    } finally {
      setMutating(false);
      setConfirmLifecycleOpen(false);
    }
  }

  async function hardDeleteRun() {
    setMutating(true);
    setError("");
    setWarning("");
    setMessage("");
    try {
      await api.hardDeleteRun(runId);
      router.push("/runs");
    } catch (deleteError) {
      const warningMessage = deleteError instanceof Error ? deleteError.message : "This run cannot be permanently deleted. Keep it archived to preserve history.";
      setWarning(warningMessage);
      setBlockedDeleteWarning(warningMessage);
    } finally {
      setMutating(false);
      setConfirmDeleteOpen(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Run Trace"
        description="Inspect the ordered runtime events, assembled context payloads, model outputs, and config snapshot for reproducibility."
      />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {warning ? <StatusMessage title="Warning" body={warning} /> : null}
      {message ? <StatusMessage title="Success" body={message} /> : null}
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
                  className={`focus-ring rounded border bg-white px-3 py-1 text-sm font-medium disabled:opacity-50 ${
                    run.status === "archived" ? "border-accent text-accent" : "border-warning text-warning"
                  }`}
                  disabled={mutating}
                  onClick={() => setConfirmLifecycleOpen(true)}
                >
                  {run.status === "archived" ? "Activate" : mutating ? "Working..." : "Archive"}
                </button>
                {run.status === "archived" ? (
                  <button
                    type="button"
                    className="focus-ring rounded border border-warning bg-white px-3 py-1 text-sm font-medium text-warning disabled:opacity-50"
                    disabled={mutating}
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    Delete
                  </button>
                ) : null}
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
        open={confirmLifecycleOpen}
        title={run?.status === "archived" ? "Activate run?" : "Archive run?"}
        description={
          run?.status === "archived"
            ? "This will return the run to the default Active runs list. Trace, feedback, proposed memories, approved memories, and learning history will be preserved."
            : "This will hide the run from the default Runs list but preserve trace, feedback, proposed memories, and learning history. Agent definitions and approved memories will not be deleted."
        }
        confirmLabel={run?.status === "archived" ? "Activate run" : "Archive run"}
        loading={mutating}
        onCancel={() => setConfirmLifecycleOpen(false)}
        onConfirm={runLifecycleAction}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete archived run permanently?"
        description="This permanently deletes the archived run only if the backend confirms it has no learning or experiment history. If the safety check fails, the run will remain archived and a warning will be shown."
        confirmLabel="Delete permanently"
        loading={mutating}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={hardDeleteRun}
      />
      <ConfirmDialog
        open={Boolean(blockedDeleteWarning)}
        title="Delete blocked by safety check"
        description={blockedDeleteWarning}
        confirmLabel="Keep archived"
        cancelLabel="Close"
        variant="warning"
        onCancel={() => setBlockedDeleteWarning("")}
        onConfirm={() => setBlockedDeleteWarning("")}
      />
    </>
  );
}
