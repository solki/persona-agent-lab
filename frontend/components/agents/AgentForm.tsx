"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

interface AgentFormProps {
  mode: "create" | "edit";
  agentId?: number;
}

const defaultForm = {
  name: "",
  description: "",
  role: "",
  system_prompt: "",
  llm_provider: "mock",
  model: "mock-deterministic",
  temperature: "0.2",
  max_tokens: "1024"
};

export function AgentForm({ mode, agentId }: AgentFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
            llm_provider: agent.llm_provider,
            model: agent.model,
            temperature: String(agent.temperature),
            max_tokens: String(agent.max_tokens)
          })
        )
        .catch(() => setError("Unable to load this agent."));
    }
  }, [agentId, mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      ...form,
      temperature: Number(form.temperature),
      max_tokens: Number(form.max_tokens)
    };
    try {
      const saved: Agent = mode === "create" ? await api.createAgent(payload) : await api.updateAgent(agentId as number, payload);
      setMessage("Agent saved.");
      if (mode === "create") {
        router.push(`/agents/${saved.id}`);
      }
    } catch {
      setError("Unable to save the agent. Check that the backend is running and the fields are valid.");
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
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Provider">
            <select className={inputClass} value={form.llm_provider} onChange={(event) => setForm({ ...form, llm_provider: event.target.value })}>
              <option value="mock">mock</option>
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
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
          Save agent
        </button>
      </form>
    </>
  );
}
