"use client";

import Link from "next/link";
import { Activity, Bot, Brain, Database, Home, Hammer, Network } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NotificationBadge, PROPOSED_MEMORY_NOTIFICATION_EVENT } from "@/components/shared/NotificationBadge";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/souls", label: "Souls", icon: Brain },
  { href: "/tools", label: "Tools", icon: Hammer },
  { href: "/workflows", label: "Workflows", icon: Network },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/experiments", label: "Experiments", icon: Database }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [pendingMemoryApprovals, setPendingMemoryApprovals] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const summary = await api.getProposedMemoryNotifications();
      setPendingMemoryApprovals(summary.total_count);
    } catch {
      setPendingMemoryApprovals(0);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const refresh = () => void loadNotifications();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener(PROPOSED_MEMORY_NOTIFICATION_EVENT, refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PROPOSED_MEMORY_NOTIFICATION_EVENT, refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadNotifications]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white px-4 py-5 lg:block">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded bg-accent text-white">
            <Bot size={22} />
          </span>
          <span>
            <strong className="block text-base">Agent Swarm Lab</strong>
            <span className="text-xs text-slate-500">Isolated agent control</span>
          </span>
        </Link>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="focus-ring flex items-center gap-3 rounded px-3 py-2 text-sm text-slate-700 hover:bg-panel"
              >
                <Icon size={17} />
                <span className="flex flex-1 items-center gap-2">
                  {item.label}
                  {item.label === "Agents" ? <NotificationBadge count={pendingMemoryApprovals} /> : null}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
