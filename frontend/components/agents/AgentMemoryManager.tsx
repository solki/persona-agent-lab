"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentMemory, MemoryStatus } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { StatusMessage } from "@/components/shared/StatusMessage";

const memoryStatuses: MemoryStatus[] = ["pending", "active", "rejected", "archived"];

export function AgentMemoryManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<AgentMemory[]>([]);
  const [form, setForm] = useState({ memory_type: "lesson", content: "", source: "manual", importance: "50", status: "pending" as MemoryStatus });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(form);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.listMemories(agentId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load agent memory.");
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
      await api.createMemory(agentId, { ...form, importance: Number(form.importance) });
      setForm({ memory_type: "lesson", content: "", source: "manual", importance: "50", status: "pending" });
      setMessage("Memory added.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add memory.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(item: AgentMemory) {
    setEditingId(item.id);
    setEditForm({
      memory_type: item.memory_type,
      content: item.content,
      source: item.source ?? "",
      importance: String(item.importance),
      status: item.status
    });
    setError("");
    setMessage("");
  }

  async function saveEdit(memoryId: number) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.updateMemory(agentId, memoryId, { ...editForm, importance: Number(editForm.importance) });
      setEditingId(null);
      setMessage("Memory updated.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update memory.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteMemory(item: AgentMemory) {
    if (!window.confirm(`Delete ${item.memory_type} memory?`)) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.deleteMemory(agentId, item.id);
      setMessage("Memory deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete memory.");
    } finally {
      setLoading(false);
    }
  }

  async function review(memoryId: number, action: "approve" | "reject") {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (action === "approve") {
        await api.approveMemory(agentId, memoryId);
      } else {
        await api.rejectMemory(agentId, memoryId);
      }
      setMessage(action === "approve" ? "Memory approved." : "Memory rejected.");
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review memory.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded border border-line bg-white p-5">
      <h2 className="text-base font-semibold">Agent Memory</h2>
      <p className="mt-1 text-sm text-slate-600">New memory defaults to pending review before becoming active.</p>
      {message ? <StatusMessage title="Saved" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Type">
            <input className={inputClass} value={form.memory_type} onChange={(event) => setForm({ ...form, memory_type: event.target.value })} />
          </Field>
          <Field label="Source">
            <input className={inputClass} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
          </Field>
          <Field label="Importance">
            <input className={inputClass} type="number" min="0" max="100" value={form.importance} onChange={(event) => setForm({ ...form, importance: event.target.value })} />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as MemoryStatus })}>
              {memoryStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Content">
          <textarea className={inputClass} rows={3} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required />
        </Field>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={loading} type="submit">
          {loading ? "Saving..." : "Add memory"}
        </button>
      </form>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-line bg-panel p-3 text-sm">
            {editingId === item.id ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Type">
                    <input className={inputClass} value={editForm.memory_type} onChange={(event) => setEditForm({ ...editForm, memory_type: event.target.value })} />
                  </Field>
                  <Field label="Source">
                    <input className={inputClass} value={editForm.source} onChange={(event) => setEditForm({ ...editForm, source: event.target.value })} />
                  </Field>
                  <Field label="Importance">
                    <input className={inputClass} type="number" min="0" max="100" value={editForm.importance} onChange={(event) => setEditForm({ ...editForm, importance: event.target.value })} />
                  </Field>
                  <Field label="Status">
                    <select className={inputClass} value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as MemoryStatus })}>
                      {memoryStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </Field>
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
                    <strong>{item.memory_type}</strong>
                    <span className={`rounded px-2 py-1 text-xs ${item.status === "active" ? "bg-success text-white" : "bg-white text-slate-600"}`}>
                      {item.status[0].toUpperCase() + item.status.slice(1)}
                    </span>
                    <span className="rounded bg-white px-2 py-1 text-xs text-slate-600">Importance {item.importance}</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium" onClick={() => startEdit(item)} type="button">
                      Edit
                    </button>
                    <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium text-red-700" onClick={() => deleteMemory(item)} type="button">
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Source: {item.source || "none"}
                  {item.last_accessed_at ? ` · Last accessed: ${item.last_accessed_at}` : ""}
                </p>
                <p className="mt-1 text-slate-600">{item.content}</p>
                {item.status === "pending" ? (
                  <div className="mt-3 flex gap-2">
                    <button className="focus-ring rounded bg-success px-3 py-1 text-xs font-medium text-white disabled:opacity-60" disabled={loading} onClick={() => review(item.id, "approve")} type="button">
                      Approve
                    </button>
                    <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium disabled:opacity-60" disabled={loading} onClick={() => review(item.id, "reject")} type="button">
                      Reject
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
