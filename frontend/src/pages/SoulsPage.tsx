import { zodResolver } from "@hookform/resolvers/zod";
import { Edit, Power, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { NoticeDialog } from "@/components/shared/NoticeDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Agent, Soul } from "@/lib/types";

const soulSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  principles: z.string().optional(),
  decision_style: z.string().optional(),
  collaboration_style: z.string().optional(),
  failure_handling_style: z.string().optional(),
  escalation_style: z.string().optional(),
  is_active: z.boolean()
});

type SoulFormValues = z.infer<typeof soulSchema>;

const emptySoul: SoulFormValues = {
  name: "",
  description: "",
  principles: "",
  decision_style: "",
  collaboration_style: "",
  failure_handling_style: "",
  escalation_style: "",
  is_active: true
};

export function SoulsPage() {
  const [souls, setSouls] = useState<Soul[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<{ soul: Soul; action: "delete" | "deactivate" | "activate" } | null>(null);
  const [safetyWarning, setSafetyWarning] = useState("");
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [soulData, agentData] = await Promise.all([api.listSouls(), api.listAgents()]);
      setSouls(soulData);
      setAgents(agentData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load souls.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function applyAction() {
    if (!pendingAction) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      if (pendingAction.action === "delete") {
        await api.deleteSoul(pendingAction.soul.id);
        setMessage("Soul deleted.");
      } else {
        await api.updateSoul(pendingAction.soul.id, { is_active: pendingAction.action === "activate" });
        setMessage(pendingAction.action === "activate" ? "Soul activated." : "Soul deactivated.");
      }
      setPendingAction(null);
      await load();
    } catch (actionError) {
      const messageText = actionError instanceof Error ? actionError.message : "Unable to update soul.";
      setError(messageText);
      setSafetyWarning(messageText);
      setPendingAction(null);
    } finally {
      setWorking(false);
    }
  }

  const soulUsage = useMemo(() => {
    const counts: Record<number, number> = {};
    agents.forEach((agent) => {
      if (agent.soul_id) {
        counts[agent.soul_id] = (counts[agent.soul_id] ?? 0) + 1;
      }
    });
    return counts;
  }, [agents]);

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
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={soul.is_active ? "active" : "inactive"} />
                    {soulUsage[soul.id] ? <span className="text-xs text-muted-foreground">{soulUsage[soul.id]} linked agent(s)</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{soul.description || "No description"}</p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/souls/${soul.id}`}>
                    <Button type="button" variant="outline" size="sm">
                      <Edit size={15} /> Edit
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant={soul.is_active && soulUsage[soul.id] ? "outline" : soul.is_active ? "destructive" : "default"}
                    size="sm"
                    onClick={() => setPendingAction({ soul, action: !soul.is_active ? "activate" : soulUsage[soul.id] ? "deactivate" : "delete" })}
                  >
                    {!soul.is_active ? <RotateCcw size={15} /> : soulUsage[soul.id] ? <Power size={15} /> : <Trash2 size={15} />}
                    {!soul.is_active ? "Activate" : soulUsage[soul.id] ? "Deactivate" : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === "activate" ? "Activate soul?" : pendingAction?.action === "deactivate" ? "Deactivate soul?" : "Delete soul?"}
        description={
          pendingAction?.action === "activate"
            ? "This makes the soul available for new and existing agent configuration."
            : pendingAction?.action === "deactivate"
              ? "This keeps the referenced soul for existing agents but prevents treating it as active reusable configuration."
              : "This permanently deletes the unused soul."
        }
        confirmLabel={pendingAction?.action === "activate" ? "Activate soul" : pendingAction?.action === "deactivate" ? "Deactivate soul" : "Delete soul"}
        destructive={pendingAction?.action !== "activate"}
        loading={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={applyAction}
      />
      <NoticeDialog open={Boolean(safetyWarning)} title="Action blocked" description={safetyWarning} onClose={() => setSafetyWarning("")} />
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("is_active")} />
          Active
        </label>
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
    escalation_style: soul.escalation_style ?? "",
    is_active: soul.is_active
  };
}
