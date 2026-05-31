import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronRight, Edit, Power, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FieldHelp } from "@/components/shared/FieldHelp";
import { FormField } from "@/components/shared/FormField";
import { NoticeDialog } from "@/components/shared/NoticeDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Agent, AgentContext, AgentMemory, BlockingRun, MemoryStatus, ProposedMemory, Soul, Tool } from "@/lib/types";
import { useNotification } from "@/lib/NotificationContext";
import { parseJsonObject, prettyJson } from "@/lib/utils";

const providers = ["mock", "openai_compatible", "openai", "anthropic", "ollama"] as const;

const agentSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  role: z.string().min(1, "Role is required").max(120),
  system_prompt: z.string().min(1, "System prompt is required"),
  soul_id: z.string(),
  llm_provider: z.enum(providers),
  model: z.string().min(1, "Model is required"),
  temperature: z.coerce.number().min(0).max(2),
  max_tokens: z.coerce.number().int().min(1).max(200000),
  memoryPolicyJson: z.string().min(1),
  contextPolicyJson: z.string().min(1),
  is_active: z.boolean()
});

type AgentFormValues = z.infer<typeof agentSchema>;

const defaultAgent: AgentFormValues = {
  name: "",
  description: "",
  role: "",
  system_prompt: "",
  soul_id: "",
  llm_provider: "mock",
  model: "mock-deterministic",
  temperature: 0.2,
  max_tokens: 1024,
  memoryPolicyJson: prettyJson({ write_mode: "manual_review", retrieval_enabled: true }),
  contextPolicyJson: prettyJson({ include_active_context: true }),
  is_active: true
};

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [souls, setSouls] = useState<Soul[]>([]);
  const [notificationCounts, setNotificationCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<{ agent: Agent; action: "delete" | "deactivate" | "activate" } | null>(null);
  const [safetyWarning, setSafetyWarning] = useState("");
  const [blockingRuns, setBlockingRuns] = useState<BlockingRun[]>([]);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [agentData, soulData, notifications] = await Promise.all([
        api.listAgents(),
        api.listSouls(),
        api.getProposedMemoryNotifications()
      ]);
      setAgents(agentData);
      setSouls(soulData);
      setNotificationCounts(Object.fromEntries(notifications.by_agent.map((item) => [item.agent_id, item.count])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load agents.");
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
        await api.deleteAgent(pendingAction.agent.id);
        setMessage("Agent deleted.");
      } else {
        await api.updateAgent(pendingAction.agent.id, { is_active: pendingAction.action === "activate" });
        setMessage(pendingAction.action === "activate" ? "Agent activated." : "Agent deactivated.");
      }
      setPendingAction(null);
      await load();
    } catch (actionError) {
      const messageText = actionError instanceof Error ? actionError.message : "Unable to update agent.";
      setError(messageText);
      if (pendingAction.action === "delete" && actionError instanceof ApiError && Array.isArray(actionError.body?.blocking_runs)) {
        setBlockingRuns(actionError.body.blocking_runs as BlockingRun[]);
      } else {
        setSafetyWarning(messageText);
      }
      setPendingAction(null);
    } finally {
      setWorking(false);
    }
  }

  const soulById = useMemo(() => Object.fromEntries(souls.map((soul) => [soul.id, soul])), [souls]);

  return (
    <>
      <PageHeader title="Agents" description="Configure isolated agents with explicit soul, model, active state, and policy JSON." actionHref="/agents/new" actionLabel="New agent" />
      <div className="space-y-3">
        {message ? <Alert title="Success" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        {loading ? <Alert title="Loading">Loading agents.</Alert> : null}
        {!loading && agents.length === 0 ? <EmptyState title="No agents" body="Create an agent to validate the v2 configuration flow." /> : null}
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-base font-semibold">{agent.name}</h2>
                  <StatusBadge status={agent.is_active ? "active" : "inactive"} />
                  {notificationCounts[agent.id] ? (
                    <span aria-label="Pending feedback memory approval" className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/30">
                      {notificationCounts[agent.id]}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{agent.description || agent.role}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {agent.llm_provider}:{agent.model} · Soul:{" "}
                  {agent.soul_id && soulById[agent.soul_id]
                    ? `${soulById[agent.soul_id].name}${soulById[agent.soul_id].is_active ? "" : " (inactive)"}`
                    : agent.soul_id
                      ? `#${agent.soul_id}`
                      : "None"}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/agents/${agent.id}`}>
                  <Button type="button" variant="outline" size="sm"><Edit size={15} /> Open</Button>
                </Link>
                {agent.is_active ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setPendingAction({ agent, action: "deactivate" })}>
                    <Power size={15} /> Deactivate
                  </Button>
                ) : (
                  <>
                    <Button type="button" size="sm" onClick={() => setPendingAction({ agent, action: "activate" })}>
                      <RotateCcw size={15} /> Activate
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => setPendingAction({ agent, action: "delete" })}>
                      <Trash2 size={15} /> Delete
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === "activate" ? "Activate agent?" : pendingAction?.action === "deactivate" ? "Deactivate agent?" : "Delete agent?"}
        description={
          pendingAction?.action === "activate"
            ? "This makes the agent available for workflows again."
            : pendingAction?.action === "deactivate"
              ? "This preserves the agent and its history while preventing future workflow selection as active configuration."
              : "This permanently deletes the inactive agent only if backend safety checks confirm it has no protected history."
        }
        confirmLabel={pendingAction?.action === "activate" ? "Activate agent" : pendingAction?.action === "deactivate" ? "Deactivate agent" : "Delete agent"}
        destructive={pendingAction?.action !== "activate"}
        loading={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={applyAction}
      />
      <NoticeDialog open={Boolean(safetyWarning)} title="Action blocked" description={safetyWarning} onClose={() => setSafetyWarning("")} />
      <NoticeDialog
        open={blockingRuns.length > 0}
        title="Cannot delete agent"
        description="This agent has runtime history in the following runs. Archive and deactivate the agent instead, or delete the runs first."
        onClose={() => setBlockingRuns([])}
      >
        <div className="mt-3 space-y-2">
          {blockingRuns.map((run) => (
            <Link key={run.run_id} to={`/runs/${run.run_id}`} onClick={() => setBlockingRuns([])} className="block rounded-sm border border-border bg-card p-3 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Run {run.run_id}</span>
                <StatusBadge status={run.status} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{run.workflow_name}</div>
            </Link>
          ))}
        </div>
      </NoticeDialog>
    </>
  );
}

export function AgentFormPage() {
  return <AgentEditor mode="create" />;
}

export function AgentDetailPage() {
  const { id } = useParams();
  const agentId = Number(id);
  return <AgentEditor mode="edit" agentId={agentId} />;
}

function AgentEditor({ mode, agentId }: { mode: "create" | "edit"; agentId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [souls, setSouls] = useState<Soul[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [allowHandoff, setAllowHandoff] = useState(false);
  const [allowedAgentIds, setAllowedAgentIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [memoryRefreshKey, setMemoryRefreshKey] = useState(0);
  const form = useForm<AgentFormValues>({ resolver: zodResolver(agentSchema), defaultValues: defaultAgent });

  // Scroll to proposed memories section when navigated via hash link
  useEffect(() => {
    if (location.hash === "#proposed-memories") {
      const el = document.getElementById("proposed-memories");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [location.hash]);

  const load = useCallback(async () => {
    setError("");
    try {
      const [soulData, agentListData] = await Promise.all([api.listSouls(), api.listAgents()]);
      setSouls(soulData);
      setAllAgents(agentListData);
      if (mode === "edit" && agentId) {
        const agentData = await api.getAgent(agentId);
        setAgent(agentData);
        form.reset(toAgentFormValues(agentData));
        // Parse existing handoff policy
        const hp = agentData.handoff_policy as Record<string, unknown> | undefined;
        setAllowHandoff(Boolean(hp?.allow_handoff));
        const ids = hp?.allowed_agent_ids;
        setAllowedAgentIds(Array.isArray(ids) ? ids.filter((id): id is number => typeof id === "number") : []);
      } else {
        setAllowHandoff(false);
        setAllowedAgentIds([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load agent form.");
    }
  }, [agentId, form, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(values: AgentFormValues) {
    setError("");
    setMessage("");
    let memoryPolicy: Record<string, unknown>;
    let contextPolicy: Record<string, unknown>;
    try {
      memoryPolicy = parseJsonObject(values.memoryPolicyJson, "Memory policy");
      contextPolicy = parseJsonObject(values.contextPolicyJson, "Context policy");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid policy JSON.");
      return;
    }
    const handoffPolicy = {
      allow_handoff: allowHandoff,
      allowed_agent_ids: allowHandoff ? allowedAgentIds.filter((id) => id !== agentId) : [],
    };
    const payload = {
      name: values.name,
      description: values.description,
      role: values.role,
      system_prompt: values.system_prompt,
      soul_id: values.soul_id ? Number(values.soul_id) : null,
      llm_provider: values.llm_provider,
      model: values.model,
      temperature: values.temperature,
      max_tokens: values.max_tokens,
      memory_policy: memoryPolicy,
      context_policy: contextPolicy,
      handoff_policy: handoffPolicy,
      is_active: values.is_active
    };
    try {
      if (mode === "edit" && agentId) {
        const saved = await api.updateAgent(agentId, payload);
        setAgent(saved);
        setMessage("Agent saved.");
      } else {
        const created = await api.createAgent(payload);
        navigate(`/agents/${created.id}`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save agent.");
    }
  }

  return (
    <>
      <PageHeader
        title={mode === "edit" ? "Agent Detail" : "New Agent"}
        description="Edit configuration and, on saved agents, manage agent-scoped context, memory, and proposed memory review."
      />
      <div className="space-y-4">
        {message ? <Alert title="Saved" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Configuration</h2>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
              <FormField label="Name" error={form.formState.errors.name?.message}>
                <Input {...form.register("name")} />
              </FormField>
              <FormField label="Role" error={form.formState.errors.role?.message}>
                <Input {...form.register("role")} />
              </FormField>
              <FormField label="Description">
                <Textarea {...form.register("description")} />
              </FormField>
              <FormField label="Soul">
                <Select {...form.register("soul_id")}>
                  <option value="">No soul</option>
                  {souls
                    .filter((soul) => soul.is_active || soul.id === agent?.soul_id)
                    .map((soul) => (
                      <option key={soul.id} value={soul.id}>{soul.name}{soul.is_active ? "" : " (inactive)"}</option>
                    ))}
                </Select>
              </FormField>
              <FormField label="Provider">
                <Select {...form.register("llm_provider")}>
                  {providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                </Select>
              </FormField>
              <FormField label="Model" help={<FieldHelp pattern="tooltip" content="Model identifier for the selected provider. For mock: use mock-deterministic. For Ollama: use the model tag (e.g. llama3:8b). For OpenAI-compatible: use the API model name." />}>
                <Input {...form.register("model")} />
              </FormField>
              <FormField label="Temperature" help={<FieldHelp pattern="tooltip" content="Controls output randomness. 0 = deterministic, predictable responses. 1 = balanced creativity. 2 = maximum variability. Lower values are safer for task-execution agents." />}>
                <Input type="number" step="0.1" {...form.register("temperature")} />
              </FormField>
              <FormField label="Max tokens" help={<FieldHelp pattern="tooltip" content="Maximum tokens the agent can generate in a single response. Higher values allow longer outputs but increase cost and latency. 1024-4096 is typical for task agents." />}>
                <Input type="number" {...form.register("max_tokens")} />
              </FormField>
              <FormField label="System prompt">
                <Textarea rows={5} {...form.register("system_prompt")} />
              </FormField>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...form.register("is_active")} />
                  Active
                </label>
                {agent ? <StatusBadge status={agent.is_active ? "active" : "inactive"} /> : null}
              </div>
              <FormField label="Memory policy JSON" help={<FieldHelp pattern="popover" title="Memory policy" content={'Controls how the agent manages memory.\n\nwrite_mode:\n- "manual_review" — proposed memories need approval\n- "auto" — auto-save memories\n- "off" — memory disabled\n\nretrieval_enabled: whether the agent can recall past memories at runtime.'} />}>
                <Textarea className="font-mono" rows={6} {...form.register("memoryPolicyJson")} />
              </FormField>
              <FormField label="Context policy JSON" help={<FieldHelp pattern="popover" title="Context policy" content="Controls which context entries are assembled at runtime.\n\ninclude_active_context: when true, all active context entries for this agent are included in the prompt.\n\nFuture: filter by type, priority threshold, etc." />}>
                <Textarea className="font-mono" rows={6} {...form.register("contextPolicyJson")} />
              </FormField>
              <div className="lg:col-span-2 space-y-3 rounded-md border border-border p-4">
                <h3 className="text-sm font-semibold">Handoff policy</h3>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={allowHandoff} onChange={(e) => { setAllowHandoff(e.target.checked); if (!e.target.checked) setAllowedAgentIds([]); }} />
                  Allow handoff
                </label>
                {allowHandoff ? (
                  <FormField label="Allowed target agents" help={<FieldHelp pattern="tooltip" content="Select which agents this agent may hand off to. This is an allowed target pool, not an execution order. Current agent is excluded." />}>
                    <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2 max-h-48 overflow-y-auto">
                      {allAgents.filter((a) => mode !== "edit" || a.id !== agentId).map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={allowedAgentIds.includes(a.id)}
                            onChange={() => {
                              setAllowedAgentIds((current) =>
                                current.includes(a.id) ? current.filter((id) => id !== a.id) : [...current, a.id]
                              );
                            }}
                          />
                          <span>{a.name}</span>
                          <span className="text-xs text-muted-foreground">{a.role}</span>
                          <StatusBadge status={a.is_active ? "active" : "inactive"} />
                        </label>
                      ))}
                    </div>
                  </FormField>
                ) : null}
                {allowHandoff && allowedAgentIds.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Allowed targets: {allowedAgentIds.map((id) => allAgents.find((a) => a.id === id)?.name ?? `Agent ${id}`).join(", ")}
                  </p>
                ) : null}
                {allowHandoff && allowedAgentIds.length === 0 ? (
                  <p className="text-xs text-amber-600">No target agents selected. This agent will not be able to hand off to anyone even though handoff is enabled.</p>
                ) : null}
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save agent"}</Button>
                <Link to="/agents"><Button type="button" variant="outline">Back to agents</Button></Link>
              </div>
            </form>
          </CardContent>
        </Card>
        {mode === "edit" && agentId ? (
          <>
            <ContextManager agentId={agentId} />
            <MemoryManager agentId={agentId} refreshKey={memoryRefreshKey} />
            <ToolAssignmentManager agentId={agentId} />
            <ProposedMemoryManager agentId={agentId} onMemoryChanged={() => setMemoryRefreshKey((k) => k + 1)} />
          </>
        ) : null}
      </div>
    </>
  );
}

function ContextManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<AgentContext[]>([]);
  const [editing, setEditing] = useState<AgentContext | null>(null);
  const [pendingAction, setPendingAction] = useState<{ item: AgentContext; action: "deactivate" | "activate" | "delete" } | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const form = useForm({ defaultValues: { title: "", context_type: "note", content: "", priority: 100, is_active: true } });

  const load = useCallback(async () => {
    setItems(await api.listContexts(agentId));
  }, [agentId]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load contexts."));
  }, [load]);

  function edit(item: AgentContext) {
    setEditing(item);
    form.reset(item);
  }

  async function submit(values: { title: string; context_type: string; content: string; priority: number; is_active: boolean }) {
    setError("");
    try {
      if (editing) {
        await api.updateContext(agentId, editing.id, values);
        setMessage("Context saved.");
      } else {
        await api.createContext(agentId, values);
        setMessage("Context created.");
      }
      setEditing(null);
      form.reset({ title: "", context_type: "note", content: "", priority: 100, is_active: true });
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save context.");
    }
  }

  async function applyAction() {
    if (!pendingAction) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      if (pendingAction.action === "delete") {
        await api.deleteContext(agentId, pendingAction.item.id);
        setMessage("Context deleted.");
      } else {
        await api.updateContext(agentId, pendingAction.item.id, { is_active: pendingAction.action === "activate" });
        setMessage(pendingAction.action === "activate" ? "Context activated." : "Context deactivated.");
      }
      setPendingAction(null);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update context.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card>
      <CardHeader><h2 className="text-base font-semibold">Agent Contexts</h2></CardHeader>
      <CardContent className="space-y-4">
        {message ? <Alert title="Context" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <form className="grid gap-3 lg:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
          <FormField label="Title"><Input {...form.register("title", { required: true })} /></FormField>
          <FormField label="Type" help={<FieldHelp pattern="tooltip" content="Context category. Common types: note (general information), procedure (step-by-step instructions), policy (rules or constraints), reference (external documentation). Used for filtering during context assembly." />}><Input {...form.register("context_type", { required: true })} /></FormField>
          <FormField label="Priority" help={<FieldHelp pattern="tooltip" content="Retrieval priority. Higher values = more important. When context space is limited, lower-priority entries may be omitted. Typical range: 1 (lowest) to 100 (highest). Default: 100." />}><Input type="number" {...form.register("priority", { valueAsNumber: true })} /></FormField>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("is_active")} /> Active</label>
          <div className="lg:col-span-2"><FormField label="Content"><Textarea {...form.register("content", { required: true })} /></FormField></div>
          <div className="flex gap-2"><Button type="submit">{editing ? "Save context" : "Add context"}</Button>{editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button> : null}</div>
        </form>
        {items.length === 0 ? <EmptyState title="No contexts" body="Add scoped context for this agent." /> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div><strong>{item.title}</strong> <StatusBadge status={item.is_active ? "active" : "inactive"} /></div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button>
                {item.is_active ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setPendingAction({ item, action: "deactivate" })}>Deactivate</Button>
                ) : (
                  <>
                    <Button type="button" size="sm" onClick={() => setPendingAction({ item, action: "activate" })}>Activate</Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => setPendingAction({ item, action: "delete" })}>Delete</Button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
          </div>
        ))}
      </CardContent>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === "activate" ? "Activate context?" : pendingAction?.action === "deactivate" ? "Deactivate context?" : "Delete context?"}
        description={
          pendingAction?.action === "activate"
            ? "This context will be eligible for future agent context assembly."
            : pendingAction?.action === "deactivate"
              ? "This preserves the context record while excluding it from future context assembly."
              : "This permanently deletes the inactive context."
        }
        confirmLabel={pendingAction?.action === "activate" ? "Activate context" : pendingAction?.action === "deactivate" ? "Deactivate context" : "Delete context"}
        destructive={pendingAction?.action !== "activate"}
        loading={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={applyAction}
      />
    </Card>
  );
}

function MemoryManager({ agentId, refreshKey = 0 }: { agentId: number; refreshKey?: number }) {
  const [items, setItems] = useState<AgentMemory[]>([]);
  const [editing, setEditing] = useState<AgentMemory | null>(null);
  const [pendingAction, setPendingAction] = useState<{ item: AgentMemory; action: "archive" | "activate" | "delete" } | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const form = useForm({ defaultValues: { memory_type: "lesson", content: "", source: "frontend", importance: 50, status: "pending" as MemoryStatus } });

  const load = useCallback(async () => {
    void refreshKey;
    setItems(await api.listMemories(agentId));
  }, [agentId, refreshKey]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load memories."));
  }, [load]);

  function edit(item: AgentMemory) {
    setEditing(item);
    form.reset({ ...item, source: item.source ?? "" });
  }

  async function submit(values: { memory_type: string; content: string; source?: string | null; importance: number; status: MemoryStatus }) {
    setError("");
    try {
      if (editing) {
        await api.updateMemory(agentId, editing.id, values);
        setMessage("Memory saved.");
      } else {
        await api.createMemory(agentId, values);
        setMessage("Memory created.");
      }
      setEditing(null);
      form.reset({ memory_type: "lesson", content: "", source: "frontend", importance: 50, status: "pending" });
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save memory.");
    }
  }

  async function applyAction() {
    if (!pendingAction) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      if (pendingAction.action === "delete") {
        await api.deleteMemory(agentId, pendingAction.item.id);
        setMessage("Memory deleted.");
      } else {
        await api.updateMemory(agentId, pendingAction.item.id, { status: pendingAction.action === "activate" ? "active" : "archived" });
        setMessage(pendingAction.action === "activate" ? "Memory activated." : "Memory archived.");
      }
      setPendingAction(null);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update memory.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card>
      <CardHeader><h2 className="text-base font-semibold">Agent Memories</h2></CardHeader>
      <CardContent className="space-y-4">
        {message ? <Alert title="Memory" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <form className="grid gap-3 lg:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
          <FormField label="Type" help={<FieldHelp pattern="tooltip" content="Memory category. Common types: lesson (learned from feedback), fact (observed information), preference (user or agent preference), procedure (how to accomplish something). Affects retrieval filtering." />}><Input {...form.register("memory_type", { required: true })} /></FormField>
          <FormField label="Source"><Input {...form.register("source")} /></FormField>
          <FormField label="Importance" help={<FieldHelp pattern="tooltip" content="Retrieval importance. 0 = least important (rarely recalled). 100 = most important (always recalled when relevant). Affects ranking in memory retrieval. Default: 50." />}><Input type="number" {...form.register("importance", { valueAsNumber: true })} /></FormField>
          <FormField label="Status"><Select {...form.register("status")}><option value="pending">pending</option><option value="active">active</option><option value="rejected">rejected</option><option value="archived">archived</option></Select></FormField>
          <div className="lg:col-span-2"><FormField label="Content"><Textarea {...form.register("content", { required: true })} /></FormField></div>
          <div className="flex gap-2"><Button type="submit">{editing ? "Save memory" : "Add memory"}</Button>{editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button> : null}</div>
        </form>
        {items.length === 0 ? <EmptyState title="No memories" body="Add scoped memory for this agent." /> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div><strong>{item.memory_type}</strong> <StatusBadge status={item.status} /></div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button>
                {item.status === "archived" ? (
                  <>
                    <Button type="button" size="sm" onClick={() => setPendingAction({ item, action: "activate" })}>Activate</Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => setPendingAction({ item, action: "delete" })}>Delete</Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => setPendingAction({ item, action: "archive" })}>Archive</Button>
                )}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
          </div>
        ))}
      </CardContent>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === "activate" ? "Activate memory?" : pendingAction?.action === "archive" ? "Archive memory?" : "Delete memory?"}
        description={
          pendingAction?.action === "activate"
            ? "This memory will be eligible for future agent memory retrieval."
            : pendingAction?.action === "archive"
              ? "This preserves the memory record while excluding it from active retrieval."
              : "This permanently deletes an already archived memory. Learning-chain records should stay archived instead of deleted."
        }
        confirmLabel={pendingAction?.action === "activate" ? "Activate memory" : pendingAction?.action === "archive" ? "Archive memory" : "Delete memory"}
        destructive={pendingAction?.action !== "activate"}
        loading={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={applyAction}
      />
    </Card>
  );
}

function ToolAssignmentManager({ agentId }: { agentId: number }) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [assignedTools, setAssignedTools] = useState<Tool[]>([]);
  const [selectedToolId, setSelectedToolId] = useState("");
  const [pendingUnassign, setPendingUnassign] = useState<Tool | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [allTools, assigned] = await Promise.all([api.listTools(), api.listAgentTools(agentId)]);
    setTools(allTools);
    setAssignedTools(assigned);
  }, [agentId]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load agent tools."));
  }, [load]);

  const assignedIds = useMemo(() => new Set(assignedTools.map((tool) => tool.id)), [assignedTools]);
  const availableTools = tools.filter((tool) => !assignedIds.has(tool.id) && tool.is_active);

  async function assignTool() {
    if (!selectedToolId) {
      setError("Select a tool before assigning.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await api.assignToolToAgent(agentId, Number(selectedToolId));
      setSelectedToolId("");
      setMessage("Tool assigned.");
      await load();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Unable to assign tool.");
    } finally {
      setWorking(false);
    }
  }

  async function unassignTool() {
    if (!pendingUnassign) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      await api.unassignToolFromAgent(agentId, pendingUnassign.id);
      setMessage("Tool unassigned.");
      setPendingUnassign(null);
      await load();
    } catch (unassignError) {
      setError(unassignError instanceof Error ? unassignError.message : "Unable to unassign tool.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card>
      <CardHeader><h2 className="text-base font-semibold">Agent Tools</h2></CardHeader>
      <CardContent className="space-y-4">
        {message ? <Alert title="Tool assignment" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <div className="flex flex-wrap items-end gap-2">
          <FormField label="Available tool">
            <Select value={selectedToolId} onChange={(event) => setSelectedToolId(event.target.value)}>
              <option value="">Select a tool</option>
              {availableTools.map((tool) => (
                <option key={tool.id} value={tool.id}>{tool.name}{tool.is_active ? "" : " (inactive)"}</option>
              ))}
            </Select>
          </FormField>
          <Button type="button" onClick={() => void assignTool()} disabled={working || !selectedToolId}>Assign</Button>
        </div>
        {assignedTools.length === 0 ? <EmptyState title="No assigned tools" body="Assign tools explicitly through the Tool Gateway relationship." /> : null}
        {assignedTools.map((tool) => (
          <div key={tool.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <strong>{tool.name}</strong>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={tool.is_active ? "active" : "inactive"} />
                <span className="text-xs text-muted-foreground">{tool.tool_type}</span>
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setPendingUnassign(tool)}>Unassign</Button>
          </div>
        ))}
      </CardContent>
      <ConfirmDialog
        open={Boolean(pendingUnassign)}
        title="Unassign tool?"
        description="This removes only the agent-tool relationship. The tool and the agent remain available."
        confirmLabel="Unassign tool"
        destructive={false}
        loading={working}
        onCancel={() => setPendingUnassign(null)}
        onConfirm={unassignTool}
      />
    </Card>
  );
}

function ProposedMemoryManager({ agentId, onMemoryChanged }: { agentId: number; onMemoryChanged?: () => void }) {
  const [items, setItems] = useState<ProposedMemory[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const { refresh: refreshNotifications } = useNotification();

  const pendingItems = items.filter((item) => item.status === "pending");
  const historyItems = items.filter((item) => item.status === "approved" || item.status === "rejected");
  const notificationCount = pendingItems.filter((item) => item.source_feedback_id || item.source_evaluation_id).length;

  const load = useCallback(async () => {
    setItems(await api.listProposedMemories(agentId));
  }, [agentId]);

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load proposed memories."));
  }, [load]);

  async function review(item: ProposedMemory, action: "approve" | "reject") {
    setError("");
    try {
      if (action === "approve") {
        await api.approveProposedMemory(agentId, item.id);
        setMessage("Proposed memory approved and added as active memory.");
      } else {
        await api.rejectProposedMemory(agentId, item.id);
        setMessage("Proposed memory rejected.");
      }
      await load();
      refreshNotifications();
      if (onMemoryChanged) onMemoryChanged();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review proposed memory.");
    }
  }

  function renderItem(item: ProposedMemory) {
    const isPending = item.status === "pending";
    return (
      <div key={item.id} className="rounded-md border border-border p-3">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <strong>{item.memory_type}</strong> <StatusBadge status={item.status} />
            {item.source_type ? (
              <span className="ml-2 text-xs text-muted-foreground">
                from {item.source_type}
                {item.source_run_id ? (
                  <Link to={`/runs/${item.source_run_id}`} className="ml-1 text-amber-400 hover:underline">(run {item.source_run_id})</Link>
                ) : null}
              </span>
            ) : null}
          </div>
          {isPending ? (
            <div className="flex gap-2"><Button type="button" size="sm" onClick={() => void review(item, "approve")}>Approve</Button><Button type="button" size="sm" variant="outline" onClick={() => void review(item, "reject")}>Reject</Button></div>
          ) : null}
        </div>
        {item.source_summary ? (
          <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">"{item.source_summary}"</p>
        ) : null}
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
      </div>
    );
  }

  return (
    <div id="proposed-memories">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Proposed Memories</h2>
            {notificationCount > 0 ? <span aria-label="Pending feedback memory approval" className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/30">{notificationCount}</span> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {message ? <Alert title="Proposed memory" tone="success">{message}</Alert> : null}
          {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
          {pendingItems.length === 0 ? <EmptyState title="No pending proposed memories" body="Feedback-derived and reviewer-proposed memories that need approval will appear here." /> : null}
          {pendingItems.map(renderItem)}
        </CardContent>
      </Card>

      {historyItems.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <button type="button" onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-base font-semibold hover:text-violet-400 transition-colors">
              {showHistory ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Proposed Memory History ({historyItems.length})
            </button>
          </CardHeader>
          {showHistory ? (
            <CardContent className="space-y-3">
              {historyItems.map(renderItem)}
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function toAgentFormValues(agent: Agent): AgentFormValues {
  return {
    name: agent.name,
    description: agent.description ?? "",
    role: agent.role,
    system_prompt: agent.system_prompt,
    soul_id: agent.soul_id ? String(agent.soul_id) : "",
    llm_provider: agent.llm_provider,
    model: agent.model,
    temperature: agent.temperature,
    max_tokens: agent.max_tokens,
    memoryPolicyJson: prettyJson(agent.memory_policy),
    contextPolicyJson: prettyJson(agent.context_policy),
    is_active: agent.is_active
  };
}
