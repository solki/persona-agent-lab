"use client";

import { CheckCircle2, Lightbulb, Send } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AgentFeedback, ProposedMemory, Run } from "@/lib/types";
import { Field, inputClass } from "@/components/shared/Field";
import { StatusMessage } from "@/components/shared/StatusMessage";

interface SnapshotAgent {
  id: number;
  name: string;
}

interface RunLearningPanelProps {
  run: Run;
}

export function RunLearningPanel({ run }: RunLearningPanelProps) {
  const agents = useMemo(() => snapshotAgents(run), [run]);
  const [agentId, setAgentId] = useState(agents[0]?.id ? String(agents[0].id) : "");
  const [rating, setRating] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("correction");
  const [feedback, setFeedback] = useState<AgentFeedback | null>(null);
  const [proposedMemory, setProposedMemory] = useState<ProposedMemory | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setProposedMemory(null);
    try {
      const saved = await api.createRunFeedback(run.id, Number(agentId), {
        feedback_text: feedbackText,
        feedback_type: feedbackType,
        rating: rating ? Number(rating) : null
      });
      setFeedback(saved);
      setMessage("Feedback saved for this run and agent.");
    } catch {
      setError("Unable to save feedback for this run and agent.");
    }
  }

  async function generateProposedMemory() {
    if (!feedback) {
      return;
    }
    setError("");
    setMessage("");
    try {
      const reflection = await api.reflectOnRunFeedback(run.id, feedback.agent_id, {
        feedback_id: feedback.id,
        memory_type: "lesson",
        importance: rating ? Number(rating) * 20 : 70
      });
      setProposedMemory(reflection.proposed_memory);
      setMessage("Proposed memory generated. Review it on the agent detail page before it affects future runs.");
    } catch {
      setError("Unable to generate a proposed memory from this feedback.");
    }
  }

  if (agents.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 rounded border border-line bg-white p-5">
      <div className="flex items-center gap-2">
        <Lightbulb size={18} className="text-accent" />
        <h2 className="text-base font-semibold">Learning Feedback</h2>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        After approving a proposed memory, re-run the same task to compare behaviour.
      </p>
      {message ? <StatusMessage title="Learning" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <form onSubmit={submitFeedback} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Agent">
            <select className={inputClass} value={agentId} onChange={(event) => setAgentId(event.target.value)}>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Feedback type">
            <input className={inputClass} value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)} />
          </Field>
          <Field label="Rating">
            <input className={inputClass} type="number" min="1" max="5" value={rating} onChange={(event) => setRating(event.target.value)} />
          </Field>
        </div>
        <Field label="Feedback">
          <textarea className={inputClass} rows={4} value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} required />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
            <Send size={16} />
            Save feedback
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded border border-line bg-white px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!feedback}
            onClick={generateProposedMemory}
            type="button"
          >
            <Lightbulb size={16} />
            Generate proposed memory
          </button>
        </div>
      </form>
      {proposedMemory ? (
        <div className="mt-4 rounded border border-line bg-panel p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{proposedMemory.memory_type}</strong>
            <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs text-slate-600">
              <CheckCircle2 size={14} />
              {proposedMemory.status}
            </span>
          </div>
          <p className="mt-2 text-slate-700">{proposedMemory.content}</p>
          <p className="mt-2 text-xs text-slate-500">Importance: {proposedMemory.importance}</p>
          <Link className="focus-ring mt-3 inline-flex rounded border border-line bg-white px-3 py-1 text-xs font-medium" href={`/agents/${proposedMemory.agent_id}`}>
            Review on agent page
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function snapshotAgents(run: Run): SnapshotAgent[] {
  const snapshotAgentsValue = run.config_snapshot.agents;
  if (!Array.isArray(snapshotAgentsValue)) {
    return [];
  }
  return snapshotAgentsValue.flatMap((item) => {
    if (!isSnapshotAgent(item)) {
      return [];
    }
    return [{ id: item.id, name: item.name }];
  });
}

function isSnapshotAgent(value: unknown): value is SnapshotAgent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const maybeAgent = value as Record<string, unknown>;
  return typeof maybeAgent.id === "number" && typeof maybeAgent.name === "string";
}
