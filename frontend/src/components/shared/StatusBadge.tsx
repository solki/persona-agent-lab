import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  active: "bg-emerald-950/50 text-emerald-400 border border-emerald-500/30",
  completed: "bg-emerald-950/50 text-emerald-400 border border-emerald-500/30",
  approved: "bg-emerald-950/50 text-emerald-400 border border-emerald-500/30",
  running: "bg-blue-950/50 text-blue-400 border border-blue-500/30",
  pending: "bg-amber-950/50 text-amber-400 border border-amber-500/30",
  archived: "bg-slate-800/50 text-slate-400 border border-slate-600/30",
  inactive: "bg-slate-800/50 text-slate-400 border border-slate-600/30",
  rejected: "bg-rose-950/50 text-rose-400 border border-rose-500/30",
  failed: "bg-rose-950/50 text-rose-400 border border-rose-500/30"
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const normalized = status.toLowerCase();
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase", styles[normalized] ?? "bg-muted text-muted-foreground border border-border", className)}>
      {status}
    </span>
  );
}
