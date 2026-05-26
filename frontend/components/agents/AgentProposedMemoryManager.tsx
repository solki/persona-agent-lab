"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ProposedMemory, ProposedMemoryStatus } from "@/lib/types";
import { StatusMessage } from "@/components/shared/StatusMessage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function AgentProposedMemoryManager({ agentId }: { agentId: number }) {
  const [items, setItems] = useState<ProposedMemory[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [pendingReject, setPendingReject] = useState<ProposedMemory | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.listProposedMemories(agentId));
    } catch {
      setError("Unable to load proposed memories.");
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(
    () => ({
      pending: items.filter((item) => item.status === "pending"),
      approved: items.filter((item) => item.status === "approved"),
      rejected: items.filter((item) => item.status === "rejected")
    }),
    [items]
  );

  async function review(memoryId: number, action: "approve" | "reject") {
    setError("");
    setMessage("");
    setLoadingId(memoryId);
    try {
      if (action === "approve") {
        await api.approveProposedMemory(agentId, memoryId);
        setMessage("Proposed memory approved and written as active agent memory.");
      } else {
        await api.rejectProposedMemory(agentId, memoryId);
        setMessage("Proposed memory rejected. It will not be retrieved in future runs.");
      }
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review this proposed memory.");
    } finally {
      setLoadingId(null);
      setPendingReject(null);
    }
  }

  return (
    <section className="rounded border border-line bg-white p-5">
      <h2 className="text-base font-semibold">Proposed Memories</h2>
      <p className="mt-1 text-sm text-slate-600">
        Feedback-derived memories stay pending until approval. Approved items become normal active memory for this agent only.
      </p>
      <p className="mt-1 text-sm text-slate-600">After approving a proposed memory, re-run the same task to compare behaviour.</p>
      {message ? <StatusMessage title="Reviewed" body={message} /> : null}
      {error ? <StatusMessage title="Error" body={error} /> : null}
      <MemoryGroup
        title="Pending"
        status="pending"
        items={grouped.pending}
        loadingId={loadingId}
        onApprove={(memoryId) => review(memoryId, "approve")}
        onReject={setPendingReject}
      />
      <MemoryGroup title="Approved" status="approved" items={grouped.approved} loadingId={loadingId} onApprove={() => undefined} onReject={() => undefined} />
      <MemoryGroup title="Rejected" status="rejected" items={grouped.rejected} loadingId={loadingId} onApprove={() => undefined} onReject={() => undefined} />
      <ConfirmDialog
        open={Boolean(pendingReject)}
        title="Reject proposed memory?"
        description="Rejecting this proposed memory keeps it out of future retrieval. No active AgentMemory will be created."
        confirmLabel="Reject memory"
        loading={loadingId !== null}
        onCancel={() => setPendingReject(null)}
        onConfirm={() => pendingReject && review(pendingReject.id, "reject")}
      />
    </section>
  );
}

function MemoryGroup({
  title,
  status,
  items,
  loadingId,
  onApprove,
  onReject
}: {
  title: string;
  status: ProposedMemoryStatus;
  items: ProposedMemory[];
  loadingId: number | null;
  onApprove: (memoryId: number) => void;
  onReject: (memory: ProposedMemory) => void;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? <p className="mt-2 text-sm text-slate-500">No {status} proposed memories.</p> : null}
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <article key={item.id} className="rounded border border-line bg-panel p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{item.memory_type}</strong>
              <span className="rounded bg-white px-2 py-1 text-xs text-slate-600">{item.status}</span>
            </div>
            <p className="mt-2 text-slate-700">{item.content}</p>
            <p className="mt-2 text-xs text-slate-500">
              Importance: {item.importance}
              {item.source_feedback_id ? ` · Feedback ${item.source_feedback_id}` : ""}
              {item.source_evaluation_id ? ` · Evaluation ${item.source_evaluation_id}` : ""}
            </p>
            {item.status === "pending" ? (
              <div className="mt-3 flex gap-2">
                <button
                  className="focus-ring inline-flex items-center gap-1 rounded bg-success px-3 py-1 text-xs font-medium text-white"
                  disabled={loadingId === item.id}
                  onClick={() => onApprove(item.id)}
                  type="button"
                >
                  <Check size={14} />
                  {loadingId === item.id ? "Working..." : "Approve"}
                </button>
                <button
                  className="focus-ring inline-flex items-center gap-1 rounded border border-line bg-white px-3 py-1 text-xs font-medium disabled:opacity-60"
                  disabled={loadingId === item.id}
                  onClick={() => onReject(item)}
                  type="button"
                >
                  <X size={14} />
                  Reject
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
