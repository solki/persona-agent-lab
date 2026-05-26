"use client";

import Link from "next/link";
import { Archive, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Run, RunStatus, Workflow } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

type StatusFilter = "all" | RunStatus;
type SortOrder = "newest" | "oldest";
type ArchiveFilter = "active" | "archived" | "all";

export function RunList() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("active");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingArchiveRun, setPendingArchiveRun] = useState<Run | null>(null);
  const [confirmBulkArchiveOpen, setConfirmBulkArchiveOpen] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [runData, workflowData] = await Promise.all([api.listRuns(archiveFilter !== "active"), api.listWorkflows()]);
      setRuns(runData);
      setWorkflows(workflowData);
      setSelectedIds(new Set());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load runs.");
    } finally {
      setLoading(false);
    }
  }, [archiveFilter]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const workflowNames = useMemo(() => Object.fromEntries(workflows.map((workflow) => [workflow.id, workflow.name])), [workflows]);

  const filteredRuns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return runs
      .filter((run) => {
        if (archiveFilter === "archived") {
          return run.status === "archived";
        }
        if (archiveFilter === "active") {
          return run.status !== "archived";
        }
        return true;
      })
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
  }, [archiveFilter, runs, search, sortOrder, statusFilter, workflowFilter, workflowNames]);

  async function archiveRun() {
    if (!pendingArchiveRun) {
      return;
    }
    const runId = pendingArchiveRun.id;
    setArchiving(true);
    setError("");
    setMessage("");
    try {
      const response = await api.archiveRun(runId);
      setRuns((current) =>
        archiveFilter === "active"
          ? current.filter((run) => run.id !== runId)
          : current.map((run) => (run.id === runId ? { ...run, status: "archived", archived_at: response.archived_at } : run))
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(runId);
        return next;
      });
      setMessage(response.message);
    } catch (archiveError) {
      setError(errorMessage(archiveError));
    } finally {
      setArchiving(false);
      setPendingArchiveRun(null);
    }
  }

  async function archiveSelectedRuns() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      return;
    }
    setArchiving(true);
    setError("");
    setMessage("");
    try {
      for (const id of ids) {
        await api.archiveRun(id);
      }
      setRuns((current) =>
        archiveFilter === "active"
          ? current.filter((run) => !selectedIds.has(run.id))
          : current.map((run) => (selectedIds.has(run.id) ? { ...run, status: "archived" } : run))
      );
      setSelectedIds(new Set());
      setMessage(`Archived ${ids.length} selected run${ids.length === 1 ? "" : "s"}. Learning records were preserved.`);
    } catch (archiveError) {
      setError(errorMessage(archiveError));
      await loadRuns();
    } finally {
      setArchiving(false);
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
        description="Inspect workflow runs, monitor agent execution, review traces, token usage, and archive old run results without deleting learning history."
      />
      {loading ? <StatusMessage title="Loading" body="Loading workflow runs." /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {message ? <StatusMessage title="Success" body={message} /> : null}

      <section className="mb-5 rounded border border-line bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_220px_150px]">
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
          <label>
            <span className="sr-only">Status filter</span>
            <select
              className="focus-ring w-full rounded border border-line bg-white px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Archive filter</span>
            <select
              className="focus-ring w-full rounded border border-line bg-white px-3 py-2 text-sm"
              value={archiveFilter}
              onChange={(event) => setArchiveFilter(event.target.value as ArchiveFilter)}
            >
              <option value="active">Active runs</option>
              <option value="archived">Archived runs</option>
              <option value="all">All runs</option>
            </select>
          </label>
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
            disabled={selectedIds.size === 0 || archiving}
            onClick={() => setConfirmBulkArchiveOpen(true)}
          >
            <Archive size={16} />
            Archive selected
          </button>
        </div>
      </section>

      {!loading && filteredRuns.length === 0 ? <StatusMessage title="No runs found" body="Run a workflow or change the filters to find archived runs." /> : null}

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
              <span className={`rounded px-2 py-1 text-xs ${statusClass(run.status)}`}>{run.status === "archived" ? "Archived" : run.status}</span>
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
                disabled={archiving || run.status === "archived"}
                onClick={() => setPendingArchiveRun(run)}
              >
                {run.status === "archived" ? "Archived" : "Archive"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingArchiveRun)}
        title="Archive run?"
        description="This will hide the run from the default Runs list but preserve trace, feedback, proposed memories, and learning history. Agent definitions and approved memories will not be deleted."
        confirmLabel="Archive run"
        loading={archiving}
        onCancel={() => setPendingArchiveRun(null)}
        onConfirm={archiveRun}
      />
      <ConfirmDialog
        open={confirmBulkArchiveOpen}
        title="Archive selected runs?"
        description={`Archive ${selectedIds.size} selected run${selectedIds.size === 1 ? "" : "s"}? Learning records, traces, and proposed memories will be preserved.`}
        confirmLabel="Archive selected"
        loading={archiving}
        onCancel={() => setConfirmBulkArchiveOpen(false)}
        onConfirm={() => {
          setConfirmBulkArchiveOpen(false);
          void archiveSelectedRuns();
        }}
      />
    </>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return "Unable to archive run.";
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
  if (status === "archived") {
    return "bg-slate-200 text-slate-700";
  }
  return "bg-panel text-slate-600";
}
