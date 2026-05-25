"use client";

import { AlertTriangle, Check, Clipboard, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatJson } from "@/components/runs/JsonCollapsePanel";

export interface RuntimeEvent {
  id: number;
  event_type: string;
  agent_id?: number | null;
  payload: Record<string, unknown>;
  created_at?: string;
}

type EventCategory = "all" | "context" | "memory" | "llm" | "tool" | "workflow" | "learning" | "error";

const categories: Array<{ value: EventCategory; label: string }> = [
  { value: "all", label: "All events" },
  { value: "context", label: "Context" },
  { value: "memory", label: "Memory" },
  { value: "llm", label: "LLM" },
  { value: "tool", label: "Tool" },
  { value: "workflow", label: "Workflow" },
  { value: "learning", label: "Learning" },
  { value: "error", label: "Error" }
];

export function RuntimeEventList({
  title = "Event Timeline",
  events,
  agentNames = {}
}: {
  title?: string;
  events: RuntimeEvent[];
  agentNames?: Record<number, string>;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [agentFilter, setAgentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory>("all");
  const [search, setSearch] = useState("");

  const agentOptions = useMemo(() => {
    const ids = Array.from(new Set(events.map((event) => event.agent_id).filter((id): id is number => typeof id === "number")));
    return ids.map((id) => ({ id, label: agentNames[id] ?? `Agent ${id}` }));
  }, [agentNames, events]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesAgent = agentFilter === "all" || String(event.agent_id) === agentFilter;
      const matchesCategory = categoryFilter === "all" || eventMatchesCategory(event.event_type, categoryFilter);
      const matchesSearch =
        !query || event.event_type.toLowerCase().includes(query) || formatJson(event.payload).toLowerCase().includes(query);
      return matchesAgent && matchesCategory && matchesSearch;
    });
  }, [agentFilter, categoryFilter, events, search]);

  function toggleEvent(id: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <section className="min-w-0 rounded border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Showing {filteredEvents.length} of {events.length} events. Payloads are collapsed by default.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm"
            onClick={() => setExpandedIds(new Set(filteredEvents.map((event) => event.id)))}
          >
            Expand all
          </button>
          <button
            type="button"
            className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm"
            onClick={() => setExpandedIds(new Set())}
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
          <span className="sr-only">Search events</span>
          <input
            className="focus-ring w-full rounded border border-line bg-white py-2 pl-9 pr-3 text-sm"
            placeholder="Search event type or payload"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Filter by agent</span>
          <select
            className="focus-ring w-full rounded border border-line bg-white px-3 py-2 text-sm"
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
          >
            <option value="all">All agents</option>
            {agentOptions.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by event type</span>
          <select
            className="focus-ring w-full rounded border border-line bg-white px-3 py-2 text-sm"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as EventCategory)}
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-2">
        {filteredEvents.length === 0 ? <p className="rounded bg-panel p-3 text-sm text-slate-500">No events match these filters.</p> : null}
        {filteredEvents.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            agentName={typeof event.agent_id === "number" ? agentNames[event.agent_id] : undefined}
            expanded={expandedIds.has(event.id)}
            onToggle={() => toggleEvent(event.id)}
          />
        ))}
      </div>
    </section>
  );
}

function EventRow({
  event,
  agentName,
  expanded,
  onToggle
}: {
  event: RuntimeEvent;
  agentName?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const formatted = formatJson(event.payload);
  const error = eventMatchesCategory(event.event_type, "error");
  const ToggleIcon = expanded ? ChevronDown : ChevronRight;
  const sequence = typeof event.payload.sequence_index === "number" ? `Step ${Number(event.payload.sequence_index) + 1}` : null;

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
    <article className={`min-w-0 rounded border p-3 text-sm ${error ? "border-warning bg-red-50" : "border-line bg-panel"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="focus-ring flex min-w-0 items-center gap-2 rounded px-1 py-1 text-left"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <ToggleIcon size={16} className="shrink-0 text-slate-500" />
          {error ? <AlertTriangle size={16} className="shrink-0 text-warning" /> : null}
          <span className="break-words font-semibold">{event.event_type}</span>
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {sequence ? <span className="rounded bg-white px-2 py-1">{sequence}</span> : null}
          <span className="rounded bg-white px-2 py-1">{agentName ?? (event.agent_id ? `Agent ${event.agent_id}` : "Workflow")}</span>
          {event.created_at ? <span className="rounded bg-white px-2 py-1">{formatDate(event.created_at)}</span> : null}
          <button type="button" className="focus-ring rounded border border-line bg-white px-2 py-1" onClick={onToggle}>
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="focus-ring inline-flex items-center gap-1 rounded border border-line bg-white px-2 py-1 text-xs text-slate-700"
              onClick={copyJson}
            >
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <pre className="max-h-96 max-w-full overflow-auto whitespace-pre-wrap break-words rounded bg-white p-3 text-xs leading-5 text-slate-700">
            {formatted}
          </pre>
        </div>
      ) : null}
    </article>
  );
}

function eventMatchesCategory(eventType: string, category: EventCategory): boolean {
  if (category === "all") {
    return true;
  }
  const type = eventType.toLowerCase();
  if (category === "error") {
    return type.includes("error") || type.includes("failed") || type.includes("denied");
  }
  if (category === "context") {
    return type.includes("context");
  }
  if (category === "memory") {
    return type.includes("memory");
  }
  if (category === "llm") {
    return type.startsWith("llm_");
  }
  if (category === "tool") {
    return type.startsWith("tool_") || type.includes("tool_call");
  }
  if (category === "learning") {
    return type.includes("learning") || type.includes("feedback") || type.includes("evaluation") || type.includes("reflection");
  }
  return type.startsWith("run_") || type.startsWith("workflow_") || type.startsWith("agent_") || type.includes("handoff");
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
