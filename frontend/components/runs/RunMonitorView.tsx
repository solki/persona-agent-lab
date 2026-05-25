"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Clock, Cpu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { RunMonitor } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function RunMonitorView({ runId }: { runId: number }) {
  const [monitor, setMonitor] = useState<RunMonitor | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await api.getRunMonitor(runId);
        if (active) {
          setMonitor(data);
          setError("");
        }
      } catch {
        if (active) {
          setError("Unable to load run monitor.");
        }
      }
    }
    void load();
    const interval = window.setInterval(load, 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [runId]);

  const latestOutput = useMemo(() => {
    const completed = [...(monitor?.agent_executions ?? [])].reverse().find((execution) => execution.output_payload);
    return completed?.output_payload ?? null;
  }, [monitor]);

  return (
    <>
      <PageHeader
        title="Run Monitor"
        description="Poll live run state, agent execution progress, runtime events, token usage, and learning activity."
      />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {!monitor && !error ? <StatusMessage title="Loading" body="Loading live run monitor." /> : null}
      {monitor ? (
        <div className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-4">
            <Metric title="Status" value={monitor.run_status} icon={Activity} />
            <Metric title="Active agent" value={monitor.active_agent_execution?.agent_name_snapshot ?? "None"} icon={Cpu} />
            <Metric title="Elapsed" value={monitor.elapsed_ms ? `${monitor.elapsed_ms} ms` : "Not started"} icon={Clock} />
            <Metric title="Tokens" value={String(monitor.token_usage_summary.total_tokens)} icon={Cpu} />
          </section>

          {monitor.errors.length > 0 ? (
            <section className="rounded border border-line bg-white p-5">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle size={18} />
                <h2 className="text-base font-semibold">Errors</h2>
              </div>
              <pre className="mt-3 overflow-auto rounded bg-panel p-3 text-xs">{JSON.stringify(monitor.errors, null, 2)}</pre>
            </section>
          ) : null}

          <section className="rounded border border-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Agent Status</h2>
              <div className="flex flex-wrap gap-2">
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}`}>
                  View trace
                </Link>
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}/executions`}>
                  View executions
                </Link>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {monitor.agent_executions.length === 0 ? (
                <p className="text-sm text-slate-600">Waiting for agent executions to be queued.</p>
              ) : null}
              {monitor.agent_executions.map((execution) => (
                <Link
                  key={execution.id}
                  href={`/runs/${runId}/executions/${execution.id}`}
                  className="focus-ring rounded border border-line bg-panel p-3 text-sm hover:border-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong>{execution.agent_name_snapshot}</strong>
                    <span className="rounded bg-white px-2 py-1 text-xs text-slate-600">{execution.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Step {execution.sequence_index + 1} · {execution.elapsed_ms ?? 0} ms · {execution.model}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded border border-line bg-white p-5">
              <h2 className="text-base font-semibold">Event Timeline</h2>
              <div className="mt-4 grid gap-2">
                {monitor.latest_events.map((event) => (
                  <div key={event.id} className="rounded bg-panel p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{event.event_type}</strong>
                      <span className="text-xs text-slate-500">Agent {event.agent_id}</span>
                    </div>
                    <pre className="mt-2 max-h-28 overflow-auto text-xs text-slate-600">{JSON.stringify(event.payload, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border border-line bg-white p-5">
              <h2 className="text-base font-semibold">Latest Output</h2>
              <pre className="mt-4 max-h-96 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">
                {JSON.stringify(latestOutput, null, 2)}
              </pre>
              <h2 className="mt-5 text-base font-semibold">Learning Summary</h2>
              <pre className="mt-3 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">
                {JSON.stringify(monitor.learning_event_summary, null, 2)}
              </pre>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Activity }) {
  return (
    <div className="rounded border border-line bg-white p-4">
      <Icon size={18} className="text-accent" />
      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 break-words text-base font-semibold">{value}</p>
    </div>
  );
}
