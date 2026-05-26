"use client";

import Link from "next/link";
import { Archive, RotateCcw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Run, RunStatus, Workflow } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

type StatusFilter = "all" | RunStatus;
type SortOrder = "newest" | "oldest";
type ArchiveFilter = "active" | "archived" | "all";
type RunLifecycleAction = "archive" | "activate";

export function RunList() {
  const loadRequestId = useRef(0);
  const [runs, setRuns] = useState<Run[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("active");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [blockedDeleteWarning, setBlockedDeleteWarning] = useState("");
  const [message, setMessage] = useState("");
  const [pendingLifecycleRun, setPendingLifecycleRun] = useState<Run | null>(null);
  const [pendingDeleteRun, setPendingDeleteRun] = useState<Run | null>(null);
  const [confirmBulkLifecycleOpen, setConfirmBulkLifecycleOpen] = useState(false);

  const loadRuns = useCallback(async () => {
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    setLoading(true);
    setError("");
    try {
      const [runData, workflowData] = await Promise.all([api.listRuns(archiveFilter !== "active"), api.listWorkflows()]);
      if (requestId !== loadRequestId.current) {
        return;
      }
      setRuns(runData);
      setWorkflows(workflowData);
      setSelectedIds(new Set());
    } catch (loadError) {
      if (requestId !== loadRequestId.current) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Unable to load runs.");
    } finally {
      if (requestId === loadRequestId.current) {
        setLoading(false);
      }
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

  const selectedRuns = useMemo(() => filteredRuns.filter((run) => selectedIds.has(run.id)), [filteredRuns, selectedIds]);
  const selectedArchivedRuns = useMemo(() => selectedRuns.filter((run) => run.status === "archived"), [selectedRuns]);
  const selectedActiveRuns = useMemo(() => selectedRuns.filter((run) => run.status !== "archived"), [selectedRuns]);
  const bulkAction: RunLifecycleAction | null = useMemo(() => {
    if (archiveFilter === "archived") {
      return "activate";
    }
    if (archiveFilter === "active") {
      return "archive";
    }
    if (selectedRuns.length > 0 && selectedArchivedRuns.length === selectedRuns.length) {
      return "activate";
    }
    if (selectedRuns.length > 0 && selectedActiveRuns.length === selectedRuns.length) {
      return "archive";
    }
    return null;
  }, [archiveFilter, selectedActiveRuns.length, selectedArchivedRuns.length, selectedRuns.length]);
  const mixedSelection = selectedRuns.length > 0 && selectedArchivedRuns.length > 0 && selectedActiveRuns.length > 0;

  async function runLifecycleAction() {
    if (!pendingLifecycleRun) {
      return;
    }
    const action = lifecycleActionForRun(pendingLifecycleRun);
    const runId = pendingLifecycleRun.id;
    setMutating(true);
    setError("");
    setWarning("");
    setMessage("");
    try {
      const response = action === "archive" ? await api.archiveRun(runId) : await api.activateRun(runId);
      setRuns((current) => applyLifecycleResult(current, runId, action, response.archived_at ?? null, archiveFilter));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(runId);
        return next;
      });
      setMessage(response.message);
    } catch (mutationError) {
      setError(errorMessage(mutationError, `Unable to ${action} run.`));
    } finally {
      setMutating(false);
      setPendingLifecycleRun(null);
    }
  }

  async function runBulkLifecycleAction() {
    if (!bulkAction) {
      setWarning("Select only active runs to archive or only archived runs to activate.");
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      return;
    }
    setMutating(true);
    setError("");
    setWarning("");
    setMessage("");
    try {
      for (const id of ids) {
        if (bulkAction === "archive") {
          await api.archiveRun(id);
        } else {
          await api.activateRun(id);
        }
      }
      setRuns((current) => applyBulkLifecycleResult(current, ids, bulkAction, archiveFilter));
      setSelectedIds(new Set());
      setMessage(`${bulkAction === "archive" ? "Archived" : "Activated"} ${ids.length} selected run${ids.length === 1 ? "" : "s"}. Learning records were preserved.`);
    } catch (mutationError) {
      setError(errorMessage(mutationError, `Unable to ${bulkAction} selected runs.`));
      await loadRuns();
    } finally {
      setMutating(false);
    }
  }

  async function hardDeleteRun() {
    if (!pendingDeleteRun) {
      return;
    }
    const runId = pendingDeleteRun.id;
    setMutating(true);
    setError("");
    setWarning("");
    setMessage("");
    try {
      const response = await api.hardDeleteRun(runId);
      setRuns((current) => current.filter((run) => run.id !== runId));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(runId);
        return next;
      });
      setMessage(response.message);
    } catch (deleteError) {
      const warningMessage = errorMessage(deleteError, "This run cannot be permanently deleted. Keep it archived to preserve history.");
      setWarning(warningMessage);
      setBlockedDeleteWarning(warningMessage);
    } finally {
      setMutating(false);
      setPendingDeleteRun(null);
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

  function changeArchiveFilter(nextFilter: ArchiveFilter) {
    setArchiveFilter(nextFilter);
    setStatusFilter("all");
  }

  return (
    <>
      <PageHeader
        title="Runs"
        description="Inspect workflow runs, monitor agent execution, review traces, token usage, and archive old run results without deleting learning history."
      />
      {loading ? <StatusMessage title="Loading" body="Loading workflow runs." /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {warning ? <StatusMessage title="Warning" body={warning} /> : null}
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
              onChange={(event) => changeArchiveFilter(event.target.value as ArchiveFilter)}
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
            disabled={selectedIds.size === 0 || mutating || !bulkAction}
            onClick={() => setConfirmBulkLifecycleOpen(true)}
          >
            {bulkAction === "activate" ? <RotateCcw size={16} /> : <Archive size={16} />}
            {bulkAction === "activate" ? "Activate Selected" : "Archive Selected"}
          </button>
        </div>
        {mixedSelection ? (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Mixed selection: choose only active runs to archive or only archived runs to activate.
          </p>
        ) : null}
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
                className={`focus-ring rounded border bg-white px-3 py-1 text-sm font-medium disabled:opacity-50 ${
                  run.status === "archived" ? "border-accent text-accent" : "border-warning text-warning"
                }`}
                disabled={mutating}
                onClick={() => setPendingLifecycleRun(run)}
              >
                {run.status === "archived" ? "Activate" : "Archive"}
              </button>
              {run.status === "archived" ? (
                <button
                  type="button"
                  className="focus-ring rounded border border-warning bg-white px-3 py-1 text-sm font-medium text-warning disabled:opacity-50"
                  disabled={mutating}
                  onClick={() => setPendingDeleteRun(run)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingLifecycleRun)}
        title={pendingLifecycleRun && pendingLifecycleRun.status === "archived" ? "Activate run?" : "Archive run?"}
        description={
          pendingLifecycleRun && pendingLifecycleRun.status === "archived"
            ? "This will return the run to the default Active runs list. Trace, feedback, proposed memories, approved memories, and learning history will be preserved."
            : "This will hide the run from the default Runs list but preserve trace, feedback, proposed memories, and learning history. Agent definitions and approved memories will not be deleted."
        }
        confirmLabel={pendingLifecycleRun && pendingLifecycleRun.status === "archived" ? "Activate run" : "Archive run"}
        loading={mutating}
        onCancel={() => setPendingLifecycleRun(null)}
        onConfirm={runLifecycleAction}
      />
      <ConfirmDialog
        open={confirmBulkLifecycleOpen}
        title={bulkAction === "activate" ? "Activate selected runs?" : "Archive selected runs?"}
        description={
          bulkAction === "activate"
            ? `Activate ${selectedIds.size} selected run${selectedIds.size === 1 ? "" : "s"}? Learning records, traces, and proposed memories will be preserved.`
            : `Archive ${selectedIds.size} selected run${selectedIds.size === 1 ? "" : "s"}? Learning records, traces, and proposed memories will be preserved.`
        }
        confirmLabel={bulkAction === "activate" ? "Activate Selected" : "Archive Selected"}
        loading={mutating}
        onCancel={() => setConfirmBulkLifecycleOpen(false)}
        onConfirm={() => {
          setConfirmBulkLifecycleOpen(false);
          void runBulkLifecycleAction();
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteRun)}
        title="Delete archived run permanently?"
        description="This permanently deletes the archived run only if the backend confirms it has no learning or experiment history. If the safety check fails, the run will remain archived and a warning will be shown."
        confirmLabel="Delete permanently"
        loading={mutating}
        onCancel={() => setPendingDeleteRun(null)}
        onConfirm={hardDeleteRun}
      />
      <ConfirmDialog
        open={Boolean(blockedDeleteWarning)}
        title="Delete blocked by safety check"
        description={blockedDeleteWarning}
        confirmLabel="Keep archived"
        cancelLabel="Close"
        variant="warning"
        onCancel={() => setBlockedDeleteWarning("")}
        onConfirm={() => setBlockedDeleteWarning("")}
      />
    </>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function lifecycleActionForRun(run: Run): RunLifecycleAction {
  return run.status === "archived" ? "activate" : "archive";
}

function applyLifecycleResult(runs: Run[], runId: number, action: RunLifecycleAction, archivedAt: string | null, archiveFilter: ArchiveFilter): Run[] {
  const updatedRuns =
    action === "archive"
      ? runs.map((run) => (run.id === runId ? { ...run, status: "archived" as const, archived_at: archivedAt } : run))
      : runs.map((run) => (run.id === runId ? { ...run, status: "completed" as const, archived_at: null } : run));
  return filterRunsForArchiveFilter(updatedRuns, archiveFilter);
}

function applyBulkLifecycleResult(runs: Run[], runIds: number[], action: RunLifecycleAction, archiveFilter: ArchiveFilter): Run[] {
  const idSet = new Set(runIds);
  if (action === "archive") {
    return filterRunsForArchiveFilter(
      runs.map((run) => (idSet.has(run.id) ? { ...run, status: "archived" as const, archived_at: run.archived_at ?? new Date().toISOString() } : run)),
      archiveFilter
    );
  }
  return filterRunsForArchiveFilter(
    runs.map((run) => (idSet.has(run.id) ? { ...run, status: "completed" as const, archived_at: null } : run)),
    archiveFilter
  );
}

function filterRunsForArchiveFilter(runs: Run[], archiveFilter: ArchiveFilter): Run[] {
  if (archiveFilter === "active") {
    return runs.filter((run) => run.status !== "archived");
  }
  if (archiveFilter === "archived") {
    return runs.filter((run) => run.status === "archived");
  }
  return runs;
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
