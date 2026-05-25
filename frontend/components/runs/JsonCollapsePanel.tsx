"use client";

import { Check, Clipboard, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export function JsonCollapsePanel({
  title,
  value,
  meta,
  defaultExpanded = false,
  emptyLabel = "No data recorded."
}: {
  title: string;
  value: unknown;
  meta?: string;
  defaultExpanded?: boolean;
  emptyLabel?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const formatted = useMemo(() => formatJson(value), [value]);
  const hasValue = value !== null && value !== undefined;
  const ToggleIcon = expanded ? ChevronDown : ChevronRight;

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="min-w-0 rounded border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="focus-ring flex min-w-0 items-center gap-2 rounded px-1 py-1 text-left"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <ToggleIcon size={16} className="shrink-0 text-slate-500" />
          <span className="break-words text-sm font-semibold" role="heading" aria-level={3}>
            {title}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {meta ? <span className="rounded bg-panel px-2 py-1 text-xs text-slate-600">{meta}</span> : null}
          {expanded && hasValue ? (
            <button
              type="button"
              className="focus-ring inline-flex items-center gap-1 rounded border border-line bg-white px-2 py-1 text-xs text-slate-700"
              onClick={copyJson}
            >
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? "Copied" : "Copy JSON"}
            </button>
          ) : null}
          <button
            type="button"
            className="focus-ring rounded border border-line bg-white px-2 py-1 text-xs text-slate-700"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {expanded ? (
        hasValue ? (
          <pre className="mt-3 max-h-96 max-w-full overflow-auto whitespace-pre-wrap break-words rounded bg-panel p-3 text-xs leading-5 text-slate-700">
            {formatted}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-slate-500">{emptyLabel}</p>
        )
      ) : null}
    </section>
  );
}

export function formatJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
