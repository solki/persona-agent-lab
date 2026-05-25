import Link from "next/link";
import { Activity, Bot, Brain, Hammer, Layers, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

const cards = [
  {
    href: "/agents",
    title: "Agents",
    body: "Configure model settings, system prompts, souls, tool permissions, context, and memory.",
    icon: Bot
  },
  {
    href: "/souls",
    title: "Souls",
    body: "Manage reusable persona and collaboration patterns separate from system prompts.",
    icon: Brain
  },
  {
    href: "/tools",
    title: "Tool Registry",
    body: "Register tools and assign access per agent before Tool Gateway execution.",
    icon: Hammer
  },
  {
    href: "/runs",
    title: "Runtime Runs",
    body: "Inspect workflow runs, monitor agent execution, review traces, and manage old results.",
    icon: Activity
  }
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Operate isolated agents from one work surface. Each agent keeps independent settings, context, memory, and tool permissions unless a workflow explicitly grants access."
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="focus-ring rounded border border-line bg-white p-5 shadow-sm hover:border-accent"
            >
              <Icon className="mb-4 text-accent" size={22} />
              <h2 className="text-base font-semibold text-ink">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
            </Link>
          );
        })}
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-line bg-white p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-success" />
            <h2 className="text-base font-semibold">Isolation Rules</h2>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Memory retrieval is scoped by agent id.</li>
            <li>Context retrieval is scoped by agent id.</li>
            <li>Tool execution must go through Tool Gateway.</li>
            <li>Handoff must be explicit and permission checked.</li>
          </ul>
        </div>
        <div className="rounded border border-line bg-white p-5">
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-accent" />
            <h2 className="text-base font-semibold">Runtime Workflows</h2>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Run workflows, inspect traces, add feedback, generate proposed memories, and approve learning updates per agent.
          </p>
        </div>
      </section>
    </>
  );
}
