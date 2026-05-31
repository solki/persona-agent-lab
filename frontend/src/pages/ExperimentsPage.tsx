import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Edit, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FieldHelp } from "@/components/shared/FieldHelp";
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
import type { Agent, Experiment, ExperimentRun, Soul, SoulComparisonResult, Workflow } from "@/lib/types";
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
  const [souls, setSouls] = useState<Soul[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [experimentRun, setExperimentRun] = useState<ExperimentRun | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [experimentType, setExperimentType] = useState<"standard" | "soul_behavior_comparison">("standard");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);
  const [selectedSoulIds, setSelectedSoulIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const form = useForm<ExperimentFormValues>({ resolver: zodResolver(experimentSchema), defaultValues: emptyExperiment });

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const [agentData, soulData, workflowData] = await Promise.all([api.listAgents(), api.listSouls(), api.listWorkflows()]);
        setAgents(agentData);
        setSouls(soulData);
        setWorkflows(workflowData);
        if (experimentId) {
          const experimentData = await api.getExperiment(experimentId);
          setExperiment(experimentData);
          setSelectedAgentIds(experimentData.agent_ids);
          form.reset(toExperimentFormValues(experimentData));
          const evalCfg = experimentData.evaluation_config as Record<string, unknown>;
          if (evalCfg?.experiment_type === "soul_behavior_comparison") {
            setExperimentType("soul_behavior_comparison");
            setSelectedWorkflowId((evalCfg.workflow_id as number) ?? null);
            setSelectedSupervisorId((evalCfg.supervisor_agent_id as number) ?? null);
            setSelectedSoulIds((evalCfg.soul_ids as number[]) ?? []);
          }
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load experiment.");
      }
    }
    void load();
  }, [experimentId, form]);

  const agentById = useMemo(() => Object.fromEntries(agents.map((agent) => [agent.id, agent.name])), [agents]);
  const soulById = useMemo(() => Object.fromEntries(souls.map((s) => [s.id, s.name])), [souls]);

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.id === selectedWorkflowId),
    [workflows, selectedWorkflowId]
  );
  const workflowGraph = (selectedWorkflow?.graph_config ?? {}) as Record<string, unknown>;
  const workflowSupervisorId = typeof workflowGraph.supervisor_agent_id === "number" ? workflowGraph.supervisor_agent_id : null;
  const workflowWorkerIds: number[] = Array.isArray(workflowGraph.worker_agent_ids) ? workflowGraph.worker_agent_ids.filter((id): id is number => typeof id === "number") : [];

  // Auto-populate supervisor from workflow config
  useEffect(() => {
    if (workflowSupervisorId !== null && selectedSupervisorId !== workflowSupervisorId && !experimentId) {
      setSelectedSupervisorId(workflowSupervisorId);
    }
  }, [workflowSupervisorId, selectedSupervisorId, experimentId]);

  function toggleAgent(agentId: number) {
    setSelectedAgentIds((current) => current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]);
  }

  function toggleSoul(soulId: number) {
    setSelectedSoulIds((current) => current.includes(soulId) ? current.filter((id) => id !== soulId) : [...current, soulId]);
  }

  async function submit(values: ExperimentFormValues) {
    setError("");
    setMessage("");
    let evaluationConfig: Record<string, unknown>;
    try {
      evaluationConfig = parseJsonObject(values.evaluationConfigJson, "Evaluation config");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid evaluation config JSON.");
      return;
    }

    if (experimentType === "soul_behavior_comparison") {
      if (!selectedWorkflowId) { setError("Select a supervisor workflow."); return; }
      if (!selectedSupervisorId) { setError("Select a supervisor agent."); return; }
      if (selectedSoulIds.length < 2) { setError("Select at least two souls to compare."); return; }
      evaluationConfig.experiment_type = "soul_behavior_comparison";
      evaluationConfig.workflow_id = selectedWorkflowId;
      evaluationConfig.supervisor_agent_id = selectedSupervisorId;
      evaluationConfig.soul_ids = selectedSoulIds;
    } else {
      if (selectedAgentIds.length < 2) { setError("Select at least two agents for an experiment."); return; }
    }

    try {
      const created = await api.createExperiment({
        name: values.name,
        description: values.description,
        task_prompt: values.task_prompt,
        agent_ids: experimentType === "soul_behavior_comparison" ? workflowWorkerIds : selectedAgentIds,
        evaluation_config: evaluationConfig
      });
      navigate(`/experiments/${created.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save experiment.");
    }
  }

  async function runExperiment() {
    if (!experimentId) return;
    setRunning(true);
    setError("");
    try {
      const result = await api.runExperiment(experimentId);
      setExperimentRun(result);
      setMessage(`Experiment run completed — ${result.run_ids.length} variant(s).`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run experiment.");
    } finally {
      setRunning(false);
    }
  }

  const isSoulComp = experimentType === "soul_behavior_comparison";

  return (
    <>
      <PageHeader title={experimentId ? "Experiment Detail" : "New Experiment"} description={isSoulComp ? "Compare how different supervisor souls affect coordination behavior on the same task." : "Select agents by name and preserve related workflow runs when archiving experiment history."} />
      <div className="space-y-4">
        {message ? <Alert title="Experiment" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <Card>
          <CardHeader><h2 className="text-base font-semibold">Configuration</h2></CardHeader>
          <CardContent>
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
              <FormField label="Name" error={form.formState.errors.name?.message}><Input {...form.register("name")} disabled={Boolean(experimentId)} /></FormField>
              <FormField label="Experiment type" help={<FieldHelp pattern="tooltip" content="Standard: compare individual agents on the same task. Soul Behavior Comparison: run the same supervisor workflow with different souls on the supervisor agent." />}>
                <Select value={experimentType} onChange={(e) => setExperimentType(e.target.value as typeof experimentType)} disabled={Boolean(experimentId)}>
                  <option value="standard">Standard (agent comparison)</option>
                  <option value="soul_behavior_comparison">Soul Behavior Comparison</option>
                </Select>
              </FormField>
              <FormField label="Description"><Textarea {...form.register("description")} disabled={Boolean(experimentId)} /></FormField>

              {isSoulComp ? (
                <>
                  <div className="lg:col-span-2">
                    <FormField label="Supervisor workflow" help={<FieldHelp pattern="tooltip" content="The supervisor workflow to run. Workers and task stay the same; only the supervisor's soul changes." />}>
                      <Select value={selectedWorkflowId ?? ""} onChange={(e) => { const v = e.target.value; setSelectedWorkflowId(v ? Number(v) : null); setSelectedSupervisorId(null); }} disabled={Boolean(experimentId)}>
                        <option value="">Select a workflow...</option>
                        {workflows.filter((w) => w.workflow_type === "supervisor").map((w) => <option key={w.id} value={w.id}>{w.name} (id={w.id})</option>)}
                      </Select>
                    </FormField>
                  </div>
                  {selectedWorkflowId && workflowSupervisorId ? (
                    <div className="lg:col-span-2">
                      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
                        <p><span className="text-muted-foreground">Supervisor:</span> {agentById[workflowSupervisorId] ?? `Agent ${workflowSupervisorId}`} (id={workflowSupervisorId})</p>
                        <p><span className="text-muted-foreground">Workers:</span> {workflowWorkerIds.map((wid) => agentById[wid] ?? `Agent ${wid}`).join(", ")}</p>
                        <p className="text-xs text-muted-foreground">Only the supervisor's soul will change between variants. Workers, task, and workflow stay constant.</p>
                      </div>
                    </div>
                  ) : null}
                  <div className="lg:col-span-2">
                    <FormField label="Souls to compare" help={<FieldHelp pattern="tooltip" content="Select 2 or more souls. The supervisor will be run once with each soul. Choose souls with different decision styles to see behavioral differences." />}>
                      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
                        {souls.map((soul) => (
                          <label key={soul.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={selectedSoulIds.includes(soul.id)} disabled={Boolean(experimentId)} onChange={() => toggleSoul(soul.id)} />
                            <span>{soul.name}</span>
                            <StatusBadge status={soul.is_active ? "active" : "inactive"} />
                          </label>
                        ))}
                      </div>
                    </FormField>
                    {selectedSoulIds.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">Selected: {selectedSoulIds.map((sid) => soulById[sid] ?? `Soul ${sid}`).join(", ")}</p> : null}
                  </div>
                </>
              ) : (
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
              )}
              <div className="lg:col-span-2"><FormField label="Task prompt" error={form.formState.errors.task_prompt?.message}><Textarea rows={7} {...form.register("task_prompt")} disabled={Boolean(experimentId)} /></FormField></div>
              <div className="lg:col-span-2"><FormField label="Evaluation config JSON" help={<FieldHelp pattern="popover" title="Evaluation config" content={isSoulComp ? "Auto-populated from the selections above. Contains experiment_type, workflow_id, supervisor_agent_id, and soul_ids." : "Evaluation rubric configuration.\n\nRequired score dimensions: task_completion, persistence, collaboration, evidence_discipline, tool_usage_quality, handoff_quality, customer_readiness, safety, clarity.\n\nEach scored 1-5."} />}><Textarea className="font-mono" rows={6} {...form.register("evaluationConfigJson")} disabled={Boolean(experimentId)} /></FormField></div>
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
            {experimentRun?.comparison_result ? <SoulComparisonView comparison={experimentRun.comparison_result as unknown as SoulComparisonResult} runIds={experimentRun.run_ids} agentById={agentById} /> : null}
          </>
        ) : null}
      </div>
    </>
  );
}

function SoulComparisonView({ comparison, runIds, agentById }: { comparison: SoulComparisonResult; runIds: number[]; agentById: Record<number, string> }) {
  if (comparison.experiment_type !== "soul_behavior_comparison") {
    return null;
  }
  const variants = comparison.variants ?? [];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold">Soul Comparison Results</h2>
        <p className="text-sm text-muted-foreground">
          Supervisor: {comparison.supervisor_agent_name} · {variants.length} variants · <Link to={`/runs/${runIds[0]}`} className="text-primary hover:underline">View first run</Link>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {variants.length === 0 ? <EmptyState title="No variants" body="Run the experiment to see comparison data." /> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Soul</th>
                <th className="py-2 pr-3 font-medium">Run</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Delegations</th>
                <th className="py-2 pr-3 font-medium">Workers Used</th>
                <th className="py-2 pr-3 font-medium">Iterations</th>
                <th className="py-2 pr-3 font-medium">Tokens</th>
                <th className="py-2 pr-3 font-medium">Decision</th>
                <th className="py-2 pr-3 font-medium">Output Preview</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.run_id} className="border-b border-border hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium">{v.soul_name}</td>
                  <td className="py-2 pr-3"><Link to={`/runs/${v.run_id}`} className="text-primary hover:underline">#{v.run_id}</Link></td>
                  <td className="py-2 pr-3"><StatusBadge status={v.status} /></td>
                  <td className="py-2 pr-3">{v.delegation_count}</td>
                  <td className="py-2 pr-3">{v.unique_workers_used}</td>
                  <td className="py-2 pr-3">{v.supervisor_iterations}</td>
                  <td className="py-2 pr-3">{v.total_tokens}</td>
                  <td className="py-2 pr-3">{v.final_decision ?? "-"}</td>
                  <td className="py-2 pr-3 max-w-[200px] truncate text-muted-foreground" title={v.final_output_preview}>{v.final_output_preview.slice(0, 80)}{v.final_output_preview.length > 80 ? "..." : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {variants.map((v) => (
            <Card key={v.run_id}>
              <CardHeader className="pb-1"><h3 className="text-sm font-semibold">{v.soul_name}<span className="ml-2 text-xs text-muted-foreground font-normal">Run #{v.run_id}</span></h3></CardHeader>
              <CardContent className="text-xs space-y-1">
                <p><span className="text-muted-foreground">Worker order:</span> {v.worker_order.length > 0 ? v.worker_order.map((id) => agentById[id] ?? `#${id}`).join(" → ") : "none delegated"}</p>
                {v.avg_instruction_length != null ? <p><span className="text-muted-foreground">Avg instruction length:</span> {Math.round(v.avg_instruction_length)} chars</p> : null}
                <p><span className="text-muted-foreground">Tokens:</span> {v.total_tokens} total</p>
                <div className="flex gap-2 mt-2">
                  <Link to={`/runs/${v.run_id}`}><Button type="button" variant="outline" size="sm">Run Detail</Button></Link>
                  <Link to={`/runs/${v.run_id}/collaboration-graph`}><Button type="button" variant="outline" size="sm">Collaboration</Button></Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
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
