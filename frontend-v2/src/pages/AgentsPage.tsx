import { zodResolver } from "@hookform/resolvers/zod";
import { Edit, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Agent, AgentContext, AgentMemory, MemoryStatus, ProposedMemory, Soul } from "@/lib/types";
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
  const [pendingDelete, setPendingDelete] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function deleteAgent() {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await api.deleteAgent(pendingDelete.id);
      setMessage("Agent deleted.");
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete agent.");
    } finally {
      setDeleting(false);
    }
  }

  const soulById = useMemo(() => Object.fromEntries(souls.map((soul) => [soul.id, soul.name])), [souls]);

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
                    <span aria-label="Pending feedback memory approval" className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {notificationCounts[agent.id]}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{agent.description || agent.role}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {agent.llm_provider}:{agent.model} · Soul: {agent.soul_id ? soulById[agent.soul_id] ?? `#${agent.soul_id}` : "None"}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/agents/${agent.id}`}>
                  <Button type="button" variant="outline" size="sm"><Edit size={15} /> Open</Button>
                </Link>
                <Button type="button" variant="destructive" size="sm" onClick={() => setPendingDelete(agent)}><Trash2 size={15} /> Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete agent?"
        description="This deletes the agent if backend safety checks allow it. If the agent has run history, deactivate it from the edit form instead."
        confirmLabel="Delete agent"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteAgent}
      />
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
                  {souls.map((soul) => (
                    <option key={soul.id} value={soul.id}>{soul.name}</option>
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

  async function remove(item: AgentContext) {
    if (!window.confirm(`Delete context "${item.title}"?`)) {
      return;
    }
    await api.deleteContext(agentId, item.id);
    setMessage("Context deleted.");
    await load();
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
              <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button><Button type="button" size="sm" variant="destructive" onClick={() => void remove(item)}>Delete</Button></div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MemoryManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<AgentMemory[]>([]);
  const [editing, setEditing] = useState<AgentMemory | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const form = useForm({ defaultValues: { memory_type: "lesson", content: "", source: "frontend_v2", importance: 50, status: "pending" as MemoryStatus } });

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
      form.reset({ memory_type: "lesson", content: "", source: "frontend_v2", importance: 50, status: "pending" });
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save memory.");
    }
  }

  async function remove(item: AgentMemory) {
    if (!window.confirm(`Delete memory #${item.id}?`)) {
      return;
    }
    await api.deleteMemory(agentId, item.id);
    setMessage("Memory deleted.");
    await load();
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
              <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button><Button type="button" size="sm" variant="destructive" onClick={() => void remove(item)}>Delete</Button></div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProposedMemoryManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<ProposedMemory[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review proposed memory.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Proposed Memories</h2>
          {notificationCount > 0 ? <span aria-label="Pending feedback memory approval" className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">{notificationCount}</span> : null}
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
