"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Agent, Soul, Tool } from "@/lib/types";
import { AgentForm } from "@/components/agents/AgentForm";
import { AgentContextManager } from "@/components/agents/AgentContextManager";
import { AgentMemoryManager } from "@/components/agents/AgentMemoryManager";
import { AgentProposedMemoryManager } from "@/components/agents/AgentProposedMemoryManager";
import { inputClass } from "@/components/shared/Field";
import { StatusMessage } from "@/components/shared/StatusMessage";

function badge(label: string, active = true) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${active ? "bg-success text-white" : "bg-panel text-slate-600"}`}>
      {label}
    </span>
  );
}

function AgentSummary({ agentId, refreshKey }: { agentId: number; refreshKey: number }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [souls, setSouls] = useState<Soul[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getAgent(agentId), api.listSouls()])
      .then(([loadedAgent, loadedSouls]) => {
        setAgent(loadedAgent);
        setSouls(loadedSouls);
      })
      .catch(() => setError("Unable to load agent summary."));
  }, [agentId, refreshKey]);

  const soul = souls.find((item) => item.id === agent?.soul_id);

  if (error) {
    return <StatusMessage title="Error" body={error} />;
  }

  if (!agent) {
    return <StatusMessage title="Loading" body="Loading agent configuration." />;
  }

  return (
    <section className="grid gap-4 rounded border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Agent Summary</h2>
          <p className="mt-1 text-sm text-slate-600">{agent.role}</p>
        </div>
        {badge(agent.is_active ? "Active" : "Inactive", agent.is_active)}
      </div>
      <div className="grid gap-3 text-sm md:grid-cols-3">
        <div>
          <span className="text-xs font-medium uppercase text-slate-500">Name</span>
          <p className="mt-1 font-medium text-ink">{agent.name}</p>
        </div>
        <div>
          <span className="text-xs font-medium uppercase text-slate-500">Provider / model</span>
          <p className="mt-1 font-medium text-ink">
            {agent.llm_provider}:{agent.model}
          </p>
        </div>
        <div>
          <span className="text-xs font-medium uppercase text-slate-500">Soul</span>
          <p className="mt-1 font-medium text-ink">{soul?.name ?? "No soul selected"}</p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Policy Summary</h3>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <pre className="overflow-auto rounded border border-line bg-panel p-3 text-xs">{JSON.stringify(agent.memory_policy, null, 2)}</pre>
          <pre className="overflow-auto rounded border border-line bg-panel p-3 text-xs">{JSON.stringify(agent.context_policy, null, 2)}</pre>
          <pre className="overflow-auto rounded border border-line bg-panel p-3 text-xs">{JSON.stringify(agent.handoff_policy, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}

function AgentToolManager({ agentId }: { agentId: number }) {
  const [assignedTools, setAssignedTools] = useState<Tool[]>([]);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [selectedToolId, setSelectedToolId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [assigned, tools] = await Promise.all([api.listAgentTools(agentId), api.listTools()]);
      setAssignedTools(assigned);
      setAllTools(tools);
    } catch {
      setError("Unable to load tool assignments.");
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableTools = useMemo(() => {
    const assignedIds = new Set(assignedTools.map((tool) => tool.id));
    return allTools.filter((tool) => !assignedIds.has(tool.id));
  }, [allTools, assignedTools]);

  async function assignTool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedToolId) {
      setError("Select a tool to assign.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.assignTool(agentId, Number(selectedToolId));
      setSelectedToolId("");
      setMessage("Tool assigned.");
      await load();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Unable to assign tool.");
    } finally {
      setLoading(false);
    }
  }

  async function unassignTool(tool: Tool) {
    if (!window.confirm(`Unassign ${tool.name} from this agent?`)) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.removeTool(agentId, tool.id);
      setMessage("Tool unassigned.");
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to unassign tool.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded border border-line bg-white p-5">
      <h2 className="text-base font-semibold">Assigned Tools</h2>
      <p className="mt-1 text-sm text-slate-600">Tools are assigned per agent before Tool Gateway execution can use them.</p>
      {message ? <StatusMessage title="Saved" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={assignTool} className="mt-4 flex flex-col gap-3 md:flex-row">
        <select className={inputClass} value={selectedToolId} onChange={(event) => setSelectedToolId(event.target.value)}>
          <option value="">Select an available tool</option>
          {availableTools.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.name} ({tool.tool_type})
            </option>
          ))}
        </select>
        <button className="focus-ring rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={loading} type="submit">
          Assign
        </button>
      </form>
      <div className="mt-4 grid gap-2">
        {assignedTools.length === 0 ? <p className="text-sm text-slate-600">No tools assigned.</p> : null}
        {assignedTools.map((tool) => (
          <div key={tool.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-panel p-3 text-sm">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <strong>{tool.name}</strong>
                {badge(tool.is_active ? "Active" : "Inactive", tool.is_active)}
              </div>
              <p className="mt-1 text-slate-600">{tool.description || tool.tool_type}</p>
            </div>
            <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium" disabled={loading} onClick={() => unassignTool(tool)} type="button">
              Unassign
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AgentDetail({ agentId }: { agentId: number }) {
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link className="focus-ring rounded border border-line bg-white px-3 py-2 text-sm font-medium" href={`/agents/${agentId}/evolution`}>
          View evolution
        </Link>
      </div>
      <AgentSummary agentId={agentId} refreshKey={summaryRefreshKey} />
      <AgentForm mode="edit" agentId={agentId} onSaved={() => setSummaryRefreshKey((current) => current + 1)} />
      <AgentToolManager agentId={agentId} />
      <AgentContextManager agentId={agentId} />
      <AgentProposedMemoryManager agentId={agentId} />
      <AgentMemoryManager agentId={agentId} />
    </div>
  );
}
