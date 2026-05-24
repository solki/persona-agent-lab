"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

const sample = {
  name: "Persistent vs Collaborative troubleshooting behaviour",
  description: "Compare deterministic mock responses for troubleshooting style.",
  task_prompt: "Diagnose why a test suite becomes flaky after adding async workflow code.",
  agent_ids: "",
  evaluation_config: JSON.stringify(
    {
      hypothesis: "Different agent personas produce different framing while preserving isolation.",
      rubric: ["clarity", "evidence discipline", "next action", "isolation safety"]
    },
    null,
    2
  )
};

function parseAgentIds(value: string): number[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item));
}

export function ExperimentForm() {
  const router = useRouter();
  const [form, setForm] = useState(sample);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const saved = await api.createExperiment({
        name: form.name,
        description: form.description,
        task_prompt: form.task_prompt,
        agent_ids: parseAgentIds(form.agent_ids),
        evaluation_config: JSON.parse(form.evaluation_config || "{}")
      });
      router.push(`/experiments/${saved.id}`);
    } catch {
      setError("Unable to create experiment. Provide at least two valid agent ids and valid JSON config.");
    }
  }

  return (
    <>
      <PageHeader
        title="New Experiment"
        description="Define the hypothesis, task, selected agents, and evaluation config before running comparison trials."
      />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="grid gap-4 rounded border border-line bg-white p-5">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <Field label="Task prompt">
          <textarea className={inputClass} rows={4} value={form.task_prompt} onChange={(event) => setForm({ ...form, task_prompt: event.target.value })} required />
        </Field>
        <Field label="Agent ids">
          <input
            className={inputClass}
            placeholder="Example: 1, 2"
            value={form.agent_ids}
            onChange={(event) => setForm({ ...form, agent_ids: event.target.value })}
            required
          />
        </Field>
        <Field label="Evaluation config JSON">
          <textarea className={inputClass} rows={8} value={form.evaluation_config} onChange={(event) => setForm({ ...form, evaluation_config: event.target.value })} />
        </Field>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
          Create experiment
        </button>
      </form>
    </>
  );
}
