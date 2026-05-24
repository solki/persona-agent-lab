"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentMemory } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function AgentMemoryManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<AgentMemory[]>([]);
  const [form, setForm] = useState({ memory_type: "lesson", content: "", source: "manual", importance: "50" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api.listMemories(agentId));
    } catch {
      setError("Unable to load agent memory.");
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api.createMemory(agentId, { ...form, importance: Number(form.importance), status: "pending" });
    setForm({ memory_type: "lesson", content: "", source: "manual", importance: "50" });
    await load();
  }

  async function review(memoryId: number, action: "approve" | "reject") {
    if (action === "approve") {
      await api.approveMemory(agentId, memoryId);
    } else {
      await api.rejectMemory(agentId, memoryId);
    }
    await load();
  }

  return (
    <section className="rounded border border-line bg-white p-5">
      <h2 className="text-base font-semibold">Agent Memory</h2>
      <p className="mt-1 text-sm text-slate-600">New memory defaults to pending review before becoming active.</p>
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Type">
            <input className={inputClass} value={form.memory_type} onChange={(event) => setForm({ ...form, memory_type: event.target.value })} />
          </Field>
          <Field label="Source">
            <input className={inputClass} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
          </Field>
          <Field label="Importance">
            <input className={inputClass} type="number" min="0" max="100" value={form.importance} onChange={(event) => setForm({ ...form, importance: event.target.value })} />
          </Field>
        </div>
        <Field label="Content">
          <textarea className={inputClass} rows={3} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required />
        </Field>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
          Add pending memory
        </button>
      </form>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-line bg-panel p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{item.memory_type}</strong>
              <span className="rounded bg-white px-2 py-1 text-xs text-slate-600">{item.status}</span>
            </div>
            <p className="mt-1 text-slate-600">{item.content}</p>
            {item.status === "pending" ? (
              <div className="mt-3 flex gap-2">
                <button className="focus-ring rounded bg-success px-3 py-1 text-xs font-medium text-white" onClick={() => review(item.id, "approve")} type="button">
                  Approve
                </button>
                <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium" onClick={() => review(item.id, "reject")} type="button">
                  Reject
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
