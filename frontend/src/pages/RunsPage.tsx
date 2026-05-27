import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { JsonCollapse, JsonCollapseList } from "@/components/shared/JsonCollapse";
import { NoticeDialog } from "@/components/shared/NoticeDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { Run, RunMonitor, TraceEvent, Workflow } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type RunFilter = "active" | "archived" | "all";

export function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [filter, setFilter] = useState<RunFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingAction, setPendingAction] = useState<{ runIds: number[]; action: "archive" | "activate" | "delete" } | null>(null);
  const [safetyWarning, setSafetyWarning] = useState("");
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [runData, workflowData] = await Promise.all([api.listRuns(true), api.listWorkflows()]);
      setRuns(runData);
      setWorkflows(workflowData);
      setSelectedIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load runs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const workflowName = useMemo(() => Object.fromEntries(workflows.map((workflow) => [workflow.id, workflow.name])), [workflows]);
  const filtered = runs.filter((run) => {
    if (filter === "archived") {
      return run.status === "archived" || Boolean(run.archived_at);
    }
    if (filter === "active") {
      return run.status !== "archived" && !run.archived_at;
    }
    return true;
  });

  async function applyAction() {
    if (!pendingAction) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      for (const runId of pendingAction.runIds) {
        if (pendingAction.action === "archive") {
          await api.archiveRun(runId);
        } else if (pendingAction.action === "activate") {
          await api.activateRun(runId);
        } else {
          await api.hardDeleteRun(runId);
        }
      }
      setMessage(
        pendingAction.action === "archive"
          ? "Run archive completed. Learning records were preserved."
          : pendingAction.action === "activate"
            ? "Run activation completed."
            : "Run deleted permanently."
      );
      setPendingAction(null);
      await load();
    } catch (actionError) {
      const messageText = actionError instanceof Error ? actionError.message : "Unable to update run.";
      setError(messageText);
      setSafetyWarning(messageText);
      setPendingAction(null);
    } finally {
      setWorking(false);
    }
  }

  function toggleSelected(runId: number) {
    setSelectedIds((current) => current.includes(runId) ? current.filter((id) => id !== runId) : [...current, runId]);
  }

  const selectedRuns = runs.filter((run) => selectedIds.includes(run.id));
  const selectedArchivedStates = new Set(selectedRuns.map((run) => run.status === "archived" || Boolean(run.archived_at)));
  const bulkAction =
    selectedRuns.length === 0 || selectedArchivedStates.size !== 1
      ? null
      : selectedArchivedStates.has(true)
        ? "activate"
        : "archive";

  return (
    <>
      <PageHeader title="Runs" description="Inspect workflow run history, archive old results, reactivate archived runs, and open trace or monitor detail." />
      <div className="space-y-3">
        {message ? <Alert title="Run updated" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <div className="flex max-w-xs items-center gap-2">
          <span className="text-sm font-medium">Filter</span>
          <Select value={filter} onChange={(event) => setFilter(event.target.value as RunFilter)} aria-label="Run filter">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!bulkAction}
            onClick={() => bulkAction ? setPendingAction({ runIds: selectedIds, action: bulkAction }) : setError("Select either active runs or archived runs, not a mixed set.")}
          >
            {bulkAction === "activate" ? <RotateCcw size={15} /> : <Archive size={15} />}
            {bulkAction === "activate" ? "Activate Selected" : "Archive Selected"}
          </Button>
          {selectedRuns.length > 0 && !bulkAction ? <span className="text-sm text-muted-foreground">Mixed selections must be handled separately.</span> : null}
        </div>
        {loading ? <Alert title="Loading">Loading runs.</Alert> : null}
        {!loading && filtered.length === 0 ? <EmptyState title="No runs" body="Run a workflow in the existing app or seed a run through the backend to inspect it here." /> : null}
        {filtered.map((run) => {
          const archived = run.status === "archived" || Boolean(run.archived_at);
          return (
            <Card key={run.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedIds.includes(run.id)} onChange={() => toggleSelected(run.id)} aria-label={`Select run ${run.id}`} />
                    <span className="text-base font-semibold">Run {run.id}</span>
                  </label>
                  <p className="mt-1 text-sm text-muted-foreground">{workflowName[run.workflow_id] ?? `Workflow ${run.workflow_id}`}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Created {formatDate(run.created_at)}</p>
                  <div className="mt-2"><StatusBadge status={archived ? "archived" : run.status} /></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/runs/${run.id}`}><Button type="button" variant="outline" size="sm">Open</Button></Link>
                  <Button
                    type="button"
                    variant={archived ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPendingAction({ runIds: [run.id], action: archived ? "activate" : "archive" })}
                  >
                    {archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                    {archived ? "Activate" : "Archive"}
                  </Button>
                  {archived ? (
                    <Button type="button" variant="destructive" size="sm" onClick={() => setPendingAction({ runIds: [run.id], action: "delete" })}>
                      <Trash2 size={15} /> Delete
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === "activate" ? "Activate run?" : pendingAction?.action === "delete" ? "Delete run permanently?" : "Archive run?"}
        description={
          pendingAction?.action === "activate"
            ? "This restores the selected run(s) to the active list while preserving trace, feedback, learning, and execution records."
            : pendingAction?.action === "delete"
              ? "This permanently deletes the archived run only if backend safety checks confirm it has no learning, experiment, feedback, or evaluation references. If blocked, the warning will be shown here."
              : "This hides the selected run(s) from the active list while preserving trace, feedback, learning, and execution records."
        }
        confirmLabel={pendingAction?.action === "activate" ? "Activate run" : pendingAction?.action === "delete" ? "Delete run" : "Archive run"}
        destructive={pendingAction?.action !== "activate"}
        loading={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={applyAction}
      />
      <NoticeDialog open={Boolean(safetyWarning)} title="Action blocked" description={safetyWarning} onClose={() => setSafetyWarning("")} />
    </>
  );
}

export function RunDetailPage() {
  const { id } = useParams();
  const runId = Number(id);
  const [run, setRun] = useState<Run | null>(null);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [monitor, setMonitor] = useState<RunMonitor | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [runData, traceData, monitorData] = await Promise.all([api.getRun(runId), api.getRunTrace(runId), api.getRunMonitor(runId)]);
        setRun(runData);
        setTrace(traceData);
        setMonitor(monitorData);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load run details.");
      }
    }
    void load();
  }, [runId]);

  if (error) {
    return <Alert title="Error" tone="error">{error}</Alert>;
  }
  if (!run) {
    return <Alert title="Loading">Loading run detail.</Alert>;
  }

  return (
    <>
      <PageHeader title={`Run ${run.id}`} description="Collapsed JSON keeps trace and monitor payloads readable while preserving detail on demand." />
      <div className="space-y-4">
        <Card>
          <CardHeader><h2 className="text-base font-semibold">Summary</h2></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div><span className="text-xs text-muted-foreground">Status</span><div className="mt-1"><StatusBadge status={run.archived_at ? "archived" : run.status} /></div></div>
            <div><span className="text-xs text-muted-foreground">Started</span><p className="mt-1 text-sm">{formatDate(run.started_at)}</p></div>
            <div><span className="text-xs text-muted-foreground">Ended</span><p className="mt-1 text-sm">{formatDate(run.ended_at)}</p></div>
          </CardContent>
        </Card>
        <JsonCollapse title="Run input" value={run.input} />
        <JsonCollapse title="Run output" value={run.output} />
        <Card>
          <CardHeader><h2 className="text-base font-semibold">Trace Events</h2></CardHeader>
          <CardContent>
            {trace.length === 0 ? <EmptyState title="No trace events" body="This run has no trace events." /> : (
              <JsonCollapseList items={trace.map((event) => ({ id: event.id, title: `${event.event_type} · ${formatDate(event.created_at)}`, value: event.payload }))} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-base font-semibold">Monitor</h2></CardHeader>
          <CardContent className="space-y-3">
            {monitor ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div><span className="text-xs text-muted-foreground">Agent executions</span><p className="text-lg font-semibold">{monitor.agent_executions.length}</p></div>
                  <div><span className="text-xs text-muted-foreground">Latest events</span><p className="text-lg font-semibold">{monitor.latest_events.length}</p></div>
                  <div><span className="text-xs text-muted-foreground">Tokens</span><p className="text-lg font-semibold">{monitor.token_usage_summary.total_tokens}</p></div>
                </div>
                <JsonCollapseList items={monitor.current_event_stream.map((event) => ({ id: event.id, title: `${event.event_type} · agent ${event.agent_id}`, value: event.payload }))} />
              </>
            ) : <EmptyState title="No monitor data" body="Monitor data is unavailable for this run." />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
