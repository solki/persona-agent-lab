"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TokenUsageSummary } from "@/lib/types";
import { JsonCollapsePanel } from "@/components/runs/JsonCollapsePanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function RunTokenUsageView({ runId }: { runId: number }) {
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getRunTokenUsage(runId)
      .then(setSummary)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load token usage."));
  }, [runId]);

  return (
    <>
      <PageHeader title="Token Usage" description="Review token counts and provider usage records for this run." />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href="/runs">
          Back to Runs
        </Link>
        <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}`}>
          Run Detail
        </Link>
        <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}/monitor`}>
          Monitor
        </Link>
        <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}/executions`}>
          Executions
        </Link>
      </div>
      {summary ? (
        <div className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-4">
            <Metric title="Prompt Tokens" value={String(summary.total_prompt_tokens)} />
            <Metric title="Completion Tokens" value={String(summary.total_completion_tokens)} />
            <Metric title="Total Tokens" value={String(summary.total_tokens)} />
            <Metric title="Estimated Cost" value={`$${summary.estimated_cost.toFixed(4)}`} />
          </section>
          <JsonCollapsePanel title="Usage By Agent" value={summary.by_agent} defaultExpanded />
          <section className="rounded border border-line bg-white p-5">
            <h2 className="text-base font-semibold">Usage Items</h2>
            <div className="mt-4 grid gap-3">
              {summary.items.length === 0 ? <p className="text-sm text-slate-500">No token usage has been recorded for this run.</p> : null}
              {summary.items.map((item) => (
                <JsonCollapsePanel
                  key={item.id}
                  title={`Agent ${item.agent_id} · ${item.provider}:${item.model}`}
                  meta={`${item.total_tokens} tokens`}
                  value={item}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 break-words text-lg font-semibold">{value}</p>
    </div>
  );
}
