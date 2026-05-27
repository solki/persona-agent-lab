import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prettyJson } from "@/lib/utils";

export function JsonCollapse({ title, value, defaultOpen = false }: { title: string; value: unknown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-sm border border-border bg-panel">
      <button
        type="button"
        className="focus-ring flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left font-mono text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="truncate">{title}</span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{open ? "Collapse" : "Expand"}</span>
      </button>
      {open ? (
        <div className="border-t border-border p-3">
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-background p-3 font-mono text-xs text-foreground/80">{prettyJson(value)}</pre>
        </div>
      ) : null}
    </div>
  );
}

export function JsonCollapseList({ items }: { items: Array<{ id: number | string; title: string; value: unknown }> }) {
  const [allOpen, setAllOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setAllOpen((open) => !open)}>
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>
      {items.map((item) => (
        <JsonCollapse key={`${item.id}-${allOpen}`} title={item.title} value={item.value} defaultOpen={allOpen} />
      ))}
    </div>
  );
}
