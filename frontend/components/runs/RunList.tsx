"use client";

import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Run, RunStatus, Workflow } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

type StatusFilter = "all" | RunStatus;
type SortOrder = "newest" | "oldest";

export function RunList() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadRuns();
  }, []);

  async function loadRuns() {
    setLoading(true);
    setError("");
    try {
      const [runData, workflowData] = await Promise.all([api.listRuns(), api.listWorkflows()]);
      setRuns(runData);
      setWorkflows(workflowData);
      setSelectedIds(new Set());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load runs.");
    } finally {
      setLoading(false);
    }
  }

  const workflowNames = useMemo(() => Object.fromEntries(workflows.map((workflow) => [workflow.id, workflow.name])), [workflows]);

  const filteredRuns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return runs
      .filter((run) => statusFilter === "all" || run.status === statusFilter)
      .filter((run) => workflowFilter === "all" || String(run.workflow_id) === workflowFilter)
      .filter((run) => {
        if (!query) {
          return true;
        }
        return (
          String(run.id).includes(query) ||
          (workflowNames[run.workflow_id] ?? "").toLowerCase().includes(query) ||
          JSON.stringify(run.input).toLowerCase().includes(query)
        );
      })
      .sort((first, second) => (sortOrder === "newest" ? second.id - first.id : first.id - second.id));
  }, [runs, search, sortOrder, statusFilter, workflowFilter, workflowNames]);

  async function deleteRun(runId: number) {
    if (!window.confirm(`Delete run ${runId}? This removes run-local trace, execution, token, feedback, and learning records.`)) {
      return;
    }
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      await api.deleteRun(runId);
      setRuns((current) => current.filter((run) => run.id !== runId));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(runId);
        return next;
      });
      setMessage(`Deleted run ${runId}.`);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  async function deleteSelectedRuns() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      return;
    }
    if (!window.confirm(`Delete ${ids.length} selected run${ids.length === 1 ? "" : "s"}? Agent and workflow configuration will be kept.`)) {
      return;
    }
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      for (const id of ids) {
        await api.deleteRun(id);
      }
      setRuns((current) => current.filter((run) => !selectedIds.has(run.id)));
      setSelectedIds(new Set());
      setMessage(`Deleted ${ids.length} selected run${ids.length === 1 ? "" : "s"}.`);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      await loadRuns();
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelected(runId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Runs"
        description="Inspect workflow runs, monitor agent execution, review traces, token usage, and clean up old run results."
      />
      {loading ? <StatusMessage title="Loading" body="Loading workflow runs." /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {message ? <StatusMessage title="Success" body={message} /> : null}

      <section className="mb-5 rounded border border-line bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_220px_150px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
            <span className="sr-only">Search runs</span>
            <input
              className="focus-ring w-full rounded border border-line bg-white py-2 pl-9 pr-3 text-sm"
              placeholder="Search run ID, workflow name, or input text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            className="focus-ring rounded border border-line bg-white px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select
            className="focus-ring rounded border border-line bg-white px-3 py-2 text-sm"
            value={workflowFilter}
            onChange={(event) => setWorkflowFilter(event.target.value)}
          >
            <option value="all">All workflows</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>
          <select
            className="focus-ring rounded border border-line bg-white px-3 py-2 text-sm"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Showing {filteredRuns.length} of {runs.length} runs.
          </p>
          <button
            type="button"
            className="focus-ring inline-flex items-center gap-2 rounded border border-warning bg-white px-3 py-2 text-sm font-medium text-warning disabled:opacity-50"
            disabled={selectedIds.size === 0 || deleting}
            onClick={deleteSelectedRuns}
          >
            <Trash2 size={16} />
            Delete selected
          </button>
        </div>
      </section>

      {!loading && runs.length === 0 ? <StatusMessage title="No runs yet" body="Run a workflow to create your first run." /> : null}

      <div className="grid gap-3">
        {filteredRuns.map((run) => (
          <article key={run.id} className="rounded border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <input
                  className="mt-1 h-4 w-4"
                  type="checkbox"
                  checked={selectedIds.has(run.id)}
                  onChange={() => toggleSelected(run.id)}
                  aria-label={`Select run ${run.id}`}
                />
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold">Run {run.id}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {workflowNames[run.workflow_id] ?? `Workflow ${run.workflow_id}`} · {formatDate(run.created_at)}
                  </p>
                  <p className="mt-2 max-h-12 overflow-hidden break-words text-sm text-slate-500">{previewInput(run.input)}</p>
                </div>
              </div>
              <span className={`rounded px-2 py-1 text-xs ${statusClass(run.status)}`}>{run.status}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}`}>
                Open
              </Link>
              <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}/monitor`}>
                Monitor
              </Link>
              <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}`}>
                Trace
              </Link>
              <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}/executions`}>
                Executions
              </Link>
              <Link className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${run.id}/token-usage`}>
                Token Usage
              </Link>
              <button
                type="button"
                className="focus-ring rounded border border-warning bg-white px-3 py-1 text-sm font-medium text-warning disabled:opacity-50"
                disabled={deleting}
                onClick={() => deleteRun(run.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return "Unable to delete run.";
}

function formatDate(value?: string): string {
  if (!value) {
    return "No timestamp";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function previewInput(input: Record<string, unknown>): string {
  const task = input.task;
  if (typeof task === "string") {
    return task;
  }
  return JSON.stringify(input);
}

function statusClass(status: string): string {
  if (status === "completed") {
    return "bg-green-50 text-success";
  }
  if (status === "failed") {
    return "bg-red-50 text-warning";
  }
  if (status === "running") {
    return "bg-blue-50 text-accent";
  }
  return "bg-panel text-slate-600";
}
