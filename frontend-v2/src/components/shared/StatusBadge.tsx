import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  approved: "bg-emerald-100 text-emerald-800",
  running: "bg-blue-100 text-blue-800",
  pending: "bg-amber-100 text-amber-800",
  archived: "bg-slate-200 text-slate-700",
  inactive: "bg-slate-200 text-slate-700",
  rejected: "bg-rose-100 text-rose-800",
  failed: "bg-rose-100 text-rose-800"
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const normalized = status.toLowerCase();
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium", styles[normalized] ?? "bg-muted text-muted-foreground", className)}>
      {status}
    </span>
  );
}
