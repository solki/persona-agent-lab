"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listAgents()
      .then(setAgents)
      .catch(() => setError("Unable to reach the backend API. Start FastAPI to load agents."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Agents"
        description="Create and manage isolated agents with independent model settings, prompts, memory policy, context policy, and handoff rules."
        actionHref="/agents/new"
        actionLabel="New agent"
      />
      {loading ? <StatusMessage title="Loading" body="Loading agents from the backend." /> : null}
      {error ? <StatusMessage title="Backend unavailable" body={error} /> : null}
      {!loading && !error && agents.length === 0 ? <StatusMessage title="No agents" body="Create the first agent to begin composing workflows." /> : null}
      <div className="grid gap-3">
        {agents.map((agent) => (
          <Link key={agent.id} href={`/agents/${agent.id}`} className="focus-ring rounded border border-line bg-white p-4 hover:border-accent">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">{agent.name}</h2>
              <div className="flex flex-wrap justify-end gap-2">
                <span className={`rounded px-2 py-1 text-xs ${agent.is_active ? "bg-success text-white" : "bg-panel text-slate-600"}`}>
                  {agent.is_active ? "Active" : "Inactive"}
                </span>
                <span className="rounded bg-panel px-2 py-1 text-xs text-slate-600">{agent.llm_provider}:{agent.model}</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{agent.description || agent.role}</p>
            <p className="mt-3 text-xs text-slate-500">Memory: {agent.memory_policy.write_mode} · Handoff: {agent.handoff_policy.allow_handoff ? "allowed" : "off"}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
