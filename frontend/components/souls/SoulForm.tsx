"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface SoulFormProps {
  mode: "create" | "edit";
  soulId?: number;
}

const defaultSoul = {
  name: "",
  description: "",
  principles: "",
  decision_style: "",
  collaboration_style: "",
  failure_handling_style: "",
  escalation_style: ""
};

export function SoulForm({ mode, soulId }: SoulFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(defaultSoul);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (mode === "edit" && soulId) {
      api
        .getSoul(soulId)
        .then((soul) =>
          setForm({
            name: soul.name,
            description: soul.description ?? "",
            principles: soul.principles ?? "",
            decision_style: soul.decision_style ?? "",
            collaboration_style: soul.collaboration_style ?? "",
            failure_handling_style: soul.failure_handling_style ?? "",
            escalation_style: soul.escalation_style ?? ""
          })
        )
        .catch(() => setError("Unable to load this soul."));
    }
  }, [mode, soulId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const saved = mode === "create" ? await api.createSoul(form) : await api.updateSoul(soulId as number, form);
      setMessage("Soul saved.");
      if (mode === "create") {
        router.push(`/souls/${saved.id}`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the soul.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSoul() {
    if (!soulId) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.deleteSoul(soulId);
      router.push("/souls");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete the soul.");
    } finally {
      setLoading(false);
      setConfirmDeleteOpen(false);
    }
  }

  return (
    <>
      <PageHeader
        title={mode === "create" ? "New Soul" : "Edit Soul"}
        description="Soul/persona describes how an agent behaves. System prompts remain agent-specific operational instructions."
      />
      {message ? <StatusMessage title="Saved" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submit} className="grid gap-4 rounded border border-line bg-white p-5">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </Field>
        {([
          ["description", "Description"],
          ["principles", "Principles"],
          ["decision_style", "Decision style"],
          ["collaboration_style", "Collaboration style"],
          ["failure_handling_style", "Failure handling style"],
          ["escalation_style", "Escalation style"]
        ] as const).map(([key, label]) => (
          <Field key={key} label={label}>
            <textarea className={inputClass} rows={2} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
          </Field>
        ))}
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={loading} type="submit">
            {loading ? "Saving..." : "Save soul"}
          </button>
          {mode === "edit" ? (
            <button
              className="focus-ring w-fit rounded border border-line bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
              disabled={loading}
              onClick={() => setConfirmDeleteOpen(true)}
              type="button"
            >
              {loading ? "Working..." : "Delete"}
            </button>
          ) : null}
        </div>
      </form>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete soul?"
        description="Delete this soul? Agents using it must be reassigned or deleted first, otherwise the backend will block the delete."
        confirmLabel="Delete soul"
        loading={loading}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={deleteSoul}
      />
    </>
  );
}
