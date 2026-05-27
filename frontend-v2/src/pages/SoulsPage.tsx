import { zodResolver } from "@hookform/resolvers/zod";
import { Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Soul } from "@/lib/types";

const soulSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  principles: z.string().optional(),
  decision_style: z.string().optional(),
  collaboration_style: z.string().optional(),
  failure_handling_style: z.string().optional(),
  escalation_style: z.string().optional()
});

type SoulFormValues = z.infer<typeof soulSchema>;

const emptySoul: SoulFormValues = {
  name: "",
  description: "",
  principles: "",
  decision_style: "",
  collaboration_style: "",
  failure_handling_style: "",
  escalation_style: ""
};

export function SoulsPage() {
  const [souls, setSouls] = useState<Soul[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Soul | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setSouls(await api.listSouls());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load souls.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function deleteSoul() {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await api.deleteSoul(pendingDelete.id);
      setMessage("Soul deleted.");
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete soul.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader title="Souls" description="Persona definitions that agents can reference without blending identity and system prompt." actionHref="/souls/new" actionLabel="New soul" />
      <div className="space-y-3">
        {message ? <Alert title="Success" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        {loading ? <Alert title="Loading">Loading souls from the backend.</Alert> : null}
        {!loading && souls.length === 0 ? <EmptyState title="No souls" body="Create a soul to define a reusable agent persona." /> : null}
        <div className="grid gap-3">
          {souls.map((soul) => (
            <Card key={soul.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold">{soul.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{soul.description || "No description"}</p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/souls/${soul.id}`}>
                    <Button type="button" variant="outline" size="sm">
                      <Edit size={15} /> Edit
                    </Button>
                  </Link>
                  <Button type="button" variant="destructive" size="sm" onClick={() => setPendingDelete(soul)}>
                    <Trash2 size={15} /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete soul?"
        description="This permanently deletes the soul if no agents still reference it. If the backend safety check blocks deletion, the error will be shown here."
        confirmLabel="Delete soul"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteSoul}
      />
    </>
  );
}

export function SoulFormPage() {
  const { id } = useParams();
  const soulId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(Boolean(soulId));
  const form = useForm<SoulFormValues>({ resolver: zodResolver(soulSchema), defaultValues: emptySoul });

  useEffect(() => {
    if (!soulId) {
      return;
    }
    setLoading(true);
    api
      .getSoul(soulId)
      .then((soul) => form.reset(toSoulFormValues(soul)))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load soul."))
      .finally(() => setLoading(false));
  }, [form, soulId]);

  async function submit(values: SoulFormValues) {
    setError("");
    setMessage("");
    try {
      if (soulId) {
        await api.updateSoul(soulId, values);
        setMessage("Soul saved.");
      } else {
        const created = await api.createSoul(values);
        navigate(`/souls/${created.id}`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save soul.");
    }
  }

  return (
    <>
      <PageHeader title={soulId ? "Edit Soul" : "New Soul"} description="Use souls for persona style and principles. Operational instructions stay on the agent." />
      <form className="max-w-3xl space-y-4" onSubmit={form.handleSubmit(submit)}>
        {message ? <Alert title="Saved" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        {loading ? <Alert title="Loading">Loading soul details.</Alert> : null}
        <FormField label="Name" error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} />
        </FormField>
        <FormField label="Description">
          <Textarea {...form.register("description")} />
        </FormField>
        <FormField label="Principles">
          <Textarea {...form.register("principles")} />
        </FormField>
        <FormField label="Decision style">
          <Textarea {...form.register("decision_style")} />
        </FormField>
        <FormField label="Collaboration style">
          <Textarea {...form.register("collaboration_style")} />
        </FormField>
        <FormField label="Failure handling style">
          <Textarea {...form.register("failure_handling_style")} />
        </FormField>
        <FormField label="Escalation style">
          <Textarea {...form.register("escalation_style")} />
        </FormField>
        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save soul"}</Button>
          <Link to="/souls">
            <Button type="button" variant="outline">Back to souls</Button>
          </Link>
        </div>
      </form>
    </>
  );
}

function toSoulFormValues(soul: Soul): SoulFormValues {
  return {
    name: soul.name,
    description: soul.description ?? "",
    principles: soul.principles ?? "",
    decision_style: soul.decision_style ?? "",
    collaboration_style: soul.collaboration_style ?? "",
    failure_handling_style: soul.failure_handling_style ?? "",
    escalation_style: soul.escalation_style ?? ""
  };
}
