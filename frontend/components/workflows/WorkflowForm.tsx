"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

interface WorkflowFormProps {
  mode: "create" | "edit";
  workflowId?: number;
}

const defaultForm = {
  name: "",
  description: "",
  workflow_type: "sequential",
  agent_sequence: ""
};

function parseAgentSequence(value: string): number[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item));
}

export function WorkflowForm({ mode, workflowId }: WorkflowFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "edit" && workflowId) {
      api
        .getWorkflow(workflowId)
        .then((workflow) => {
          const sequence = Array.isArray(workflow.graph_config.agent_sequence)
            ? (workflow.graph_config.agent_sequence as number[]).join(", ")
            : "";
          setForm({
            name: workflow.name,
            description: workflow.description ?? "",
            workflow_type: workflow.workflow_type,
            agent_sequence: sequence
          });
        })
        .catch(() => setError("Unable to load this workflow."));
    }
  }, [mode, workflowId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      name: form.name,
      description: form.description,
      workflow_type: form.workflow_type,
      graph_config: { agent_sequence: parseAgentSequence(form.agent_sequence) }
    };
    try {
      const saved = mode === "create" ? await api.createWorkflow(payload) : await api.updateWorkflow(workflowId as number, payload);
      setMessage("Workflow saved.");
      if (mode === "create") {
        router.push(`/workflows/${saved.id}`);
      }
    } catch {
      setError("Unable to save the workflow. Check that agent ids are valid before running.");
    }
  }

  return (
    <>
      <PageHeader
        title={mode === "create" ? "New Workflow" : "Edit Workflow"}
        description="Workflow composition is separate from agent definitions. Sequential workflows run agents in the exact order listed here."
      />
      {message ? <StatusMessage title="Saved" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="grid gap-4 rounded border border-line bg-white p-5">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Workflow type">
            <select className={inputClass} value={form.workflow_type} onChange={(event) => setForm({ ...form, workflow_type: event.target.value })}>
              <option value="sequential">sequential</option>
              <option value="supervisor">supervisor placeholder</option>
              <option value="handoff_swarm">handoff swarm placeholder</option>
            </select>
          </Field>
          <Field label="Agent sequence">
            <input
              className={inputClass}
              placeholder="Example: 1, 2, 3"
              value={form.agent_sequence}
              onChange={(event) => setForm({ ...form, agent_sequence: event.target.value })}
            />
          </Field>
        </div>
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
          Save workflow
        </button>
      </form>
    </>
  );
}
