import { Refine } from "@refinedev/core";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/shared/AppLayout";
import { AgentDetailPage, AgentFormPage, AgentsPage } from "@/pages/AgentsPage";
import { RunsPage, RunDetailPage } from "@/pages/RunsPage";
import { SoulFormPage, SoulsPage } from "@/pages/SoulsPage";
import { ToolFormPage, ToolsPage } from "@/pages/ToolsPage";

export function App() {
  return (
    <BrowserRouter>
      <Refine
        resources={[
          { name: "souls", list: "/souls", create: "/souls/new", edit: "/souls/:id" },
          { name: "agents", list: "/agents", create: "/agents/new", edit: "/agents/:id" },
          { name: "tools", list: "/tools", create: "/tools/new", edit: "/tools/:id" },
          { name: "runs", list: "/runs", show: "/runs/:id" }
        ]}
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Overview />} />
            <Route path="/souls" element={<SoulsPage />} />
            <Route path="/souls/new" element={<SoulFormPage />} />
            <Route path="/souls/:id" element={<SoulFormPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/new" element={<AgentFormPage />} />
            <Route path="/agents/:id" element={<AgentDetailPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/tools/new" element={<ToolFormPage />} />
            <Route path="/tools/:id" element={<ToolFormPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:id" element={<RunDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}

function Overview() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Frontend v2 PoC</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        A refine + shadcn/ui prototype for validating more consistent CRUD, safer destructive actions, and easier iteration for Persona Agent Lab.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {[
          ["Souls", "Create and maintain persona definitions."],
          ["Agents", "Configure model settings, policies, contexts, memories, and proposed memories."],
          ["Tools", "Manage Tool Gateway registry entries."],
          ["Runs", "Inspect run history, trace payloads, monitor events, and archive state."]
        ].map(([title, body]) => (
          <div key={title} className="rounded-md border border-border bg-white p-4">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
