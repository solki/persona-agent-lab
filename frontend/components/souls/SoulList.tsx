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

  useEffect(() => {
    api.listSouls().then(setSouls).catch(() => setError("Unable to reach the backend API."));
  }, []);

  return (
    <>
      <PageHeader
        title="Souls"
        description="Manage reusable persona, decision, collaboration, failure handling, and escalation patterns separately from system prompts."
        actionHref="/souls/new"
        actionLabel="New soul"
      />
      {error ? <StatusMessage title="Backend unavailable" body={error} /> : null}
      {!error && souls.length === 0 ? <StatusMessage title="No souls" body="Create reusable agent persona profiles here." /> : null}
      <div className="grid gap-3">
        {souls.map((soul) => (
          <Link key={soul.id} href={`/souls/${soul.id}`} className="focus-ring rounded border border-line bg-white p-4 hover:border-accent">
            <h2 className="text-base font-semibold">{soul.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{soul.description || soul.decision_style || "No description yet."}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
