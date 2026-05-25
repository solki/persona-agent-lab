"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Run, TraceEvent } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { RunLearningPanel } from "@/components/runs/RunLearningPanel";

export function RunTraceViewer({ runId }: { runId: number }) {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getRun(runId), api.getRunTrace(runId)])
      .then(([runData, traceData]) => {
        setRun(runData);
        setEvents(traceData);
      })
      .catch(() => setError("Unable to load this run and trace."));
  }, [runId]);

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
                <a className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}/monitor`}>
                  Monitor
                </a>
                <a className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}/executions`}>
                  Executions
                </a>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">Status: {run.status} · Workflow: {run.workflow_id}</p>
            <h3 className="mt-4 text-sm font-semibold">Run Input</h3>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">
              {JSON.stringify(run.input, null, 2)}
            </pre>
            <h3 className="mt-4 text-sm font-semibold">Run Output</h3>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">
              {JSON.stringify(run.output, null, 2)}
            </pre>
            <h3 className="mt-4 text-sm font-semibold">Config Snapshot</h3>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">
              {JSON.stringify(run.config_snapshot, null, 2)}
            </pre>
          </section>
          <RunLearningPanel run={run} />
        </>
      ) : null}
      <section className="grid gap-3">
        <h2 className="text-base font-semibold">Trace Events</h2>
        {events.map((event) => (
          <article key={event.id} className="rounded border border-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{event.event_type}</h2>
              <span className="rounded bg-panel px-2 py-1 text-xs text-slate-600">
                Event {event.id}{event.agent_id ? ` · Agent ${event.agent_id}` : ""}
              </span>
            </div>
            <pre className="mt-3 max-h-80 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </article>
        ))}
      </section>
    </>
  );
}
