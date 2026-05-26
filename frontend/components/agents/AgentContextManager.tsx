"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentContext } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function AgentContextManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<AgentContext[]>([]);
  const [form, setForm] = useState({ title: "", context_type: "note", content: "", priority: "100", is_active: true });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(form);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AgentContext | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.listContexts(agentId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load agent context entries.");
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.createContext(agentId, { ...form, priority: Number(form.priority) });
      setForm({ title: "", context_type: "note", content: "", priority: "100", is_active: true });
      setMessage("Context added.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add context.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(item: AgentContext) {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      context_type: item.context_type,
      content: item.content,
      priority: String(item.priority),
      is_active: item.is_active
    });
    setError("");
    setMessage("");
  }

  async function saveEdit(contextId: number) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.updateContext(agentId, contextId, { ...editForm, priority: Number(editForm.priority) });
      setEditingId(null);
      setMessage("Context updated.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update context.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteContext() {
    if (!pendingDelete) {
      return;
    }
    const item = pendingDelete;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.deleteContext(agentId, item.id);
      setMessage("Context deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete context.");
    } finally {
      setLoading(false);
      setPendingDelete(null);
    }
  }

  return (
    <section className="rounded border border-line bg-white p-5">
      <h2 className="text-base font-semibold">Agent Context</h2>
      <p className="mt-1 text-sm text-slate-600">Context entries are always stored and retrieved through this agent id.</p>
      {message ? <StatusMessage title="Saved" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Title">
            <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </Field>
          <Field label="Type">
            <input className={inputClass} value={form.context_type} onChange={(event) => setForm({ ...form, context_type: event.target.value })} required />
          </Field>
          <Field label="Priority">
            <input className={inputClass} type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} />
          </Field>
          <label className="flex items-center gap-3 rounded border border-line bg-panel px-3 py-2 text-sm">
            <input checked={form.is_active} className="h-4 w-4" onChange={(event) => setForm({ ...form, is_active: event.target.checked })} type="checkbox" />
            <span className="font-medium text-ink">Active</span>
          </label>
        </div>
        <Field label="Content">
          <textarea className={inputClass} rows={3} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required />
        </Field>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={loading} type="submit">
          {loading ? "Saving..." : "Add context"}
        </button>
      </form>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-line bg-panel p-3 text-sm">
            {editingId === item.id ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Title">
                    <input className={inputClass} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} required />
                  </Field>
                  <Field label="Type">
                    <input className={inputClass} value={editForm.context_type} onChange={(event) => setEditForm({ ...editForm, context_type: event.target.value })} required />
                  </Field>
                  <Field label="Priority">
                    <input className={inputClass} type="number" value={editForm.priority} onChange={(event) => setEditForm({ ...editForm, priority: event.target.value })} />
                  </Field>
                  <label className="flex items-center gap-3 rounded border border-line bg-white px-3 py-2 text-sm">
                    <input checked={editForm.is_active} className="h-4 w-4" onChange={(event) => setEditForm({ ...editForm, is_active: event.target.checked })} type="checkbox" />
                    <span className="font-medium text-ink">Active</span>
                  </label>
                </div>
                <Field label="Content">
                  <textarea className={inputClass} rows={3} value={editForm.content} onChange={(event) => setEditForm({ ...editForm, content: event.target.value })} required />
                </Field>
                <div className="flex gap-2">
                  <button className="focus-ring rounded bg-accent px-3 py-1 text-xs font-medium text-white" disabled={loading} onClick={() => saveEdit(item.id)} type="button">
                    Save
                  </button>
                  <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium" onClick={() => setEditingId(null)} type="button">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{item.title}</strong>
                    <span className="rounded bg-white px-2 py-1 text-xs text-slate-600">{item.context_type}</span>
                    <span className={`rounded px-2 py-1 text-xs ${item.is_active ? "bg-success text-white" : "bg-white text-slate-600"}`}>
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium" onClick={() => startEdit(item)} type="button">
                      Edit
                    </button>
                    <button
                      className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                      disabled={loading}
                      onClick={() => setPendingDelete(item)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">Priority {item.priority}</p>
                <p className="mt-1 text-slate-600">{item.content}</p>
              </>
            )}
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete context?"
        description={`Delete "${pendingDelete?.title ?? "this context"}"? Future runs for this agent will no longer retrieve it.`}
        confirmLabel="Delete context"
        loading={loading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteContext}
      />
    </section>
  );
}
