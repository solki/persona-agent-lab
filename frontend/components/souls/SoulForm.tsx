"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Field, inputClass } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

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
    try {
      const saved = mode === "create" ? await api.createSoul(form) : await api.updateSoul(soulId as number, form);
      setMessage("Soul saved.");
      if (mode === "create") {
        router.push(`/souls/${saved.id}`);
      }
    } catch {
      setError("Unable to save the soul.");
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
        <button className="focus-ring w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
          Save soul
        </button>
      </form>
    </>
  );
}
