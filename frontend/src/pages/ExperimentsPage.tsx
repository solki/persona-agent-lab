import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Edit, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { JsonCollapse } from "@/components/shared/JsonCollapse";
import { NoticeDialog } from "@/components/shared/NoticeDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Agent, Experiment } from "@/lib/types";
import { parseJsonObject, prettyJson } from "@/lib/utils";

const experimentSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  task_prompt: z.string().min(1, "Task prompt is required"),
  evaluationConfigJson: z.string().min(1, "Evaluation config JSON is required")
});

type ExperimentFormValues = z.infer<typeof experimentSchema>;

const emptyExperiment: ExperimentFormValues = {
  name: "",
  description: "",
  task_prompt: "",
  evaluationConfigJson: "{}"
};

type ExperimentFilter = "active" | "archived" | "all";

export function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [filter, setFilter] = useState<ExperimentFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<{ experiment: Experiment; action: "archive" | "activate" | "delete" } | null>(null);
  const [safetyWarning, setSafetyWarning] = useState("");
  const [forceDeleteTarget, setForceDeleteTarget] = useState<Experiment | null>(null);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setExperiments(await api.listExperiments(true));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load experiments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = experiments.filter((experiment) => {
    const archived = Boolean(experiment.archived_at);
    if (filter === "active") {
      return !archived;
    }
    if (filter === "archived") {
      return archived;
    }
    return true;
  });

  async function applyAction() {
    if (!pendingAction) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      if (pendingAction.action === "archive") {
        const response = await api.archiveExperiment(pendingAction.experiment.id);
        setMessage(response.message);
      } else if (pendingAction.action === "activate") {
        const response = await api.activateExperiment(pendingAction.experiment.id);
        setMessage(response.message);
      } else {
        await api.deleteExperiment(pendingAction.experiment.id);
        setMessage("Experiment deleted.");
      }
      setPendingAction(null);
      await load();
    } catch (actionError) {
      const messageText = actionError instanceof Error ? actionError.message : "Unable to update experiment.";
      const isDeleteBlocked = actionError instanceof ApiError && actionError.status === 409 && pendingAction.action === "delete";
      if (isDeleteBlocked) {
        setSafetyWarning(messageText);
        setForceDeleteTarget(pendingAction.experiment);
        setError("");
      } else {
        setError(messageText);
        setSafetyWarning(messageText);
      }
      setPendingAction(null);
    } finally {
      setWorking(false);
    }
  }

  async function applyForceDelete() {
    if (!forceDeleteTarget) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      await api.deleteExperiment(forceDeleteTarget.id, true);
      setMessage("Experiment and linked runs deleted.");
      setSafetyWarning("");
      setForceDeleteTarget(null);
      await load();
    } catch (actionError) {
      const messageText = actionError instanceof Error ? actionError.message : "Unable to force-delete experiment.";
      setError(messageText);
      setSafetyWarning(messageText);
      setForceDeleteTarget(null);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <PageHeader title="Experiments" description="Compare agents without forcing circular cleanup between experiments and their historical runs." actionHref="/experiments/new" actionLabel="New experiment" />
      <div className="space-y-3">
        {message ? <Alert title="Experiment" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <div className="flex max-w-xs items-center gap-2">
          <span className="text-sm font-medium">Filter</span>
          <Select value={filter} onChange={(event) => setFilter(event.target.value as ExperimentFilter)} aria-label="Experiment filter">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
        </div>
        {loading ? <Alert title="Loading">Loading experiments.</Alert> : null}
        {!loading && filtered.length === 0 ? <EmptyState title="No experiments" body="Create an experiment to compare multiple agents on the same task." /> : null}
        {filtered.map((experiment) => {
          const archived = Boolean(experiment.archived_at);
          return (
            <Card key={experiment.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-base font-semibold">{experiment.name}</h2>
                    <StatusBadge status={archived ? "archived" : "active"} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{experiment.description || "No description"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{experiment.agent_ids.length} agent(s)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/experiments/${experiment.id}`}><Button type="button" variant="outline" size="sm"><Edit size={15} /> Open</Button></Link>
                  {archived ? (
                    <>
                      <Button type="button" size="sm" onClick={() => setPendingAction({ experiment, action: "activate" })}><RotateCcw size={15} /> Activate</Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => setPendingAction({ experiment, action: "delete" })}><Trash2 size={15} /> Delete</Button>
                    </>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => setPendingAction({ experiment, action: "archive" })}><Archive size={15} /> Archive</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === "activate" ? "Activate experiment?" : pendingAction?.action === "archive" ? "Archive experiment?" : "Delete experiment?"}
        description={
          pendingAction?.action === "activate"
            ? "This returns the experiment to the active list without changing related runs."
            : pendingAction?.action === "archive"
              ? "This hides the experiment from the active list while preserving related runs, traces, feedback, and learning records."
              : "Permanently deletes the experiment. If linked runs block deletion, you will be offered a force-delete option that also removes the linked workflow runs."
        }
        confirmLabel={pendingAction?.action === "activate" ? "Activate experiment" : pendingAction?.action === "archive" ? "Archive experiment" : "Delete experiment"}
        destructive={pendingAction?.action !== "activate"}
        loading={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={applyAction}
      />
      <NoticeDialog
        open={Boolean(safetyWarning)}
        title="Action blocked"
        description={safetyWarning}
        actionLabel={forceDeleteTarget ? "Force Delete" : undefined}
        loading={working}
        onAction={forceDeleteTarget ? () => void applyForceDelete() : undefined}
        onClose={() => { setSafetyWarning(""); setForceDeleteTarget(null); }}
      />
    </>
  );
}

export function ExperimentFormPage() {
  const { id } = useParams();
  const experimentId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const form = useForm<ExperimentFormValues>({ resolver: zodResolver(experimentSchema), defaultValues: emptyExperiment });

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const agentData = await api.listAgents();
        setAgents(agentData);
        if (experimentId) {
          const experimentData = await api.getExperiment(experimentId);
          setExperiment(experimentData);
          setSelectedAgentIds(experimentData.agent_ids);
          form.reset(toExperimentFormValues(experimentData));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load experiment.");
      }
    }
    void load();
  }, [experimentId, form]);

  const agentById = useMemo(() => Object.fromEntries(agents.map((agent) => [agent.id, agent.name])), [agents]);

  function toggleAgent(agentId: number) {
    setSelectedAgentIds((current) => current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]);
  }

  async function submit(values: ExperimentFormValues) {
    if (selectedAgentIds.length < 2) {
      setError("Select at least two agents for an experiment.");
      return;
    }
    setError("");
    setMessage("");
    let evaluationConfig: Record<string, unknown>;
    try {
      evaluationConfig = parseJsonObject(values.evaluationConfigJson, "Evaluation config");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid evaluation config JSON.");
      return;
    }
    try {
      const created = await api.createExperiment({
        name: values.name,
        description: values.description,
        task_prompt: values.task_prompt,
        agent_ids: selectedAgentIds,
        evaluation_config: evaluationConfig
      });
      navigate(`/experiments/${created.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save experiment.");
    }
  }

  async function runExperiment() {
    if (!experimentId) {
      return;
    }
    setRunning(true);
    setError("");
    try {
      const result = await api.runExperiment(experimentId);
      setMessage(`Experiment run created with runs ${result.run_ids.join(", ")}.`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run experiment.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader title={experimentId ? "Experiment Detail" : "New Experiment"} description="Select agents by name and preserve related workflow runs when archiving experiment history." />
      <div className="space-y-4">
        {message ? <Alert title="Experiment" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <Card>
          <CardHeader><h2 className="text-base font-semibold">Configuration</h2></CardHeader>
          <CardContent>
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
              <FormField label="Name" error={form.formState.errors.name?.message}><Input {...form.register("name")} disabled={Boolean(experimentId)} /></FormField>
              <FormField label="Description"><Textarea {...form.register("description")} disabled={Boolean(experimentId)} /></FormField>
              <div className="lg:col-span-2">
                <FormField label="Agents">
                  <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
                    {agents.map((agent) => (
                      <label key={agent.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selectedAgentIds.includes(agent.id)} disabled={Boolean(experimentId)} onChange={() => toggleAgent(agent.id)} />
                        <span>{agent.name}</span>
                        <StatusBadge status={agent.is_active ? "active" : "inactive"} />
                      </label>
                    ))}
                  </div>
                </FormField>
                {selectedAgentIds.length > 0 ? <p className="mt-2 text-xs text-muted-foreground">Selected: {selectedAgentIds.map((agentId) => agentById[agentId] ?? `Agent ${agentId}`).join(", ")}</p> : null}
              </div>
              <div className="lg:col-span-2"><FormField label="Task prompt" error={form.formState.errors.task_prompt?.message}><Textarea rows={7} {...form.register("task_prompt")} disabled={Boolean(experimentId)} /></FormField></div>
              <div className="lg:col-span-2"><FormField label="Evaluation config JSON"><Textarea className="font-mono" rows={6} {...form.register("evaluationConfigJson")} disabled={Boolean(experimentId)} /></FormField></div>
              <div className="flex items-end gap-2">
                {!experimentId ? <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save experiment"}</Button> : null}
                <Link to="/experiments"><Button type="button" variant="outline">Back to experiments</Button></Link>
              </div>
            </form>
          </CardContent>
        </Card>
        {experiment ? (
          <>
            <JsonCollapse title="Evaluation config" value={experiment.evaluation_config} />
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Run Experiment</h2></CardHeader>
              <CardContent>
                <Button type="button" onClick={() => void runExperiment()} disabled={running || Boolean(experiment.archived_at)}>
                  <Play size={16} /> {running ? "Running..." : "Run experiment"}
                </Button>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}

function toExperimentFormValues(experiment: Experiment): ExperimentFormValues {
  return {
    name: experiment.name,
    description: experiment.description ?? "",
    task_prompt: experiment.task_prompt,
    evaluationConfigJson: prettyJson(experiment.evaluation_config)
  };
}
