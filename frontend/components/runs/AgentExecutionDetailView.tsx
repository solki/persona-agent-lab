"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentExecutionDetail } from "@/lib/types";
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
            <h2 className="text-base font-semibold">{detail.execution.agent_name_snapshot}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Status: {detail.execution.status} · Agent {detail.execution.agent_id} · Step {detail.execution.sequence_index + 1}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Provider: {detail.execution.provider} · Model: {detail.execution.model} · Temperature: {detail.execution.temperature}
            </p>
          </section>
          <JsonSection title="Input Payload" value={detail.execution.input_payload} />
          <JsonSection title="Assembled Context" value={detail.assembled_context} />
          <JsonSection title="Retrieved Memories" value={detail.retrieved_memory} />
          <JsonSection title="Tool Calls" value={detail.tool_calls} />
          <JsonSection title="LLM Events" value={detail.events.filter((event) => event.event_type.startsWith("llm_"))} />
          <JsonSection title="Output Payload" value={detail.execution.output_payload} />
          <JsonSection title="Token Usage" value={detail.token_usage} />
          <JsonSection title="Learning Events" value={detail.learning_events} />
          <JsonSection title="All Execution Events" value={detail.events} />
        </div>
      ) : null}
    </>
  );
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="rounded border border-line bg-white p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <pre className="mt-3 max-h-96 overflow-auto rounded bg-panel p-3 text-xs text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}
