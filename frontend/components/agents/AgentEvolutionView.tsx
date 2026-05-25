"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentEvolution, AgentPerformanceSummary } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function AgentEvolutionView({ agentId }: { agentId: number }) {
  const [evolution, setEvolution] = useState<AgentEvolution | null>(null);
  const [summary, setSummary] = useState<AgentPerformanceSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getAgentEvolution(agentId), api.getAgentPerformanceSummary(agentId)])
      .then(([evolutionData, summaryData]) => {
        setEvolution(evolutionData);
        setSummary(summaryData);
      })
      .catch(() => setError("Unable to load agent evolution."));
  }, [agentId]);

  return (
    <>
      <PageHeader
        title="Agent Evolution"
        description="Inspect this agent's memory, feedback, evaluations, learning events, executions, and token trends without exposing other agents' private state."
      />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {summary ? (
        <section className="mb-5 grid gap-3 md:grid-cols-4">
          <Metric title="Executions" value={summary.execution_count} />
          <Metric title="Completed" value={summary.completed_count} />
          <Metric title="Failed" value={summary.failed_count} />
          <Metric title="Tokens" value={summary.total_tokens} />
        </section>
      ) : null}
      {evolution ? (
        <div className="grid gap-5">
          <JsonSection title="Learning Events" value={evolution.learning_events} />
          <JsonSection title="Memories" value={evolution.memories} />
          <JsonSection title="Feedback" value={evolution.feedback} />
          <JsonSection title="Evaluations" value={evolution.evaluations} />
          <JsonSection title="Proposed Memories" value={evolution.proposed_memories} />
          <JsonSection title="Executions" value={evolution.executions} />
          <JsonSection title="Token Usage" value={evolution.token_usage} />
        </div>
      ) : null}
    </>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded border border-line bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="rounded border border-line bg-white p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <pre className="mt-3 max-h-96 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}
