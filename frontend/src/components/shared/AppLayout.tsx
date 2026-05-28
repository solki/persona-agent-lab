import { Beaker, Brain, FlaskConical, Hammer, History, Home, Network, Play, ShieldAlert, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useNotification } from "@/lib/NotificationContext";
import { Button } from "@/components/ui/button";
import type { AdminCleanupResponse } from "@/lib/types";

const nav = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/souls", label: "Souls", icon: Brain },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/tools", label: "Tools", icon: Hammer },
  { href: "/workflows", label: "Workflows", icon: Network },
  { href: "/runs", label: "Runs", icon: History },
  { href: "/demo", label: "Demo", icon: Play },
  { href: "/experiments", label: "Experiments", icon: FlaskConical }
];

export function AppLayout() {
  const { totalCount } = useNotification();
  const [searchParams] = useSearchParams();
  const showAdmin = searchParams.get("adminCleanup") === "1";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<AdminCleanupResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dialogOpen) {
      setConfirmInput("");
      setError("");
      setResult(null);
    }
  }, [dialogOpen]);

  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    setError("");
    setResult(null);
    try {
      const r = await api.cleanupLabData();
      setResult(r);
      setConfirmInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cleanup failed");
    } finally {
      setCleaning(false);
    }
  }, []);

  const phrase = "CLEAR LAB DATA";
  const phraseOk = confirmInput === phrase;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-panel lg:block">
        {/* Brand */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-primary text-primary-foreground">
              <Beaker size={19} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-mono text-sm font-medium tracking-tight text-foreground">
                Agent Swarm Lab
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Observatory
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-0.5 px-3 py-4">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px]"
                      : "text-muted-foreground hover:bg-panel-hover hover:text-foreground border-l-2 border-transparent"
                  )
                }
              >
                <Icon size={16} strokeWidth={1.5} className={cn("shrink-0")} />
                <span className="font-medium">{item.label}</span>
                {item.label === "Agents" && totalCount > 0 ? (
                  <span
                    aria-label="Pending feedback memory approval"
                    className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30"
                  >
                    {totalCount}
                  </span>
                ) : null}
              </NavLink>
            );
          })}

          {/* Hidden admin cleanup button */}
          {showAdmin && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="w-full flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors text-red-400 hover:bg-red-500/10 hover:text-red-300 border-l-2 border-transparent"
            >
              <ShieldAlert size={16} strokeWidth={1.5} className="shrink-0" />
              <span className="font-medium">Admin cleanup</span>
            </button>
          )}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            v0.1.0 &middot; Swarm
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
          <Outlet />
        </div>
      </main>

      {/* Admin cleanup confirmation dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !cleaning && setDialogOpen(false)} />
          <div className="relative z-50 w-[min(92vw,480px)] rounded-sm border border-border bg-panel p-5 shadow-panel-lg">
            <h2 className="font-mono text-base font-medium text-foreground flex items-center gap-2">
              <ShieldAlert size={18} className="text-red-400" />
              Admin Cleanup
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently deletes <strong>all</strong> lab data from PostgreSQL: souls, agents,
              tools, workflows, runs, experiments, contexts, memories, feedback, evaluations,
              proposed memories, trace events, execution records, token usage, and learning events.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Schema and tables are preserved. This action <strong>cannot be undone</strong>.
            </p>

            {/* Typing confirmation */}
            <div className="mt-4">
              <label className="block text-xs text-muted-foreground mb-1.5">
                Type <code className="bg-panel-hover px-1 py-px rounded-sm text-red-400 font-mono text-xs">{phrase}</code> to confirm:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                disabled={cleaning || !!result}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Success result */}
            {result && (
              <div className="mt-3 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 max-h-48 overflow-y-auto">
                <p className="font-medium mb-1">Cleanup complete:</p>
                <ul className="space-y-0.5">
                  <li>Souls: {result.deleted_souls}</li>
                  <li>Agents: {result.deleted_agents}</li>
                  <li>Tools: {result.deleted_tools}</li>
                  <li>Workflows: {result.deleted_workflows}</li>
                  <li>Runs: {result.deleted_runs}</li>
                  <li>Experiments: {result.deleted_experiments}</li>
                  <li>Experiment runs: {result.deleted_experiment_runs}</li>
                  <li>Contexts: {result.deleted_contexts}</li>
                  <li>Memories: {result.deleted_memories}</li>
                  <li>Agent-tool assignments: {result.deleted_agent_tool_assignments}</li>
                  <li>Trace events: {result.deleted_trace_events}</li>
                  <li>Agent executions: {result.deleted_agent_executions}</li>
                  <li>Execution events: {result.deleted_agent_execution_events}</li>
                  <li>Token usage: {result.deleted_token_usage}</li>
                  <li>Feedback: {result.deleted_feedback}</li>
                  <li>Evaluations: {result.deleted_evaluations}</li>
                  <li>Proposed memories: {result.deleted_proposed_memories}</li>
                  <li>Learning events: {result.deleted_learning_events}</li>
                </ul>
              </div>
            )}

            {/* Buttons */}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={cleaning}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCleanup}
                disabled={!phraseOk || cleaning || !!result}
              >
                {cleaning ? "Clearing..." : "Clear All Lab Data"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
