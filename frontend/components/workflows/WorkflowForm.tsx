"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface WorkflowFormProps {
  mode: "create" | "edit";
  workflowId?: number;
}

const defaultForm = {
  name: "",
  description: "",
  workflow_type: "sequential"
};

export function WorkflowForm({ mode, workflowId }: WorkflowFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentSequence, setAgentSequence] = useState<number[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    api.listAgents().then(setAgents).catch(() => setError("Unable to load agents for the workflow picker."));
  }, []);

  useEffect(() => {
    if (mode === "edit" && workflowId) {
      api
        .getWorkflow(workflowId)
        .then((workflow) => {
          const sequence = Array.isArray(workflow.graph_config.agent_sequence)
            ? (workflow.graph_config.agent_sequence as number[])
            : [];
          setForm({
            name: workflow.name,
            description: workflow.description ?? "",
            workflow_type: workflow.workflow_type
          });
          setAgentSequence(sequence);
        })
        .catch(() => setError("Unable to load this workflow."));
    }
  }, [mode, workflowId]);

  function addAgent() {
    if (!selectedAgentId) {
      setError("Select an agent before adding it to the workflow.");
      return;
    }
    const nextAgentId = Number(selectedAgentId);
    setAgentSequence((current) => [...current, nextAgentId]);
    setSelectedAgentId("");
    setError("");
  }

  function removeAgent(index: number) {
    setAgentSequence((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setPendingRemoveIndex(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (agentSequence.length === 0) {
      setError("Add at least one agent to the workflow sequence.");
      return;
    }
    const payload = {
      name: form.name,
      description: form.description,
      workflow_type: form.workflow_type,
      graph_config: { agent_sequence: agentSequence }
    };
    try {
      setSaving(true);
      const saved = mode === "create" ? await api.createWorkflow(payload) : await api.updateWorkflow(workflowId as number, payload);
      setMessage("Workflow saved.");
      if (mode === "create") {
        router.push(`/workflows/${saved.id}`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the workflow. Check that selected agents are valid before running.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkflow() {
    if (!workflowId) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.deleteWorkflow(workflowId);
      router.push("/workflows");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this workflow.");
    } finally {
      setSaving(false);
      setConfirmDeleteOpen(false);
    }
  }

  const selectedAgents = agentSequence.map((agentId) => agents.find((agent) => agent.id === agentId)).filter(Boolean) as Agent[];

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
          <Field label="Available agent">
            <div className="flex gap-2">
              <select className={inputClass} value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <button className="focus-ring shrink-0 rounded border border-line bg-white px-3 py-2 text-sm font-medium" onClick={addAgent} type="button">
                Add
              </button>
            </div>
          </Field>
        </div>
        <section className="rounded border border-line bg-panel p-3">
          <h2 className="text-sm font-semibold">Agent sequence</h2>
          {selectedAgents.length === 0 ? <p className="mt-2 text-sm text-slate-600">No agents selected yet.</p> : null}
          <ol className="mt-2 grid gap-2">
            {selectedAgents.map((agent, index) => (
              <li key={`${agent.id}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-white p-3 text-sm">
                <span>
                  {index + 1}. {agent.name}
                </span>
                <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium" onClick={() => setPendingRemoveIndex(index)} type="button">
                  Remove
                </button>
              </li>
            ))}
          </ol>
        </section>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
            {saving ? "Saving..." : "Save workflow"}
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
        open={pendingRemoveIndex !== null}
        title="Remove agent from sequence?"
        description="Remove this agent from the local workflow sequence? Save the workflow to persist the updated sequence."
        confirmLabel="Remove"
        loading={false}
        variant="warning"
        onCancel={() => setPendingRemoveIndex(null)}
        onConfirm={() => pendingRemoveIndex !== null && removeAgent(pendingRemoveIndex)}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete workflow?"
        description="Delete this workflow? Existing runs must be deleted first, otherwise the backend will block the delete."
        confirmLabel="Delete workflow"
        loading={saving}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={deleteWorkflow}
      />
    </>
  );
}
