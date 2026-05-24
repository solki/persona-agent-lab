"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Tool } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function ToolRegistry() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [form, setForm] = useState({ name: "tavily_search", description: "", tool_type: "search", config: "{}" });
  const [error, setError] = useState("");

  async function load() {
    try {
      setTools(await api.listTools());
    } catch {
      setError("Unable to reach the backend API.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await api.createTool({
        name: form.name,
        description: form.description,
        tool_type: form.tool_type,
        config: JSON.parse(form.config || "{}")
      });
      setForm({ name: "", description: "", tool_type: "custom", config: "{}" });
      await load();
    } catch {
      setError("Unable to save tool. Check JSON config and backend availability.");
    }
  }

  return (
    <>
      <PageHeader title="Tool Registry" description="Register tools here, then assign them per agent before any Tool Gateway execution can occur." />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="mb-5 grid gap-3 rounded border border-line bg-white p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Name">
            <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Type">
            <input className={inputClass} value={form.tool_type} onChange={(event) => setForm({ ...form, tool_type: event.target.value })} required />
          </Field>
          <Field label="Config JSON">
            <input className={inputClass} value={form.config} onChange={(event) => setForm({ ...form, config: event.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className={inputClass} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
          Register tool
        </button>
      </form>
      <div className="grid gap-3">
        {tools.map((tool) => (
          <div key={tool.id} className="rounded border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{tool.name}</h2>
              <span className="rounded bg-panel px-2 py-1 text-xs">{tool.is_active ? "active" : "inactive"}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{tool.description || tool.tool_type}</p>
          </div>
        ))}
      </div>
    </>
  );
}
