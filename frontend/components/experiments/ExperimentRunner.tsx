"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Experiment, ExperimentRun } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function ExperimentRunner({ experimentId }: { experimentId: number }) {
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [experimentRun, setExperimentRun] = useState<ExperimentRun | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getExperiment(experimentId).then(setExperiment).catch(() => setError("Unable to load this experiment."));
  }, [experimentId]);

  async function run() {
    setError("");
    try {
      setExperimentRun(await api.runExperiment(experimentId));
    } catch {
      setError("Unable to run this experiment. Check that all selected agents exist and are active.");
    }
  }

  const results = experimentRun?.comparison_result?.agent_results ?? [];

  return (
    <>
      <PageHeader
        title="Experiment"
        description="Run the same task against each selected agent and compare outputs with trace links for reproducibility."
      />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {experiment ? (
        <section className="mb-5 rounded border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">{experiment.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{experiment.description}</p>
              <p className="mt-3 text-sm text-slate-700">{experiment.task_prompt}</p>
              <p className="mt-3 text-xs text-slate-500">Agents: {experiment.agent_ids.join(", ")}</p>
            </div>
            <button className="focus-ring rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="button" onClick={run}>
              Run experiment
            </button>
          </div>
        </section>
      ) : null}
      {results.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {results.map((result) => (
            <article key={result.run_id} className="rounded border border-line bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{result.agent_name}</h2>
                <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${result.run_id}`}>
                  Trace
                </Link>
              </div>
              <p className="mt-2 text-xs text-slate-500">Agent {result.agent_id} · Run {result.run_id}</p>
              <pre className="mt-4 whitespace-pre-wrap rounded bg-panel p-3 text-sm text-slate-700">{result.output}</pre>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
