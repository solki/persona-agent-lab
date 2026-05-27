import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prettyJson } from "@/lib/utils";

export function JsonCollapse({ title, value, defaultOpen = false }: { title: string; value: unknown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-md border border-border bg-white">
      <button
        type="button"
        className="focus-ring flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm font-medium"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="truncate">{title}</span>
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Collapse" : "Expand"}</span>
      </button>
      {open ? (
        <div className="border-t border-border p-3">
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-3 text-xs text-slate-100">{prettyJson(value)}</pre>
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
