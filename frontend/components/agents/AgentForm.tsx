"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Agent, Soul } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface AgentFormProps {
  mode: "create" | "edit";
  agentId?: number;
  onSaved?: () => void;
}

const defaultForm = {
  name: "",
  description: "",
  role: "",
  system_prompt: "",
  soul_id: "",
  llm_provider: "mock",
  model: "mock-deterministic",
  temperature: "0.2",
  max_tokens: "1024",
  is_active: true,
  memory_policy: JSON.stringify({ write_mode: "manual_review", retrieval_enabled: true }, null, 2),
  context_policy: JSON.stringify({ include_active_context: true }, null, 2),
  handoff_policy: JSON.stringify({ allow_handoff: false, allowed_agent_ids: [] }, null, 2)
};

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error(`${label} must be a JSON object.`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} contains invalid JSON.`);
    }
    throw error;
  }
}

export function AgentForm({ mode, agentId, onSaved }: AgentFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [souls, setSouls] = useState<Soul[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    api.listSouls().then(setSouls).catch(() => setError("Unable to load souls for the selector."));
  }, []);

  useEffect(() => {
    if (mode === "edit" && agentId) {
      api
        .getAgent(agentId)
        .then((agent) =>
          setForm({
            name: agent.name,
            description: agent.description ?? "",
            role: agent.role,
            system_prompt: agent.system_prompt,
            soul_id: agent.soul_id ? String(agent.soul_id) : "",
            llm_provider: agent.llm_provider,
            model: agent.model,
            temperature: String(agent.temperature),
            max_tokens: String(agent.max_tokens),
            is_active: agent.is_active,
            memory_policy: JSON.stringify(agent.memory_policy ?? { write_mode: "manual_review", retrieval_enabled: true }, null, 2),
            context_policy: JSON.stringify(agent.context_policy ?? { include_active_context: true }, null, 2),
            handoff_policy: JSON.stringify(agent.handoff_policy ?? { allow_handoff: false, allowed_agent_ids: [] }, null, 2)
          })
        )
        .catch(() => setError("Unable to load this agent."));
    }
  }, [agentId, mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    let payload;
    try {
      payload = {
        name: form.name,
        description: form.description,
        role: form.role,
        system_prompt: form.system_prompt,
        soul_id: form.soul_id ? Number(form.soul_id) : null,
        llm_provider: form.llm_provider,
        model: form.model,
        temperature: Number(form.temperature),
        max_tokens: Number(form.max_tokens),
        memory_policy: parseJsonObject(form.memory_policy, "Memory policy"),
        context_policy: parseJsonObject(form.context_policy, "Context policy"),
        handoff_policy: parseJsonObject(form.handoff_policy, "Handoff policy"),
        is_active: form.is_active
      };
    } catch (jsonError) {
      setError(jsonError instanceof Error ? jsonError.message : "Policy JSON is invalid.");
      return;
    }
    try {
      setSaving(true);
      const saved: Agent = mode === "create" ? await api.createAgent(payload) : await api.updateAgent(agentId as number, payload);
      setMessage("Agent saved.");
      if (mode === "create") {
        router.push(`/agents/${saved.id}`);
      } else {
        onSaved?.();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the agent. Check that the backend is running and the fields are valid.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent() {
    if (!agentId) {
      return;
    }
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await api.deleteAgent(agentId);
      router.push("/agents");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this agent.");
    } finally {
      setSaving(false);
      setConfirmDeleteOpen(false);
    }
  }

  return (
    <>
      <PageHeader
        title={mode === "create" ? "New Agent" : "Edit Agent"}
        description="Soul/persona is managed separately from the system prompt. This form controls the agent's own model settings and prompt boundary."
      />
      {message ? <StatusMessage title="Saved" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="grid gap-4 rounded border border-line bg-white p-5">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </Field>
        <Field label="Role">
          <input className={inputClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} required />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} />
        </Field>
        <Field label="System prompt">
          <textarea className={inputClass} value={form.system_prompt} onChange={(event) => setForm({ ...form, system_prompt: event.target.value })} rows={5} required />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Soul / persona">
            <select className={inputClass} value={form.soul_id} onChange={(event) => setForm({ ...form, soul_id: event.target.value })}>
              <option value="">No soul selected</option>
              {souls.map((soul) => (
                <option key={soul.id} value={soul.id}>
                  {soul.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-3 rounded border border-line bg-panel px-3 py-2 text-sm">
            <input
              checked={form.is_active}
              className="h-4 w-4"
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              type="checkbox"
            />
            <span className="font-medium text-ink">Agent is active</span>
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Provider">
            <select className={inputClass} value={form.llm_provider} onChange={(event) => setForm({ ...form, llm_provider: event.target.value })}>
              <option value="mock">mock</option>
              <option value="openai_compatible">openai_compatible</option>
              <option value="openai">openai</option>
              <option value="anthropic">anthropic</option>
              <option value="ollama">ollama</option>
            </select>
          </Field>
          <Field label="Model">
            <input className={inputClass} value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
          </Field>
          <Field label="Temperature">
            <input className={inputClass} type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={(event) => setForm({ ...form, temperature: event.target.value })} />
          </Field>
          <Field label="Max tokens">
            <input className={inputClass} type="number" min="1" value={form.max_tokens} onChange={(event) => setForm({ ...form, max_tokens: event.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Memory policy JSON">
            <textarea className={`${inputClass} font-mono`} rows={6} value={form.memory_policy} onChange={(event) => setForm({ ...form, memory_policy: event.target.value })} />
          </Field>
          <Field label="Context policy JSON">
            <textarea className={`${inputClass} font-mono`} rows={6} value={form.context_policy} onChange={(event) => setForm({ ...form, context_policy: event.target.value })} />
          </Field>
          <Field label="Handoff policy JSON">
            <textarea className={`${inputClass} font-mono`} rows={6} value={form.handoff_policy} onChange={(event) => setForm({ ...form, handoff_policy: event.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
            {saving ? "Saving..." : "Save agent"}
          </button>
          {mode === "edit" ? (
            <button
              className="focus-ring w-fit rounded border border-line bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
              disabled={saving}
              onClick={() => setConfirmDeleteOpen(true)}
              type="button"
            >
              Delete
            </button>
          ) : null}
        </div>
      </form>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete agent?"
        description="Delete this agent and its own contexts, memories, proposed memories, and tool assignments. Runs and learning history must be deleted first, otherwise the backend will block the delete."
        confirmLabel="Delete agent"
        loading={saving}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={deleteAgent}
      />
    </>
  );
}
