import { cn } from "@/lib/utils";

export function Alert({ title, children, tone = "info" }: { title: string; children: React.ReactNode; tone?: "info" | "error" | "success" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border p-3 text-sm",
        tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : null,
        tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : null,
        tone === "info" ? "border-blue-200 bg-blue-50 text-blue-800" : null
      )}
    >
      <strong className="block font-semibold">{title}</strong>
      <div className="mt-1">{children}</div>
    </div>
  );
}
