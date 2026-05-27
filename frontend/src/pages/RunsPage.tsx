import { Activity, Archive, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Monitor</h2>
              <Link to={`/runs/${run.id}/monitor`}><Button type="button" variant="outline" size="sm"><Activity size={14} /> Live Monitor</Button></Link>
            </div>
          </CardHeader>
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

const POLL_INTERVAL_MS = 2000;
const ACTIVE_STATUSES = new Set(["pending", "running"]);

function formatElapsed(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export function RunMonitorPage() {
  const { id } = useParams();
  const runId = Number(id);
  const [monitor, setMonitor] = useState<RunMonitor | null>(null);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMonitor = useCallback(async () => {
    try {
      const data = await api.getRunMonitor(runId);
      setMonitor(data);
      setError("");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load monitor.");
    }
  }, [runId]);

  useEffect(() => {
    void fetchMonitor();
  }, [fetchMonitor]);

  useEffect(() => {
    const isActive = monitor && ACTIVE_STATUSES.has(monitor.run_status);
    if (isActive) {
      intervalRef.current = setInterval(() => { void fetchMonitor(); }, POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [monitor, fetchMonitor]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (error) {
    return <Alert title="Error" tone="error">{error}</Alert>;
  }
  if (!monitor) {
    return <Alert title="Loading">Loading run monitor.</Alert>;
  }

  const isLive = ACTIVE_STATUSES.has(monitor.run_status);

  return (
    <>
      <PageHeader title={`Run ${monitor.run_id} Monitor`} description="Live observability dashboard with auto-refresh while the run is active." />

      <div className="space-y-4">
        {/* Status bar */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wider text-amber-400">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 live-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />
                Idle
              </span>
            )}
            <span className="text-sm text-muted-foreground">|</span>
            <span className="text-sm">
              Status: <StatusBadge status={monitor.run_status} />
            </span>
            <span className="text-sm text-muted-foreground">|</span>
            <span className="font-mono text-sm text-muted-foreground">
              Elapsed: {formatElapsed(monitor.elapsed_ms)}
            </span>
            {monitor.active_workflow_step != null ? (
              <>
                <span className="text-sm text-muted-foreground">|</span>
                <span className="font-mono text-sm text-muted-foreground">
                  Step: {monitor.active_workflow_step}
                </span>
              </>
            ) : null}
            <span className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => { void fetchMonitor(); }} disabled={isLive}>
              <RefreshCw size={14} /> Refresh
            </Button>
          </CardContent>
        </Card>

        {/* Active agent execution */}
        {monitor.active_agent_execution ? (
          <Card className="border-amber-600/30">
            <CardHeader>
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 live-pulse" />
                Active Agent
              </h2>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div><span className="text-xs text-muted-foreground">Agent</span><p className="font-medium">{monitor.active_agent_execution.agent_name_snapshot}</p></div>
                <div><span className="text-xs text-muted-foreground">Provider / Model</span><p className="font-mono text-xs">{monitor.active_agent_execution.provider} / {monitor.active_agent_execution.model}</p></div>
                <div><span className="text-xs text-muted-foreground">Status</span><div className="mt-0.5"><StatusBadge status={monitor.active_agent_execution.status} /></div></div>
                <div><span className="text-xs text-muted-foreground">Sequence</span><p className="font-mono text-xs">Step {monitor.active_agent_execution.sequence_index}</p></div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Agent executions */}
        <Card>
          <CardHeader><h2 className="text-sm font-medium">Agent Executions</h2></CardHeader>
          <CardContent>
            {monitor.agent_executions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No executions yet.</p>
            ) : (
              <div className="space-y-2">
                {monitor.agent_executions.map((exec) => (
                  <div key={exec.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-background px-3 py-2">
                    <StatusBadge status={exec.status} />
                    <span className="font-mono text-xs text-muted-foreground">step-{exec.sequence_index}</span>
                    <span className="text-sm font-medium">{exec.agent_name_snapshot}</span>
                    <span className="font-mono text-xs text-muted-foreground">{exec.provider} / {exec.model}</span>
                    <span className="flex-1" />
                    <span className="font-mono text-xs text-muted-foreground">{formatElapsed(exec.elapsed_ms)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event stream */}
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              Event Stream
              {isLive ? <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">streaming</span> : null}
            </h2>
          </CardHeader>
          <CardContent>
            {monitor.current_event_stream.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <div className="max-h-80 space-y-1 overflow-auto">
                {[...monitor.current_event_stream].reverse().map((event) => (
                  <div key={event.id} className="flex items-start gap-3 rounded-sm px-2 py-1 font-mono text-xs hover:bg-panel-hover">
                    <span className="mt-px shrink-0 text-muted-foreground">{formatDate(event.created_at)}</span>
                    <span className={event.event_type.includes("error") || event.event_type.includes("fail") ? "text-destructive" : "text-accent"}>{event.event_type}</span>
                    <span className="text-muted-foreground">agent {event.agent_id}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Token usage */}
        <Card>
          <CardHeader><h2 className="text-sm font-medium">Token Usage</h2></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <div><span className="text-xs text-muted-foreground">Total tokens</span><p className="font-mono text-lg font-medium">{monitor.token_usage_summary.total_tokens.toLocaleString()}</p></div>
              <div><span className="text-xs text-muted-foreground">Est. cost</span><p className="font-mono text-lg font-medium">${monitor.token_usage_summary.estimated_cost.toFixed(4)}</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Errors */}
        {monitor.errors.length > 0 ? (
          <Card className="border-rose-500/30">
            <CardHeader><h2 className="text-sm font-medium text-rose-400">Errors</h2></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monitor.errors.map((err, idx) => (
                  <div key={idx} className="rounded-sm border border-rose-500/20 bg-rose-950/30 p-3">
                    <pre className="font-mono text-xs text-rose-300 whitespace-pre-wrap">{JSON.stringify(err, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
