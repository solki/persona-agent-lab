import { cn } from "@/lib/utils";

export function Alert({ title, children, tone = "info" }: { title: string; children: React.ReactNode; tone?: "info" | "error" | "success" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-sm border p-3 text-sm",
        tone === "error" && "border-rose-500/30 bg-rose-950/30 text-rose-300",
        tone === "success" && "border-emerald-500/30 bg-emerald-950/30 text-emerald-300",
        tone === "info" && "border-blue-500/30 bg-blue-950/30 text-blue-300"
      )}
    >
      <strong className="block font-mono text-xs font-medium uppercase tracking-wider">{title}</strong>
      <div className="mt-1 break-all">{children}</div>
    </div>
  );
}
