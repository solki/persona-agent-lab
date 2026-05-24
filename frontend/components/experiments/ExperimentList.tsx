"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Experiment } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function ExperimentList() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listExperiments()
      .then(setExperiments)
      .catch(() => setError("Unable to reach the backend API. Start FastAPI to load experiments."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Experiments"
        description="Compare two or more isolated agents on the same task. Each agent receives only its own context and memory during comparison runs."
        actionHref="/experiments/new"
        actionLabel="New experiment"
      />
      {loading ? <StatusMessage title="Loading" body="Loading experiments from the backend." /> : null}
      {error ? <StatusMessage title="Backend unavailable" body={error} /> : null}
      {!loading && !error && experiments.length === 0 ? (
        <StatusMessage title="No experiments" body="Create a comparison experiment with at least two agent ids." />
      ) : null}
      <div className="grid gap-3">
        {experiments.map((experiment) => (
          <Link key={experiment.id} href={`/experiments/${experiment.id}`} className="focus-ring rounded border border-line bg-white p-4 hover:border-accent">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">{experiment.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{experiment.description || experiment.task_prompt}</p>
              </div>
              <span className="rounded bg-panel px-2 py-1 text-xs text-slate-600">{experiment.agent_ids.length} agents</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
