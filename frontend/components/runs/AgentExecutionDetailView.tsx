"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentExecutionDetail } from "@/lib/types";
import { JsonCollapsePanel } from "@/components/runs/JsonCollapsePanel";
import { RuntimeEventList } from "@/components/runs/RuntimeEventList";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function AgentExecutionDetailView({ runId, executionId }: { runId: number; executionId: number }) {
  const [detail, setDetail] = useState<AgentExecutionDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getRunExecution(runId, executionId).then(setDetail).catch(() => setError("Unable to load this execution."));
  }, [executionId, runId]);

  return (
    <>
      <PageHeader
        title="Execution Detail"
        description="Review the agent snapshot, injected context, retrieved memory, model response, token usage, and learning events for one execution."
      />
      {error ? <StatusMessage title="Error" body={error} /> : null}
      {detail ? (
        <div className="grid gap-5">
          <section className="rounded border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{detail.execution.agent_name_snapshot}</h2>
              <div className="flex flex-wrap gap-2">
                <a className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}`}>
                  Back to Run
                </a>
                <a className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}/monitor`}>
                  Monitor
                </a>
                <a className="focus-ring rounded border border-line bg-white px-3 py-1 text-sm" href={`/runs/${runId}/executions`}>
                  Executions
                </a>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Status: {detail.execution.status} · Agent {detail.execution.agent_id} · Step {detail.execution.sequence_index + 1}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Provider: {detail.execution.provider} · Model: {detail.execution.model} · Temperature: {detail.execution.temperature}
            </p>
          </section>
          <JsonCollapsePanel title="Input Payload" value={detail.execution.input_payload} />
          <JsonCollapsePanel title="Assembled Context" value={detail.assembled_context} />
          <JsonCollapsePanel title="Retrieved Memories" value={detail.retrieved_memory} />
          <JsonCollapsePanel title="Tool Calls" value={detail.tool_calls} />
          <JsonCollapsePanel title="LLM Events" value={detail.events.filter((event) => event.event_type.startsWith("llm_"))} />
          <JsonCollapsePanel title="Output Payload" value={detail.execution.output_payload} defaultExpanded />
          <JsonCollapsePanel title="Token Usage" value={detail.token_usage} />
          <JsonCollapsePanel title="Learning Events" value={detail.learning_events} />
          <RuntimeEventList
            title="All Execution Events"
            events={detail.events}
            agentNames={{ [detail.execution.agent_id]: detail.execution.agent_name_snapshot }}
          />
        </div>
      ) : null}
    </>
  );
}
