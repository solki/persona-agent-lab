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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Tool | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setTools(await api.listTools());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load tools.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function deleteTool() {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await api.deleteTool(pendingDelete.id);
      setMessage("Tool deleted.");
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete tool.");
    } finally {
      setDeleting(false);
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
                <p className="mt-2 text-xs text-muted-foreground">Type: {tool.tool_type}</p>
              </div>
              <div className="flex gap-2">
                <Link to={`/tools/${tool.id}`}>
                  <Button type="button" variant="outline" size="sm"><Edit size={15} /> Edit</Button>
                </Link>
                <Button type="button" variant="destructive" size="sm" onClick={() => setPendingDelete(tool)}><Trash2 size={15} /> Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete tool?"
        description="This removes the tool registry entry and its agent assignments if backend safety checks allow it."
        confirmLabel="Delete tool"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteTool}
      />
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
        <FormField label="Config JSON">
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
