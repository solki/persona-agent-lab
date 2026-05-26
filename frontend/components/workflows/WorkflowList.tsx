"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Workflow } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function WorkflowList() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Workflow | null>(null);

  useEffect(() => {
    api
      .listWorkflows()
      .then(setWorkflows)
      .catch(() => setError("Unable to reach the backend API. Start FastAPI to load workflows."))
      .finally(() => setLoading(false));
  }, []);

  async function deleteWorkflow() {
    if (!pendingDelete) {
      return;
    }
    const workflow = pendingDelete;
    setDeletingId(workflow.id);
    setError("");
    setMessage("");
    try {
      await api.deleteWorkflow(workflow.id);
      setWorkflows((current) => current.filter((item) => item.id !== workflow.id));
      setMessage("Workflow deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete workflow.");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Compose agents separately from their definitions. The MVP runner executes sequential workflows with mock LLM responses and full trace logging."
        actionHref="/workflows/new"
        actionLabel="New workflow"
      />
      {loading ? <StatusMessage title="Loading" body="Loading workflows from the backend." /> : null}
      {message ? <StatusMessage title="Saved" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {!loading && !error && workflows.length === 0 ? (
        <StatusMessage title="No workflows" body="Create a sequential workflow by selecting agents in execution order." />
      ) : null}
      <div className="grid gap-3">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="rounded border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">{workflow.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{workflow.description || "No description yet."}</p>
              </div>
              <span className="rounded bg-panel px-2 py-1 text-xs text-slate-600">{workflow.workflow_type}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/workflows/${workflow.id}`}>
                Edit
              </Link>
              <Link className="focus-ring rounded bg-accent px-3 py-1 text-sm font-medium text-white" href={`/workflows/${workflow.id}/run`}>
                Run
              </Link>
              <button
                className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm font-medium text-red-700 disabled:opacity-60"
                disabled={deletingId === workflow.id}
                onClick={() => setPendingDelete(workflow)}
                type="button"
              >
                {deletingId === workflow.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete workflow?"
        description={`Delete "${pendingDelete?.name ?? "this workflow"}"? Existing runs must be deleted first, otherwise the backend will block the delete.`}
        confirmLabel="Delete workflow"
        loading={deletingId !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteWorkflow}
      />
    </>
  );
}
