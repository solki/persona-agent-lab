"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentContext } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function AgentContextManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<AgentContext[]>([]);
  const [form, setForm] = useState({ title: "", context_type: "note", content: "", priority: "100" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api.listContexts(agentId));
    } catch {
      setError("Unable to load agent context entries.");
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api.createContext(agentId, { ...form, priority: Number(form.priority) });
    setForm({ title: "", context_type: "note", content: "", priority: "100" });
    await load();
  }

  return (
    <section className="rounded border border-line bg-white p-5">
      <h2 className="text-base font-semibold">Agent Context</h2>
      <p className="mt-1 text-sm text-slate-600">Context entries are always stored and retrieved through this agent id.</p>
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Title">
            <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </Field>
          <Field label="Type">
            <input className={inputClass} value={form.context_type} onChange={(event) => setForm({ ...form, context_type: event.target.value })} required />
          </Field>
          <Field label="Priority">
            <input className={inputClass} type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} />
          </Field>
        </div>
        <Field label="Content">
          <textarea className={inputClass} rows={3} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required />
        </Field>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
          Add context
        </button>
      </form>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-line bg-panel p-3 text-sm">
            <strong>{item.title}</strong>
            <p className="mt-1 text-slate-600">{item.content}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
