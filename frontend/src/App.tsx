import { Refine } from "@refinedev/core";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/shared/AppLayout";
import { NotificationProvider } from "@/lib/NotificationContext";
import { AgentDetailPage, AgentFormPage, AgentsPage } from "@/pages/AgentsPage";
import { DemoPage } from "@/pages/DemoPage";
import { ExperimentFormPage, ExperimentsPage } from "@/pages/ExperimentsPage";
import { RunMonitorPage, RunsPage, RunDetailPage } from "@/pages/RunsPage";
import { SoulFormPage, SoulsPage } from "@/pages/SoulsPage";
import { ToolFormPage, ToolsPage } from "@/pages/ToolsPage";
import { WorkflowFormPage, WorkflowsPage } from "@/pages/WorkflowsPage";

export function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
      <Refine
        resources={[
          { name: "souls", list: "/souls", create: "/souls/new", edit: "/souls/:id" },
          { name: "agents", list: "/agents", create: "/agents/new", edit: "/agents/:id" },
          { name: "tools", list: "/tools", create: "/tools/new", edit: "/tools/:id" },
          { name: "workflows", list: "/workflows", create: "/workflows/new", edit: "/workflows/:id" },
          { name: "runs", list: "/runs", show: "/runs/:id" },
          { name: "experiments", list: "/experiments", create: "/experiments/new", show: "/experiments/:id" }
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
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/workflows/new" element={<WorkflowFormPage />} />
            <Route path="/workflows/:id" element={<WorkflowFormPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:id" element={<RunDetailPage />} />
            <Route path="/runs/:id/monitor" element={<RunMonitorPage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/experiments" element={<ExperimentsPage />} />
            <Route path="/experiments/new" element={<ExperimentFormPage />} />
            <Route path="/experiments/:id" element={<ExperimentFormPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Refine>
      </NotificationProvider>
    </BrowserRouter>
  );
}

function Overview() {
  return (
    <div>
      <h1 className="font-mono text-xl font-medium tracking-tight">Agent Swarm Lab</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Observatory for managing personas, agents, tools, workflows, runs, and experiments across the agent swarm.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {[
          ["Souls", "Create and maintain persona definitions."],
          ["Agents", "Configure model settings, policies, contexts, memories, and proposed memories."],
          ["Tools", "Manage Tool Gateway registry entries."],
          ["Workflows", "Build and run ordered agent workflows."],
          ["Runs", "Inspect run history, trace payloads, monitor events, and archive state."],
          ["Experiments", "Compare agents while preserving related run history."]
        ].map(([title, body]) => (
          <div key={title} className="rounded-sm border border-border bg-panel p-4 hover:bg-panel-hover transition-colors">
            <h2 className="font-mono text-sm font-medium">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
