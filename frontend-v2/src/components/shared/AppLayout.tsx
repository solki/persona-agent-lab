import { Bot, Brain, FlaskConical, Hammer, History, Home, Network, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/souls", label: "Souls", icon: Brain },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/tools", label: "Tools", icon: Hammer },
  { href: "/workflows", label: "Workflows", icon: Network },
  { href: "/runs", label: "Runs", icon: History },
  { href: "/experiments", label: "Experiments", icon: FlaskConical }
];

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white px-4 py-5 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <Bot size={22} />
          </span>
          <span>
            <strong className="block text-base">Persona Agent Lab</strong>
            <span className="text-xs text-muted-foreground">frontend-v2 PoC</span>
          </span>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  cn(
                    "focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-muted",
                    isActive ? "bg-muted font-medium text-foreground" : null
                  )
                }
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
