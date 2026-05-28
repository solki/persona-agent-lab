import { Activity, ClipboardCopy, ExternalLink, Play, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "@/components/shared/Alert";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Agent, DemoSeedResponse, Workflow } from "@/lib/types";

type ChecklistItem = {
  label: string;
  done: boolean;
};

export function DemoPage() {
  const [seedResult, setSeedResult] = useState<DemoSeedResponse | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const checkDemoState = useCallback(async () => {
    try {
      const [wfs, ags] = await Promise.all([api.listWorkflows(), api.listAgents()]);
      const demoWf = wfs.find((w) => w.name.startsWith("Demo:"));
      const demoAgs = ags.filter((a) => a.name.startsWith("Demo:"));
      setWorkflow(demoWf ?? null);
      setAgents(demoAgs);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkDemoState();
  }, [checkDemoState, refreshKey]);

  async function handleSeed() {
    setSeeding(true);
    setError("");
    setMessage("");
    try {
      const result = await api.seedDemo();
      setSeedResult(result);
      setChecklist(result.acceptance_checklist.map((label) => ({ label, done: false })));
      setRefreshKey((k) => k + 1);
      const createdCount = result.agents.filter((a) => a.created).length;
      const reusedCount = result.agents.filter((a) => !a.created).length;
      setMessage(
        `Demo seeded: ${createdCount} created, ${reusedCount} reused across souls, agents, contexts, and memories.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to seed demo.");
    } finally {
      setSeeding(false);
    }
  }

  async function handleCleanup() {
    if (!confirm("Delete all demo data? This will remove demo souls, agents, contexts, memories, workflow, and related runs.")) return;
    setCleaning(true);
    setError("");
    setMessage("");
    try {
      await api.cleanupDemo();
      setSeedResult(null);
      setChecklist([]);
      setWorkflow(null);
      setAgents([]);
      setRefreshKey((k) => k + 1);
      setMessage("Demo data cleaned up.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clean up demo data.");
    } finally {
      setCleaning(false);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  function toggleChecklistItem(index: number) {
    setChecklist((prev) => prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item)));
  }

  const triageAgent = agents.find((a) => a.name.includes("Triage"));
  const existingDemo = workflow || agents.length > 0;

  return (
    <div>
      <PageHeader
        title="Phase 2 Acceptance Demo"
        description="Customer Escalation Recovery — prove the real LLM learning loop works end-to-end."
      />

      {error && <Alert title="Error" tone="error">{error}</Alert>}
      {message && <Alert title="Info" tone="success">{message}</Alert>}

      {/* Demo setup card */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-mono text-sm font-medium flex items-center gap-2">
            <Play size={16} />
            Customer Escalation Recovery Learning Demo
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Seeds 3 agents (Escalation Triage, Policy Guardrail, Customer Response Writer) with souls,
            initial contexts, active memories, and a sequential workflow. Uses the
            {existingDemo ? " current LLM provider" : " configured LLM provider"}
            {" "}for realistic agent behavior.
          </p>

          <div className="flex gap-3">
            <Button onClick={handleSeed} disabled={seeding}>
              <RefreshCw size={14} className={seeding ? "animate-spin mr-2" : "mr-2"} />
              {seeding ? "Seeding..." : existingDemo ? "Seed Demo (Re-run)" : "Seed Demo"}
            </Button>
            {existingDemo && (
              <Button variant="destructive" onClick={handleCleanup} disabled={cleaning}>
                <Trash2 size={14} className="mr-2" />
                {cleaning ? "Cleaning..." : "Cleanup Demo Data"}
              </Button>
            )}
          </div>

          {/* Show what was created / reused */}
          {seedResult && (() => {
            const sections: Array<[string, DemoSeedResponse["souls"]]> = [
              ["Souls", seedResult.souls],
              ["Agents", seedResult.agents],
              ["Contexts", seedResult.contexts],
              ["Memories", seedResult.memories],
            ];
            return (
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {sections.map(([label, items]) => (
                  <div key={label} className="rounded-sm border border-border p-3">
                    <h3 className="font-mono text-xs font-medium text-muted-foreground">{label}</h3>
                    <div className="mt-1 space-y-0.5">
                      {items.map((item) => (
                        <div key={item.id} className="text-xs flex items-center gap-1.5">
                          <span className={item.created ? "text-emerald-400" : "text-amber-400"}>
                            {item.created ? "+" : "↻"}
                          </span>
                          <span className="truncate">{item.name}</span>
                          {item.created ? null : <span className="text-muted-foreground text-[10px]">(reused)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {existingDemo && (
        <>
          {/* Step-by-step guide */}
          <Card className="mb-6">
            <CardHeader>
              <h2 className="font-mono text-sm font-medium flex items-center gap-2">
                <Activity size={16} />
                Step-by-Step Acceptance Checklist
              </h2>
              <p className="text-xs text-muted-foreground">
                Follow each step to prove the real LLM learning loop. Check off as you complete.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {checklist.length > 0
                  ? checklist.map((item, i) => (
                      <label
                        key={i}
                        className="flex items-start gap-3 p-2 rounded-sm hover:bg-panel-hover cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleChecklistItem(i)}
                          className="mt-0.5 h-4 w-4 rounded-sm border-border accent-primary"
                        />
                        <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                          {item.label}
                        </span>
                      </label>
                    ))
                  : seedResult?.acceptance_checklist.map((item, i) => (
                      <label
                        key={i}
                        className="flex items-start gap-3 p-2 rounded-sm hover:bg-panel-hover cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          onChange={() => toggleChecklistItem(i)}
                          className="mt-0.5 h-4 w-4 rounded-sm border-border accent-primary"
                        />
                        <span className="text-sm">{item}</span>
                      </label>
                    ))}
              </div>
            </CardContent>
          </Card>

          {/* Prompts and links */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="font-mono text-sm font-medium">First Run Complaint</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="whitespace-pre-wrap text-xs bg-panel rounded-sm p-3 text-muted-foreground max-h-40 overflow-y-auto">
                  {seedResult?.first_complaint ?? "Seed demo first to see the complaint text."}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(seedResult?.first_complaint ?? "", "complaint1")}
                  disabled={!seedResult}
                >
                  <ClipboardCopy size={12} className="mr-1.5" />
                  {copied === "complaint1" ? "Copied!" : "Copy"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-mono text-sm font-medium">Suggested Feedback (for Triage Agent)</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="whitespace-pre-wrap text-xs bg-panel rounded-sm p-3 text-muted-foreground max-h-40 overflow-y-auto">
                  {seedResult?.feedback_text ?? "Seed demo first."}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(seedResult?.feedback_text ?? "", "feedback")}
                  disabled={!seedResult}
                >
                  <ClipboardCopy size={12} className="mr-1.5" />
                  {copied === "feedback" ? "Copied!" : "Copy"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Second complaint */}
          <Card className="mt-4">
            <CardHeader>
              <h2 className="font-mono text-sm font-medium">Second Run Complaint (After Approving Memory)</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="whitespace-pre-wrap text-xs bg-panel rounded-sm p-3 text-muted-foreground max-h-40 overflow-y-auto">
                {seedResult?.second_complaint ?? "Seed demo first."}
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(seedResult?.second_complaint ?? "", "complaint2")}
                disabled={!seedResult}
              >
                <ClipboardCopy size={12} className="mr-1.5" />
                {copied === "complaint2" ? "Copied!" : "Copy"}
              </Button>
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card className="mt-4">
            <CardHeader>
              <h2 className="font-mono text-sm font-medium">Quick Links</h2>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {workflow && (
                  <Link to={`/workflows/${workflow.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink size={12} className="mr-1.5" />
                      Workflow: {workflow.name}
                    </Button>
                  </Link>
                )}
                {triageAgent && (
                  <Link to={`/agents/${triageAgent.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink size={12} className="mr-1.5" />
                      Triage Agent
                    </Button>
                  </Link>
                )}
                {workflow && (
                  <Link to={`/runs`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink size={12} className="mr-1.5" />
                      View Runs
                    </Button>
                  </Link>
                )}
                {agents.filter((a) => a.is_active).length > 0 && (
                  <Link to={`/agents`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink size={12} className="mr-1.5" />
                      All Demo Agents ({agents.filter((a) => a.is_active).length})
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Demo workflow instructions */}
          <Card className="mt-4">
            <CardHeader>
              <h2 className="font-mono text-sm font-medium">How to Run the Demo</h2>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>
                  {workflow ? (
                    <Link to={`/workflows/${workflow.id}`} className="text-primary hover:underline">
                      Go to the demo workflow
                    </Link>
                  ) : (
                    "Go to Workflows and find the Demo workflow"
                  )}
                  , paste the <strong>First Run Complaint</strong>, and click Run.
                </li>
                <li>Wait for the 3-agent sequential run to complete (watch the monitor page).</li>
                <li>
                  On the completed run detail page, select the <strong>Escalation Triage Agent</strong>{" "}
                  execution, paste the <strong>Suggested Feedback</strong>, set type to{" "}
                  <strong>Correction</strong>, and submit.
                </li>
                <li>Click <strong>Generate Proposed Memory from Feedback</strong> to trigger LLM reflection.</li>
                <li>
                  {triageAgent ? (
                    <Link to={`/agents/${triageAgent.id}`} className="text-primary hover:underline">
                      Go to the Triage Agent detail
                    </Link>
                  ) : (
                    "Go to the Triage Agent detail"
                  )}
                  , find the pending proposed memory, and <strong>Approve</strong> it.
                </li>
                <li>Return to the demo workflow and re-run it with the <strong>Second Run Complaint</strong>.</li>
                <li>Compare the second run output: the agent should not ask for already-provided information.</li>
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
