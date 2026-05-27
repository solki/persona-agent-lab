import { zodResolver } from "@hookform/resolvers/zod";
import { Edit, Power, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Tool } from "@/lib/types";
import { parseJsonObject, prettyJson } from "@/lib/utils";

const toolSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  tool_type: z.string().min(1, "Tool type is required").max(80),
  configJson: z.string().min(1, "Config JSON is required"),
  is_active: z.boolean()
});

type ToolFormValues = z.infer<typeof toolSchema>;

const emptyTool: ToolFormValues = {
  name: "",
  description: "",
  tool_type: "custom",
  configJson: "{}",
  is_active: true
};

export function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [assignmentCounts, setAssignmentCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<{ tool: Tool; action: "delete" | "deactivate" | "activate" } | null>(null);
  const [forceWarning, setForceWarning] = useState<{ tool: Tool } | null>(null);
  const [safetyWarning, setSafetyWarning] = useState("");
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [toolData, agentData] = await Promise.all([api.listTools(), api.listAgents()]);
      const assignments = await Promise.all(
        agentData.map(async (agent) => {
          const assigned = await api.listAgentTools(agent.id);
          return assigned.map((tool) => tool.id);
        })
      );
      const counts: Record<number, number> = {};
      assignments.flat().forEach((toolId) => {
        counts[toolId] = (counts[toolId] ?? 0) + 1;
      });
      setTools(toolData);
      setAssignmentCounts(counts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load tools.");
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
        await api.deleteTool(pendingAction.tool.id, true);
        setMessage("Tool deleted.");
      } else {
        await api.updateTool(pendingAction.tool.id, { is_active: pendingAction.action === "activate" });
        setMessage(pendingAction.action === "activate" ? "Tool activated." : "Tool deactivated.");
      }
      setPendingAction(null);
      await load();
    } catch (actionError) {
      const messageText = actionError instanceof Error ? actionError.message : "Unable to update tool.";
      setError(messageText);
      setSafetyWarning(messageText);
      setPendingAction(null);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <PageHeader title="Tools" description="Tool Gateway registry entries with explicit active state and JSON configuration." actionHref="/tools/new" actionLabel="New tool" />
      <div className="space-y-3">
        {message ? <Alert title="Success" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        {loading ? <Alert title="Loading">Loading tools.</Alert> : null}
        {!loading && tools.length === 0 ? <EmptyState title="No tools" body="Create a tool registry entry to assign it to agents later." /> : null}
        {tools.map((tool) => (
          <Card key={tool.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-base font-semibold">{tool.name}</h2>
                  <StatusBadge status={tool.is_active ? "active" : "inactive"} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{tool.description || "No description"}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Type: {tool.tool_type}
                  {assignmentCounts[tool.id] ? ` · Assigned to ${assignmentCounts[tool.id]} agent(s)` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/tools/${tool.id}`}>
                  <Button type="button" variant="outline" size="sm"><Edit size={15} /> Edit</Button>
                </Link>
                {tool.is_active ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setPendingAction({ tool, action: "deactivate" })}>
                    <Power size={15} /> Deactivate
                  </Button>
                ) : (
                  <>
                    <Button type="button" size="sm" onClick={() => setPendingAction({ tool, action: "activate" })}>
                      <RotateCcw size={15} /> Activate
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => {
                      if (assignmentCounts[tool.id]) {
                        setForceWarning({ tool });
                      } else {
                        setPendingAction({ tool, action: "delete" });
                      }
                    }}>
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
        title={pendingAction?.action === "activate" ? "Activate tool?" : pendingAction?.action === "deactivate" ? "Deactivate tool?" : "Delete tool?"}
        description={
          pendingAction?.action === "activate"
            ? "This makes the tool available for agent use again."
            : pendingAction?.action === "deactivate"
              ? "This keeps the tool record and prevents it from being selected in agent definitions."
              : "This permanently deletes the inactive tool. Any agent-tool assignments will be removed."
        }
        confirmLabel={pendingAction?.action === "activate" ? "Activate tool" : pendingAction?.action === "deactivate" ? "Deactivate tool" : "Delete tool"}
        destructive={pendingAction?.action !== "activate"}
        loading={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={applyAction}
      />
      <ConfirmDialog
        open={Boolean(forceWarning)}
        title="Force delete tool?"
        description={`"${forceWarning?.tool.name ?? ""}" is still assigned to ${assignmentCounts[forceWarning?.tool.id ?? 0] ?? 0} agent(s). Force delete will remove all agent-tool assignments and permanently delete the tool.`}
        confirmLabel="Force delete"
        destructive={true}
        loading={working}
        onCancel={() => setForceWarning(null)}
        onConfirm={() => {
          if (forceWarning) {
            setPendingAction({ tool: forceWarning.tool, action: "delete" });
            setForceWarning(null);
          }
        }}
      />
      <NoticeDialog open={Boolean(safetyWarning)} title="Action blocked" description={safetyWarning} onClose={() => setSafetyWarning("")} />
    </>
  );
}

export function ToolFormPage() {
  const { id } = useParams();
  const toolId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const form = useForm<ToolFormValues>({ resolver: zodResolver(toolSchema), defaultValues: emptyTool });

  useEffect(() => {
    if (!toolId) {
      return;
    }
    api
      .getTool(toolId)
      .then((tool) => form.reset(toToolFormValues(tool)))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load tool."));
  }, [form, toolId]);

  async function submit(values: ToolFormValues) {
    setError("");
    setMessage("");
    let config: Record<string, unknown>;
    try {
      config = parseJsonObject(values.configJson, "Tool config");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid config JSON.");
      return;
    }
    const payload = {
      name: values.name,
      description: values.description,
      tool_type: values.tool_type,
      config,
      is_active: values.is_active
    };
    try {
      if (toolId) {
        await api.updateTool(toolId, payload);
        setMessage("Tool saved.");
      } else {
        const created = await api.createTool(payload);
        navigate(`/tools/${created.id}`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save tool.");
    }
  }

  return (
    <>
      <PageHeader title={toolId ? "Edit Tool" : "New Tool"} description="Expose only backend-supported tool fields. Do not put API keys in frontend-visible config." />
      <form className="max-w-3xl space-y-4" onSubmit={form.handleSubmit(submit)}>
        {message ? <Alert title="Saved" tone="success">{message}</Alert> : null}
        {error ? <Alert title="Error" tone="error">{error}</Alert> : null}
        <FormField label="Name" error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} />
        </FormField>
        <FormField label="Description">
          <Textarea {...form.register("description")} />
        </FormField>
        <FormField label="Tool type" error={form.formState.errors.tool_type?.message}>
          <Input {...form.register("tool_type")} />
        </FormField>
        <FormField label="Config JSON" help={<FieldHelp pattern="popover" title="Tool configuration" content="Tool-specific configuration. Structure depends on the tool type.\n\nFor custom tools: any JSON object.\nFor web_search: may include base_url, api_key_ref, max_results.\n\nNever put secrets directly in this field." />}>
          <Textarea className="font-mono" rows={8} {...form.register("configJson")} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("is_active")} />
          Active
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save tool"}</Button>
          <Link to="/tools"><Button type="button" variant="outline">Back to tools</Button></Link>
        </div>
      </form>
    </>
  );
}

function toToolFormValues(tool: Tool): ToolFormValues {
  return {
    name: tool.name,
    description: tool.description ?? "",
    tool_type: tool.tool_type,
    configJson: prettyJson(tool.config),
    is_active: tool.is_active
  };
}
