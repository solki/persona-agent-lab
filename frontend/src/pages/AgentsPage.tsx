import { zodResolver } from "@hookform/resolvers/zod";
import { Edit, Power, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Agent, AgentContext, AgentMemory, MemoryStatus, ProposedMemory, Soul, Tool } from "@/lib/types";
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
  handoffPolicyJson: z.string().min(1),
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
  handoffPolicyJson: prettyJson({ allow_handoff: false, allowed_agent_ids: [] }),
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
      setSafetyWarning(messageText);
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
  const [souls, setSouls] = useState<Soul[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const form = useForm<AgentFormValues>({ resolver: zodResolver(agentSchema), defaultValues: defaultAgent });

  const load = useCallback(async () => {
    setError("");
    try {
      const soulData = await api.listSouls();
      setSouls(soulData);
      if (mode === "edit" && agentId) {
        const agentData = await api.getAgent(agentId);
        setAgent(agentData);
        form.reset(toAgentFormValues(agentData));
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
    let handoffPolicy: Record<string, unknown>;
    try {
      memoryPolicy = parseJsonObject(values.memoryPolicyJson, "Memory policy");
      contextPolicy = parseJsonObject(values.contextPolicyJson, "Context policy");
      handoffPolicy = parseJsonObject(values.handoffPolicyJson, "Handoff policy");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid policy JSON.");
      return;
    }
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
              <FormField label="Model">
                <Input {...form.register("model")} />
              </FormField>
              <FormField label="Temperature">
                <Input type="number" step="0.1" {...form.register("temperature")} />
              </FormField>
              <FormField label="Max tokens">
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
              <FormField label="Memory policy JSON">
                <Textarea className="font-mono" rows={6} {...form.register("memoryPolicyJson")} />
              </FormField>
              <FormField label="Context policy JSON">
                <Textarea className="font-mono" rows={6} {...form.register("contextPolicyJson")} />
              </FormField>
              <FormField label="Handoff policy JSON">
                <Textarea className="font-mono" rows={6} {...form.register("handoffPolicyJson")} />
              </FormField>
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
            <MemoryManager agentId={agentId} />
            <ToolAssignmentManager agentId={agentId} />
            <ProposedMemoryManager agentId={agentId} />
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
          <FormField label="Type"><Input {...form.register("context_type", { required: true })} /></FormField>
          <FormField label="Priority"><Input type="number" {...form.register("priority", { valueAsNumber: true })} /></FormField>
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

function MemoryManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<AgentMemory[]>([]);
  const [editing, setEditing] = useState<AgentMemory | null>(null);
  const [pendingAction, setPendingAction] = useState<{ item: AgentMemory; action: "archive" | "activate" | "delete" } | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const form = useForm({ defaultValues: { memory_type: "lesson", content: "", source: "frontend", importance: 50, status: "pending" as MemoryStatus } });

  const load = useCallback(async () => {
    setItems(await api.listMemories(agentId));
  }, [agentId]);

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
          <FormField label="Type"><Input {...form.register("memory_type", { required: true })} /></FormField>
          <FormField label="Source"><Input {...form.register("source")} /></FormField>
          <FormField label="Importance"><Input type="number" {...form.register("importance", { valueAsNumber: true })} /></FormField>
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

function ProposedMemoryManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<ProposedMemory[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { refresh: refreshNotifications } = useNotification();
  const notificationCount = items.filter((item) => item.status === "pending" && (item.source_feedback_id || item.source_evaluation_id)).length;

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
        setMessage("Proposed memory approved.");
      } else {
        await api.rejectProposedMemory(agentId, item.id);
        setMessage("Proposed memory rejected.");
      }
      await load();
      refreshNotifications();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review proposed memory.");
    }
  }

  return (
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
        {items.length === 0 ? <EmptyState title="No proposed memories" body="Feedback-derived memories will appear here for manual approval." /> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div><strong>{item.memory_type}</strong> <StatusBadge status={item.status} /></div>
              {item.status === "pending" ? (
                <div className="flex gap-2"><Button type="button" size="sm" onClick={() => void review(item, "approve")}>Approve</Button><Button type="button" size="sm" variant="outline" onClick={() => void review(item, "reject")}>Reject</Button></div>
              ) : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
          </div>
        ))}
      </CardContent>
    </Card>
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
    handoffPolicyJson: prettyJson(agent.handoff_policy),
    is_active: agent.is_active
  };
}
