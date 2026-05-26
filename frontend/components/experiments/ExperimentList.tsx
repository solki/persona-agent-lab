"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Experiment } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function ExperimentList() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Experiment | null>(null);
  const [blockedMessage, setBlockedMessage] = useState("");

  function load() {
    api
      .listExperiments()
      .then(setExperiments)
      .catch(() => setError("Unable to reach the backend API. Start FastAPI to load experiments."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setBlockedMessage("");
    try {
      await api.deleteExperiment(deleteTarget.id);
      setDeleteTarget(null);
      setExperiments((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setBlockedMessage(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to delete experiment.");
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Experiments"
        description="Compare two or more isolated agents on the same task. Each agent receives only its own context and memory during comparison runs."
        actionHref="/experiments/new"
        actionLabel="New experiment"
      />

      {blockedMessage ? (
        <div className="mb-4 rounded border border-warning bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-warning">Delete blocked by dependencies</h2>
          <p className="mt-1 text-sm text-slate-700">{blockedMessage}</p>
          <button
            type="button"
            className="focus-ring mt-3 rounded border border-line bg-white px-4 py-2 text-sm font-medium"
            onClick={() => setBlockedMessage("")}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {loading ? <StatusMessage title="Loading" body="Loading experiments from the backend." /> : null}
      {error ? <StatusMessage title="Backend unavailable" body={error} /> : null}
      {!loading && !error && experiments.length === 0 ? (
        <StatusMessage title="No experiments" body="Create a comparison experiment with at least two agent ids." />
      ) : null}

      <div className="grid gap-3">
        {experiments.map((experiment) => (
          <div
            key={experiment.id}
            className="focus-ring rounded border border-line bg-white p-4 hover:border-accent"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link href={`/experiments/${experiment.id}`} className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-ink">{experiment.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{experiment.description || experiment.task_prompt}</p>
              </Link>
              <div className="flex items-center gap-2">
                <span className="rounded bg-panel px-2 py-1 text-xs text-slate-600">
                  {experiment.agent_ids.length} agents
                </span>
                <button
                  type="button"
                  className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm font-medium text-slate-600 hover:text-warning"
                  onClick={() => setDeleteTarget(experiment)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete experiment?"
        description={
          deleteTarget
            ? `Permanently delete "${deleteTarget.name}". This cannot be undone. If the experiment has been run, deletion will be blocked.`
            : ""
        }
        confirmLabel="Delete experiment"
        cancelLabel="Cancel"
        loading={deleting}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
