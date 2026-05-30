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
import { api } from "@/lib/api";
import type { Agent, Workflow } from "@/lib/types";
import { parseJsonObject, prettyJson } from "@/lib/utils";

const workflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  workflow_type: z.enum(["sequential", "supervisor", "handoff_swarm"]),
  graphConfigJson: z.string().min(1, "Graph config JSON is required"),
  is_active: z.boolean()
});

type WorkflowFormValues = z.infer<typeof workflowSchema>;

const emptyWorkflow: WorkflowFormValues = {
  name: "",
  description: "",
  workflow_type: "sequential",
  graphConfigJson: prettyJson({ agent_sequence: [] }),
  is_active: true
};

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runsByWorkflow, setRunsByWorkflow] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<{ workflow: Workflow; action: "deactivate" | "activate" | "delete" } | null>(null);
  const [safetyWarning, setSafetyWarning] = useState("");
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [workflowData, runData] = await Promise.all([api.listWorkflows(), api.listRuns(true)]);
      const counts: Record<number, number> = {};
      runData.forEach((run) => {
        counts[run.workflow_id] = (counts[run.workflow_id] ?? 0) + 1;
      });
      setWorkflows(workflowData);
      setRunsByWorkflow(counts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load workflows.");
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
        await api.deleteWorkflow(pendingAction.workflow.id);
        setMessage("Workflow deleted.");
      } else {
        await api.updateWorkflow(pendingAction.workflow.id, { is_active: pendingAction.action === "activate" });
        setMessage(pendingAction.action === "activate" ? "Workflow activated." : "Workflow deactivated.");
      }
      setPendingAction(null);
      await load();
    } catch (actionError) {
      const messageText = actionError instanceof Error ? actionError.message : "Unable to update workflow.";
      setError(messageText);
      setSafetyWarning(messageText);
      setPendingAction(null);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <PageHeader title="Workflows" description="Create sequential workflows, run them, and keep historical workflow definitions inspectable." actionHref="/workflows/new" actionLabel="New workflow" />
      <div className="space-y-3">
        {message ? <Alert title="Workflow" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        {loading ? <Alert title="Loading">Loading workflows.</Alert> : null}
        {!loading && workflows.length === 0 ? <EmptyState title="No workflows" body="Create a workflow to run selected agents in order." /> : null}
        {workflows.map((workflow) => (
          <Card key={workflow.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-base font-semibold">{workflow.name}</h2>
                  <StatusBadge status={workflow.is_active ? "active" : "inactive"} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{workflow.description || "No description"}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Type: {workflow.workflow_type}
                  {runsByWorkflow[workflow.id] ? ` · ${runsByWorkflow[workflow.id]} historical run(s)` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/workflows/${workflow.id}`}><Button type="button" variant="outline" size="sm"><Edit size={15} /> Open</Button></Link>
                {workflow.is_active ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setPendingAction({ workflow, action: "deactivate" })}>
                    <Archive size={15} /> Deactivate
                  </Button>
                ) : (
                  <>
                    <Button type="button" size="sm" onClick={() => setPendingAction({ workflow, action: "activate" })}><RotateCcw size={15} /> Activate</Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => setPendingAction({ workflow, action: "delete" })}><Trash2 size={15} /> Delete</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === "activate" ? "Activate workflow?" : pendingAction?.action === "deactivate" ? "Deactivate workflow?" : "Delete workflow?"}
        description={
          pendingAction?.action === "activate"
            ? "This makes the workflow selectable for future runs."
            : pendingAction?.action === "deactivate"
              ? "This preserves workflow history while preventing it from being treated as active configuration."
              : "This permanently deletes the inactive workflow only if it has no historical runs."
        }
        confirmLabel={pendingAction?.action === "activate" ? "Activate workflow" : pendingAction?.action === "deactivate" ? "Deactivate workflow" : "Delete workflow"}
        destructive={pendingAction?.action !== "activate"}
        loading={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={applyAction}
      />
      <NoticeDialog open={Boolean(safetyWarning)} title="Action blocked" description={safetyWarning} onClose={() => setSafetyWarning("")} />
    </>
  );
}

export function WorkflowFormPage() {
  const { id } = useParams();
  const workflowId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [supervisorId, setSupervisorId] = useState<number | null>(null);
  const [workerIds, setWorkerIds] = useState<number[]>([]);
  const [maxIterations, setMaxIterations] = useState(10);
  const [task, setTask] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const form = useForm<WorkflowFormValues>({ resolver: zodResolver(workflowSchema), defaultValues: emptyWorkflow });

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const agentData = await api.listAgents();
        setAgents(agentData);
        if (workflowId) {
          const workflowData = await api.getWorkflow(workflowId);
          setWorkflow(workflowData);
          form.reset(toWorkflowFormValues(workflowData));
          setSelectedAgentIds(agentSequence(workflowData.graph_config));
          setSupervisorId(supervisorAgentId(workflowData.graph_config));
          setWorkerIds(workerAgentIds(workflowData.graph_config));
          const maxIter = workflowData.graph_config.max_iterations;
          if (typeof maxIter === "number") setMaxIterations(maxIter);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load workflow.");
      }
    }
    void load();
  }, [form, workflowId]);

  const agentById = useMemo(() => Object.fromEntries(agents.map((agent) => [agent.id, agent.name])), [agents]);

  function toggleAgent(agentId: number) {
    const wfType = form.getValues("workflow_type");
    if (wfType === "supervisor") {
      // Toggle supervisor selection
      setSupervisorId((current) => {
        const next = current === agentId ? null : agentId;
        const config = parseConfigOrDefault(form.getValues("graphConfigJson"), "supervisor");
        config.supervisor_agent_id = next;
        config.worker_agent_ids = workerIds.filter((id) => id !== next);
        if (next !== null && workerIds.includes(next)) {
          setWorkerIds(workerIds.filter((id) => id !== next));
        }
        form.setValue("graphConfigJson", prettyJson(config), { shouldDirty: true });
        return next;
      });
    } else {
      setSelectedAgentIds((current) => {
        const next = current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId];
        const config = parseConfigOrDefault(form.getValues("graphConfigJson"));
        config.agent_sequence = next;
        form.setValue("graphConfigJson", prettyJson(config), { shouldDirty: true });
        return next;
      });
    }
  }

  function toggleWorker(agentId: number) {
    setWorkerIds((current) => {
      const next = current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId];
      const config = parseConfigOrDefault(form.getValues("graphConfigJson"), "supervisor");
      config.worker_agent_ids = next;
      form.setValue("graphConfigJson", prettyJson(config), { shouldDirty: true });
      return next;
    });
  }

  async function submit(values: WorkflowFormValues) {
    setError("");
    setMessage("");
    let graphConfig: Record<string, unknown>;
    try {
      graphConfig = parseJsonObject(values.graphConfigJson, "Graph config");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid graph config JSON.");
      return;
    }
    if (values.workflow_type === "supervisor") {
      if (supervisorId !== null) graphConfig.supervisor_agent_id = supervisorId;
      graphConfig.worker_agent_ids = workerIds;
      if (!graphConfig.max_iterations) graphConfig.max_iterations = maxIterations;
    } else if (selectedAgentIds.length > 0) {
      graphConfig.agent_sequence = selectedAgentIds;
    }
    const payload = {
      name: values.name,
      description: values.description,
      workflow_type: values.workflow_type,
      graph_config: graphConfig,
      is_active: values.is_active
    };
    try {
      if (workflowId) {
        const saved = await api.updateWorkflow(workflowId, payload);
        setWorkflow(saved);
        setMessage("Workflow saved.");
      } else {
        const created = await api.createWorkflow(payload);
        navigate(`/workflows/${created.id}`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save workflow.");
    }
  }

  async function runWorkflow() {
    if (!workflowId) {
      return;
    }
    if (!task.trim()) {
      setError("Enter a task before running the workflow.");
      return;
    }
    setRunning(true);
    setError("");
    try {
      const run = await api.runWorkflow(workflowId, task);
      navigate(`/runs/${run.id}`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run workflow.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader title={workflowId ? "Workflow Detail" : "New Workflow"} description="Use the agent picker for sequential workflow order. The graph config remains visible for backend fidelity." />
      <div className="space-y-4">
        {message ? <Alert title="Workflow" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <Card>
          <CardHeader><h2 className="text-base font-semibold">Configuration</h2></CardHeader>
          <CardContent>
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
              <FormField label="Name" error={form.formState.errors.name?.message}><Input {...form.register("name")} /></FormField>
              <FormField label="Workflow type" help={<FieldHelp pattern="tooltip" content="Execution strategy. sequential: agents run one after another in order. supervisor: a supervisor agent delegates to worker agents. handoff_swarm: agents hand off to each other dynamically based on handoff policy." />}>
                <Select {...form.register("workflow_type")}>
                  <option value="sequential">sequential</option>
                  <option value="supervisor">supervisor</option>
                  <option value="handoff_swarm">handoff_swarm</option>
                </Select>
              </FormField>
              <FormField label="Description"><Textarea {...form.register("description")} /></FormField>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("is_active")} /> Active</label>
              <div className="lg:col-span-2">
                {form.watch("workflow_type") === "supervisor" ? (
                  <>
                    <FormField label="Supervisor agent" help={<FieldHelp pattern="tooltip" content="The agent that coordinates workers. It decides which worker to delegate to and when to finish." />}>
                      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
                        {agents.map((agent) => (
                          <label key={agent.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="supervisor_agent"
                              checked={supervisorId === agent.id}
                              onChange={() => toggleAgent(agent.id)}
                            />
                            <span>{agent.name}</span>
                            <StatusBadge status={agent.is_active ? "active" : "inactive"} />
                          </label>
                        ))}
                      </div>
                    </FormField>
                    {supervisorId ? <p className="mt-1 text-xs text-muted-foreground">Supervisor: {agentById[supervisorId] ?? `Agent ${supervisorId}`}</p> : null}
                    <FormField label="Worker agents" help={<FieldHelp pattern="tooltip" content="Agents the supervisor can delegate tasks to. Select one or more." />}>
                      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
                        {agents.filter((a) => a.id !== supervisorId).map((agent) => (
                          <label key={agent.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={workerIds.includes(agent.id)}
                              onChange={() => toggleWorker(agent.id)}
                              disabled={agent.id === supervisorId}
                            />
                            <span>{agent.name}</span>
                            <StatusBadge status={agent.is_active ? "active" : "inactive"} />
                          </label>
                        ))}
                      </div>
                    </FormField>
                    {workerIds.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">Workers: {workerIds.map((id) => agentById[id] ?? `Agent ${id}`).join(", ")}</p> : null}
                    <FormField label="Max iterations" help={<FieldHelp pattern="tooltip" content="Maximum number of delegation rounds before the run is failed. Default: 10." />}>
                      <Input type="number" min={1} max={50} value={maxIterations} onChange={(e) => { const v = Number(e.target.value); if (v >= 1) { setMaxIterations(v); const config = parseConfigOrDefault(form.getValues("graphConfigJson"), "supervisor"); config.max_iterations = v; form.setValue("graphConfigJson", prettyJson(config), { shouldDirty: true }); } }} />
                    </FormField>
                  </>
                ) : (
                  <>
                    <FormField label="Agent sequence" help={form.watch("workflow_type") === "handoff_swarm" ? <FieldHelp pattern="tooltip" content="Entry agent + participants for handoff swarm. Configure handoff policies per agent." /> : undefined}>
                      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
                        {agents.map((agent) => (
                          <label key={agent.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={selectedAgentIds.includes(agent.id)} onChange={() => toggleAgent(agent.id)} />
                            <span>{agent.name}</span>
                            <StatusBadge status={agent.is_active ? "active" : "inactive"} />
                          </label>
                        ))}
                      </div>
                    </FormField>
                    {selectedAgentIds.length > 0 ? <p className="mt-2 text-xs text-muted-foreground">Order: {selectedAgentIds.map((id) => agentById[id] ?? `Agent ${id}`).join(" -> ")}</p> : null}
                  </>
                )}
              </div>
              <div className="lg:col-span-2"><FormField label="Graph config JSON" help={<FieldHelp pattern="popover" title="Graph config" content="Raw graph configuration sent to the workflow engine. The agent picker above is a convenience — the JSON is the source of truth. Edit directly for advanced configurations not supported by the picker." />}><Textarea className="font-mono" rows={8} {...form.register("graphConfigJson")} /></FormField></div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save workflow"}</Button>
                <Link to="/workflows"><Button type="button" variant="outline">Back to workflows</Button></Link>
              </div>
            </form>
          </CardContent>
        </Card>
        {workflow ? <JsonCollapse title="Saved graph config" value={workflow.graph_config} /> : null}
        {workflowId ? (
          <Card>
            <CardHeader><h2 className="text-base font-semibold">Run Workflow</h2></CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={6} value={task} onChange={(event) => setTask(event.target.value)} placeholder="Describe the task for this workflow." />
              <Button type="button" onClick={() => void runWorkflow()} disabled={running}>
                <Play size={16} /> {running ? "Running..." : "Run workflow"}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function toWorkflowFormValues(workflow: Workflow): WorkflowFormValues {
  return {
    name: workflow.name,
    description: workflow.description ?? "",
    workflow_type: workflow.workflow_type as WorkflowFormValues["workflow_type"],
    graphConfigJson: prettyJson(workflow.graph_config),
    is_active: workflow.is_active
  };
}

function agentSequence(config: Record<string, unknown>) {
  const sequence = config.agent_sequence;
  return Array.isArray(sequence) ? sequence.filter((id): id is number => typeof id === "number") : [];
}

function supervisorAgentId(config: Record<string, unknown>): number | null {
  const id = config.supervisor_agent_id;
  return typeof id === "number" ? id : null;
}

function workerAgentIds(config: Record<string, unknown>): number[] {
  const ids = config.worker_agent_ids;
  return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === "number") : [];
}

function parseConfigOrDefault(value: string, workflowType?: string) {
  try {
    const parsed = parseJsonObject(value, "Graph config");
    if (workflowType === "supervisor" && !parsed.worker_agent_ids) {
      parsed.worker_agent_ids = [];
    }
    return parsed;
  } catch {
    return workflowType === "supervisor" ? { supervisor_agent_id: null, worker_agent_ids: [], max_iterations: 10 } : { agent_sequence: [] };
  }
}
