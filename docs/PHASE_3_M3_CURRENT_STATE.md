# Phase 3 M3 — Current State

Date: 2026-06-01 | Branch: merged to `main` | PR: #9

## Phase 3 Status

| Milestone | Status | Key Deliverables |
|-----------|--------|-----------------|
| M1: Supervisor Workflow Runtime | ✅ Complete | `SupervisorRunner`, `ActionDecisionParser`, `RunnerFactory`, worker context enrichment, lazy execution creation |
| M2: Collaboration Observability | ✅ Complete | `GET /runs/{id}/collaboration-graph`, Collaboration section on Run Detail |
| M3: Soul Behavior Experiment | ✅ Complete | Soul comparison experiments, experiment insight analyzer, comparison UI, analysis UX |
| M4: Handoff Workflow Runtime | ⬜ Pending | `HandoffSwarmRunner`, handoff chain execution |
| M5: Teamwork Learning Demo | ⬜ Pending | Multi-agent demo scenario with learning loop |

## Supervisor Workflow

### graph_config format

```json
// sequential (unchanged)
{"agent_sequence": [1, 2, 3]}

// supervisor
{
  "supervisor_agent_id": 629,
  "worker_agent_ids": [625, 626, 627],
  "max_iterations": 10
}
```

### Key behaviors
- `worker_agent_ids` is an **unordered allowed worker pool** — supervisor can delegate in any order
- Worker executions created lazily on first delegation (not pre-created)
- Workers receive: supervisor instruction + original task + prior worker outputs
- Workers use only their own soul/context/memory/tools (isolation enforced)
- Accumulated outputs are run-scoped, never persisted to agent memory
- Mock provider: supervisor falls back to `finish` (mock output is non-JSON)
- Real LLM: supervisor produces structured JSON decisions (`delegate`/`finish`)

### Collaboration graph
- `GET /runs/{id}/collaboration-graph` — derived from trace events, no persistent graph table
- Nodes: deduplicated by agent_id from AgentExecution records
- Edges: delegation edges from `supervisor_delegated` events, response edges from `worker_responded` events
- Works for both sequential (nodes only) and supervisor workflows

## Soul Behavior Experiment

### How it works
1. User creates experiment with `evaluation_config.experiment_type = "soul_behavior_comparison"`
2. `evaluation_config` contains: `workflow_id`, `supervisor_agent_id`, `soul_ids`, optional `expected_differences`
3. `POST /experiments/{id}/run` → `_run_soul_comparison()`:
   - For each soul: saves original `supervisor.soul_id`, sets new soul, runs workflow, restores soul in `finally`
   - Collects metrics per variant via `_collect_variant_metrics()`
   - Stores `comparison_result` on `ExperimentRun`

### comparison_result structure
```json
{
  "experiment_type": "soul_behavior_comparison",
  "workflow_id": 330,
  "supervisor_agent_id": 629,
  "supervisor_agent_name": "...",
  "task_prompt": "...",
  "variants": [
    {
      "soul_id": 400,
      "soul_name": "Authoritative Supervisor",
      "run_id": 332,
      "status": "completed",
      "delegation_count": 3,
      "worker_order": [625, 626, 627],
      "unique_workers_used": 3,
      "total_available_workers": 3,
      "supervisor_iterations": 4,
      "final_decision": "finish",
      "total_tokens": 14483,
      "avg_instruction_length": 451.5,
      "final_output_preview": "<first 300 chars>",
      "full_final_output": "<complete output>",
      "collaboration_graph_url": "/runs/332/collaboration-graph"
    }
  ],
  "ai_analysis": {  // only if analysis was run
    "analyzed_at": "...",
    "provider": "openai_compatible",
    "model": "deepseek-v4-flash",
    "result": { <AnalysisResult> }
  }
}
```

### Metrics collected per variant
- `delegation_count`, `worker_order`, `unique_workers_used`, `total_available_workers`
- `supervisor_iterations`, `final_decision`, `total_tokens`, `estimated_cost`
- `avg_instruction_length`, `final_output_preview` (300 chars), `full_final_output`, `collaboration_graph_url`

## Experiment Insight Analyzer

### Architecture
- Internal platform service (`ExperimentAnalysisService`) — NOT a user agent
- No soul, no context, no memory, no workflow participation, no proposed memories
- Read-only over experiment/run/collaboration data
- Stores analysis in `comparison_result.ai_analysis`

### Endpoint
- `POST /experiments/{id}/analyze` — runs analysis, stores result, returns structured response

### Request shape (`ExperimentAnalysisRequest`)
```json
{
  "provider": "openai_compatible",     // optional, defaults to env/saved config
  "base_url": "https://api.deepseek.com",  // optional
  "model": "deepseek-v4-flash",        // optional
  "api_key": "sk-...",                 // optional, NEVER stored
  "temperature": 0.1,                  // optional, default 0.1
  "max_tokens": 8192,                  // optional, default 8192
  "analysis_guidance": "Focus on..."   // optional user guidance
}
```

### Config persistence (`evaluation_config.analysis_config`)
```json
{
  "provider": "openai_compatible",
  "base_url": "https://api.deepseek.com",
  "model": "deepseek-v4-flash",
  "temperature": 0.1,
  "max_tokens": 8192,
  "analysis_guidance": "Optional user focus areas"
}
```

### API key handling
- **NEVER stored** in DB, never returned in responses, never logged
- Tier 1: `OPENAI_COMPATIBLE_API_KEY` env var (auto-detected, shown as `••••••••`)
- Tier 2: Session-only POST body `api_key` field (discarded after use)
- Response metadata includes `key_from_env: true/false`

### Analysis lifecycle

| State | Trigger | Behavior |
|-------|---------|----------|
| **idle** | No analysis run yet | "Run Analysis" button visible; AI analysis section shows nothing |
| **running** | `POST /analyze` in progress | Animated pulsing indicator; button disabled |
| **completed** | Analysis parsed successfully | Structured analysis cards rendered; stored in `ai_analysis` |
| **failed** | Parse/LLM error | Error message with raw preview; suggest increasing max_tokens |
| **stale** | Experiment re-run | New `ExperimentRun` created without `ai_analysis`; old analysis on previous run |

### Key invariants
- Edit experiment (name/description/config) → `ai_analysis` preserved on existing runs
- Page refresh → `ai_analysis` loaded from `experimentRun.comparison_result` (survives refresh)
- Re-run experiment → new `ExperimentRun` without `ai_analysis` (no stale analysis)
- `api_key` never appears in GET responses, error messages, or logs

### Parse pipeline (3 attempts + LLM fallback)
1. Direct parse + trailing comma removal
2. Extract JSON + 5-retry bracket/string repair
3. LLM repair call ("Repair this into valid JSON")
4. Actionable error with raw preview and max_tokens suggestion

## Frontend: Experiment Detail Page

### Sections (top to bottom)
1. **Configuration form** — name, type (locked after creation), description, agents/souls, task prompt, eval config
2. **Run Experiment** card
3. **Soul Comparison Results** (only for soul_behavior_comparison)
   - Behavior signals summary (worker coverage, delegation comparison, tokens)
   - Metrics table (soul, run, status, delegations, workers, iterations, tokens, decision)
   - Expandable variant panels with: numbered delegation steps, instruction length, tokens, expandable full output, Run Detail button
4. **AI Experiment Analysis** (only for soul_behavior_comparison)
   - Analysis Settings (collapsible): provider, base_url, model, api_key, temperature, max_tokens, analysis guidance
   - Run Analysis / Re-run button
   - Structured results: executive summary, flow comparison, behavioral differences, expected vs actual, signals, limitations, next steps

### Output display
- Collapsed: 3-line `line-clamp-3` preview with "Final output (first 60 chars...)" toggle
- Expanded: scrollable div (max-h-80) with full `full_final_output` in `whitespace-pre-wrap`
- No hover-only content

### Worker order display
- Numbered `<ol>` steps with agent names
- Repeated workers indicated with `×(N)` suffix
- Uses actual delegation order from `worker_order`, not `worker_agent_ids` config order

### Analysis running state
- Animated pulsing dots (3 dots, staggered 0ms/200ms/400ms)
- Status text: "Analyzing experiment data with {model}..."
- Descriptive subtitle: "Comparing delegation patterns, worker sequences, token usage, and generating structured insights..."
- Run Analysis button disabled during analysis

### Edit support
- "Edit experiment" button toggles form fields from read-only to editable
- Experiment type locked after creation
- Save sends only changed fields via `PUT /experiments/{id}`
- Cancel reverts to original values
- Existing runs and `ai_analysis` preserved

## API Endpoints (new in M3)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/experiments/{id}/runs` | List experiment runs (with comparison_result) |
| `PUT` | `/experiments/{id}` | Update experiment config |
| `POST` | `/experiments/{id}/analyze` | Run AI analysis |

## Known Issues / Limitations

- `estimated_cost` always 0.0 (no cost-per-token lookup)
- Supervisor `elapsed_ms` spans entire run (not per-iteration)
- No Alembic migrations (inline column inspection)
- Real OpenAI/Anthropic/Ollama providers are stubs
- `HandoffSwarmRunner` not implemented
- Teamwork Learning Demo not implemented
- No WebSocket monitoring
- Collaboration graph uses API URL convention (`/runs/{id}/collaboration-graph`) not frontend route

## Recommended Next Step

**Phase 3 M4: Handoff Workflow Runtime** — implement `HandoffSwarmRunner` for peer-to-peer agent handoff chains, reusing the proven `ActionDecisionParser` and lazy execution patterns from M1.

Alternatively, if the user prefers: continue polishing the Experiment analyzer UX (cost estimation, analysis history, multi-model comparison) before adding new runtime features.
