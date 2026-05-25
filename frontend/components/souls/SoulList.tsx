"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Soul } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusMessage } from "@/components/shared/StatusMessage";

export function SoulList() {
  const [souls, setSouls] = useState<Soul[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listSouls()
      .then(setSouls)
      .catch(() => setError("Unable to reach the backend API."))
      .finally(() => setLoading(false));
  }, []);

  async function deleteSoul(soul: Soul) {
    if (!window.confirm(`Delete soul "${soul.name}"?`)) {
      return;
    }
    setError("");
    setMessage("");
    try {
      await api.deleteSoul(soul.id);
      setSouls((current) => current.filter((item) => item.id !== soul.id));
      setMessage("Soul deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete soul.");
    }
  }

  return (
    <>
      <PageHeader
        title="Souls"
        description="Manage reusable persona, decision, collaboration, failure handling, and escalation patterns separately from system prompts."
        actionHref="/souls/new"
        actionLabel="New soul"
      />
      {loading ? <StatusMessage title="Loading" body="Loading souls from the backend." /> : null}
      {message ? <StatusMessage title="Saved" body={message} /> : null}
      {error ? <StatusMessage title="Backend unavailable" body={error} /> : null}
      {!loading && !error && souls.length === 0 ? <StatusMessage title="No souls" body="Create reusable agent persona profiles here." /> : null}
      <div className="grid gap-3">
        {souls.map((soul) => (
          <div key={soul.id} className="rounded border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link href={`/souls/${soul.id}`} className="focus-ring rounded hover:text-accent">
                <h2 className="text-base font-semibold">{soul.name}</h2>
              </Link>
              <div className="flex gap-2">
                <Link href={`/souls/${soul.id}`} className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium">
                  Edit
                </Link>
                <button className="focus-ring rounded border border-line bg-white px-3 py-1 text-xs font-medium text-red-700" onClick={() => deleteSoul(soul)} type="button">
                  Delete
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{soul.description || soul.decision_style || "No description yet."}</p>
          </div>
        ))}
      </div>
    </>
  );
}
