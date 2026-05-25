"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Clock, Cpu, Database, Network } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Run, RunMonitor, Workflow } from "@/lib/types";
import { JsonCollapsePanel } from "@/components/runs/JsonCollapsePanel";
import { RuntimeEventList } from "@/components/runs/RuntimeEventList";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function RunMonitorView({ runId }: { runId: number }) {
  const [monitor, setMonitor] = useState<RunMonitor | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
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

  useEffect(() => {
    let active = true;
    async function loadRunMetadata() {
      try {
        const runData = await api.getRun(runId);
        if (!active) {
          return;
        }
        setRun(runData);
        try {
          setWorkflow(await api.getWorkflow(runData.workflow_id));
        } catch {
          setWorkflow(null);
        }
      } catch {
        if (active) {
          setError("Unable to load run metadata.");
        }
      }
    }
    void loadRunMetadata();
    return () => {
      active = false;
    };
  }, [runId]);

  const latestOutput = useMemo(() => {
    const completed = [...(monitor?.agent_executions ?? [])].reverse().find((execution) => execution.output_payload);
    return completed?.output_payload ?? null;
  }, [monitor]);

  const agentNames = useMemo(
    () =>
      Object.fromEntries((monitor?.agent_executions ?? []).map((execution) => [execution.agent_id, execution.agent_name_snapshot])),
    [monitor]
  );
  const learningCount = Number(monitor?.learning_event_summary.learning_event_count ?? 0);
  const errorCount = monitor?.errors.length ?? 0;

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
          <section className="rounded border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Run {monitor.run_id}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {workflow?.name ?? `Workflow ${run?.workflow_id ?? "unknown"}`} · {monitor.run_status}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}`}>
                  Run Detail
                </Link>
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}`}>
                  Trace Events
                </Link>
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}/executions`}>
                  Executions
                </Link>
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}/token-usage`}>
                  Token Usage
                </Link>
                {run ? (
                  <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/workflows/${run.workflow_id}`}>
                    Workflow
                  </Link>
                ) : null}
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href="/runs">
                  All Runs
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <Metric title="Run ID" value={String(monitor.run_id)} icon={Database} />
            <Metric title="Status" value={monitor.run_status} icon={Activity} />
            <Metric title="Active agent" value={monitor.active_agent_execution?.agent_name_snapshot ?? "None"} icon={Cpu} />
            <Metric title="Elapsed" value={monitor.elapsed_ms ? `${monitor.elapsed_ms} ms` : "Not started"} icon={Clock} />
            <Metric title="Tokens" value={String(monitor.token_usage_summary.total_tokens)} icon={Cpu} />
            <Metric title="Agents" value={String(monitor.agent_executions.length)} icon={Cpu} />
            <Metric title="Events" value={String(monitor.latest_events.length)} icon={Network} />
            <Metric title="Learning Events" value={String(learningCount)} icon={Activity} />
            <Metric title="Errors" value={String(errorCount)} icon={AlertTriangle} />
            <Metric title="Started" value={monitor.started_at ? formatDate(monitor.started_at) : "Not started"} icon={Clock} />
            <Metric title="Ended" value={run?.ended_at ? formatDate(run.ended_at) : "Not ended"} icon={Clock} />
            <Metric title="Workflow" value={workflow?.name ?? (run ? `Workflow ${run.workflow_id}` : "Unknown")} icon={Network} />
          </section>

          {monitor.errors.length > 0 ? (
            <section className="rounded border border-warning bg-white p-5">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle size={18} />
                <h2 className="text-base font-semibold">Errors</h2>
              </div>
              <div className="mt-3">
                <JsonCollapsePanel title="Error Payloads" value={monitor.errors} />
              </div>
            </section>
          ) : null}

          <section className="rounded border border-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Agent Status</h2>
              <div className="flex flex-wrap gap-2">
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}`}>
                  Trace
                </Link>
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}/executions`}>
                  Executions
                </Link>
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}/token-usage`}>
                  Token Usage
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

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <RuntimeEventList events={monitor.latest_events} agentNames={agentNames} />
            <div className="rounded border border-line bg-white p-5">
              <h2 className="text-base font-semibold">Latest Output</h2>
              <div className="mt-4">
                <JsonCollapsePanel title="Output Payload" value={latestOutput} defaultExpanded />
              </div>
              <h2 className="mt-5 text-base font-semibold">Learning Summary</h2>
              <div className="mt-3">
                <JsonCollapsePanel title="Learning Event Counts" value={monitor.learning_event_summary} />
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Activity }) {
  return (
    <div className="min-w-0 rounded border border-line bg-white p-4">
      <Icon size={18} className="text-accent" />
      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 break-words text-base font-semibold">{value}</p>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
