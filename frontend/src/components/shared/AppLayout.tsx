import { Beaker, Brain, FlaskConical, Hammer, History, Home, Network, Play, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useNotification } from "@/lib/NotificationContext";

const nav = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/souls", label: "Souls", icon: Brain },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/tools", label: "Tools", icon: Hammer },
  { href: "/workflows", label: "Workflows", icon: Network },
  { href: "/runs", label: "Runs", icon: History },
  { href: "/demo", label: "Demo", icon: Play },
  { href: "/experiments", label: "Experiments", icon: FlaskConical }
];

export function AppLayout() {
  const { totalCount } = useNotification();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-panel lg:block">
        {/* Brand */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-primary text-primary-foreground">
              <Beaker size={19} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-mono text-sm font-medium tracking-tight text-foreground">
                Agent Swarm Lab
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Observatory
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-0.5 px-3 py-4">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px]"
                      : "text-muted-foreground hover:bg-panel-hover hover:text-foreground border-l-2 border-transparent"
                  )
                }
              >
                <Icon size={16} strokeWidth={1.5} className={cn("shrink-0")} />
                <span className="font-medium">{item.label}</span>
                {item.label === "Agents" && totalCount > 0 ? (
                  <span
                    aria-label="Pending feedback memory approval"
                    className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30"
                  >
                    {totalCount}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            v0.1.0 &middot; Swarm
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
