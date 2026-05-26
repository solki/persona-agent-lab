"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Tool } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function ToolRegistry() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [form, setForm] = useState({ name: "tavily_search", description: "", tool_type: "search", config: "{}", is_active: true });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(form);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Tool | null>(null);

  async function load() {
    try {
      setTools(await api.listTools());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to reach the backend API.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function parseConfig(value: string) {
    const parsed = JSON.parse(value || "{}") as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Config JSON must be an object.");
    }
    return parsed as Record<string, unknown>;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.createTool({
        name: form.name,
        description: form.description,
        tool_type: form.tool_type,
        config: parseConfig(form.config),
        is_active: form.is_active
      });
      setForm({ name: "", description: "", tool_type: "custom", config: "{}", is_active: true });
      setMessage("Tool saved.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save tool. Check JSON config and backend availability.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(tool: Tool) {
    setEditingId(tool.id);
    setEditForm({
      name: tool.name,
      description: tool.description ?? "",
      tool_type: tool.tool_type,
      config: JSON.stringify(tool.config ?? {}, null, 2),
      is_active: tool.is_active
    });
    setError("");
    setMessage("");
  }

  async function saveEdit(toolId: number) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.updateTool(toolId, {
        name: editForm.name,
        description: editForm.description,
        tool_type: editForm.tool_type,
        config: parseConfig(editForm.config),
        is_active: editForm.is_active
      });
      setEditingId(null);
      setMessage("Tool updated.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update tool.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTool() {
    if (!pendingDelete) {
      return;
    }
    const tool = pendingDelete;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.deleteTool(tool.id);
      setMessage("Tool deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete tool.");
    } finally {
      setLoading(false);
      setPendingDelete(null);
    }
  }

  return (
    <>
      <PageHeader title="Tool Registry" description="Register tools here, then assign them per agent before any Tool Gateway execution can occur." />
      {message ? <StatusMessage title="Saved" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="mb-5 grid gap-3 rounded border border-line bg-white p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Name">
            <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Type">
            <input className={inputClass} value={form.tool_type} onChange={(event) => setForm({ ...form, tool_type: event.target.value })} required />
          </Field>
          <Field label="Config JSON">
            <textarea className={`${inputClass} font-mono`} rows={3} value={form.config} onChange={(event) => setForm({ ...form, config: event.target.value })} />
          </Field>
          <label className="flex items-center gap-3 rounded border border-line bg-panel px-3 py-2 text-sm">
            <input checked={form.is_active} className="h-4 w-4" onChange={(event) => setForm({ ...form, is_active: event.target.checked })} type="checkbox" />
            <span className="font-medium text-ink">Active</span>
          </label>
        </div>
        <Field label="Description">
          <textarea className={inputClass} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={loading} type="submit">
          {loading ? "Saving..." : "Register tool"}
        </button>
      </form>
      <div className="grid gap-3">
        {tools.map((tool) => (
          <div key={tool.id} className="rounded border border-line bg-white p-4">
            {editingId === tool.id ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Name">
                    <input className={inputClass} value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required />
                  </Field>
                  <Field label="Type">
                    <input className={inputClass} value={editForm.tool_type} onChange={(event) => setEditForm({ ...editForm, tool_type: event.target.value })} required />
                  </Field>
                  <Field label="Config JSON">
                    <textarea className={`${inputClass} font-mono`} rows={4} value={editForm.config} onChange={(event) => setEditForm({ ...editForm, config: event.target.value })} />
                  </Field>
                  <label className="flex items-center gap-3 rounded border border-line bg-panel px-3 py-2 text-sm">
                    <input checked={editForm.is_active} className="h-4 w-4" onChange={(event) => setEditForm({ ...editForm, is_active: event.target.checked })} type="checkbox" />
                    <span className="font-medium text-ink">Active</span>
                  </label>
                </div>
                <Field label="Description">
                  <textarea className={inputClass} rows={2} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
                </Field>
                <div className="flex gap-2">
                  <button className="focus-ring rounded bg-accent px-3 py-1 text-xs font-medium text-white" disabled={loading} onClick={() => saveEdit(tool.id)} type="button">
                    Save
                  </button>
                  <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium" onClick={() => setEditingId(null)} type="button">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{tool.name}</h2>
                    <span className={`rounded px-2 py-1 text-xs ${tool.is_active ? "bg-success text-white" : "bg-panel text-slate-600"}`}>
                      {tool.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium" onClick={() => startEdit(tool)} type="button">
                      Edit
                    </button>
                    <button
                      className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                      disabled={loading}
                      onClick={() => setPendingDelete(tool)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{tool.description || tool.tool_type}</p>
                <pre className="mt-3 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">{JSON.stringify(tool.config, null, 2)}</pre>
              </>
            )}
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete tool?"
        description={`Delete "${pendingDelete?.name ?? "this tool"}"? Agent assignments for this tool will be removed, but agents themselves will be kept.`}
        confirmLabel="Delete tool"
        loading={loading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteTool}
      />
    </>
  );
}
