"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentExecution } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function RunExecutionsView({ runId }: { runId: number }) {
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listRunExecutions(runId).then(setExecutions).catch(() => setError("Unable to load agent executions."));
  }, [runId]);

  return (
    <>
      <PageHeader title="Agent Executions" description="Inspect each agent step persisted for this workflow run." />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <div className="grid gap-3">
        {executions.map((execution) => (
          <Link
            key={execution.id}
            href={`/runs/${runId}/executions/${execution.id}`}
            className="focus-ring rounded border border-line bg-white p-4 hover:border-accent"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{execution.agent_name_snapshot}</h2>
              <span className="rounded bg-panel px-2 py-1 text-xs text-slate-600">{execution.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Step {execution.sequence_index + 1} · Agent {execution.agent_id} · {execution.provider}:{execution.model}
            </p>
            <p className="mt-2 text-xs text-slate-500">Elapsed: {execution.elapsed_ms ?? 0} ms</p>
          </Link>
        ))}
      </div>
    </>
  );
}
