# Experiment Insight Analyzer — Technical Design

Date: 2026-05-31 | Status: Design (pre-implementation) | Branch: `feature/phase3-m3-soul-experiment`

## 1. Product Goal

After running a soul behavior comparison experiment, users see a table of raw metrics (delegation count, tokens, worker order). The platform should offer a built-in, one-click analysis that uses an LLM to interpret these metrics and produce a structured, objective insight report — without requiring the user to manually compare runs or read raw trace data.

The analyzer answers questions like:
- Did different souls produce measurably different coordination behavior?
- Were the observed differences consistent with the expected differences?
- Which soul was more thorough? More efficient? Safer?
- What limitations does this comparison have?

The result is displayed as product UI (cards, badges, structured sections), not raw markdown text.

## 2. Why Internal Analyzer Service, Not User Agent

| Consideration | Internal Analyzer Service | User-Created Agent |
|--------------|--------------------------|-------------------|
| Appears in Agents list? | No | Yes (pollutes agent list) |
| Can be added to workflows? | No | Yes (confuses workflow semantics) |
| Has soul/context/memory? | No | Yes (unnecessary overhead) |
| Creates proposed memories? | No | Risk of accidental learning loop |
| Model config scoped to experiment? | Yes | Would need global agent config |
| Can use env var fallback for API key? | Yes | Agent API keys stored in agent config |
| Isolation from user agents? | Complete | Blurred boundary |

The analyzer is an **internal platform capability**, same category as `ReviewService` and `ReflectionService`. It reads experiment data, calls an LLM, and returns structured analysis. It has no identity, no persistence as an agent, and no ability to modify platform state.

## 3. Data Inputs

The analyzer receives a comprehensive snapshot of the experiment:

### Primary inputs (always included in analysis prompt)

| Data | Source | Format in prompt |
|------|--------|-----------------|
| Experiment metadata | `Experiment` model | Name, description, task_prompt, evaluation_config |
| Soul comparison config | `evaluation_config` | experiment_type, soul_ids, workflow_id |
| Variant metrics | `comparison_result.variants[]` | Per-soul: delegation count, worker order, tokens, iterations, final decision, output preview |
| Per-variant run data | `Run` + observatory | status, elapsed_ms, token_usage_summary, agent_executions |
| Collaboration graphs | `GET /runs/{id}/collaboration-graph` | Delegation edges, worker response edges, chain summary |

### Secondary inputs (included for richer analysis)

| Data | Source | Format in prompt |
|------|--------|-----------------|
| Agent definitions (supervisor + workers) | `Agent` models | role, system_prompt, soul snapshot per variant |
| Soul definitions | `Soul` models | name, principles, decision_style, collaboration_style |
| Full final outputs | `Run.output.final_output` | Truncated to 2000 chars each to manage prompt size |
| Expected differences | `evaluation_config.expected_differences` | Optional user-provided hypothesis text |
| Token usage details | `observatory_service.token_usage_summary` | Per-agent breakdown |

### Data NOT included

- Private agent context entries (security — could contain secrets)
- Private agent memory records (security — could contain sensitive content)
- Full trace event payloads (prompt size — too verbose)
- Reviewer evaluations (separate concern — not part of behavior comparison)

## 4. Model Configuration Design

### Config storage location: `experiment.evaluation_config`

The analysis model configuration lives in `evaluation_config.analysis_config`:

```json
{
  "experiment_type": "soul_behavior_comparison",
  "workflow_id": 330,
  "supervisor_agent_id": 629,
  "soul_ids": [400, 401],
  "expected_differences": "Authoritative soul should delegate fewer times with shorter instructions...",
  "analysis_config": {
    "provider": "openai_compatible",
    "base_url": "https://api.deepseek.com",
    "model": "deepseek-v4-flash",
    "temperature": 0.1,
    "max_tokens": 4096
  }
}
```

**Why `analysis_config` in `evaluation_config`**:
- Already persisted with the experiment — no new column needed
- Already exposed via `GET /experiments/{id}` — no new endpoint needed
- Survives page refresh and navigation
- `api_key` is NEVER stored here (see §5)

### Frontend config UI

On the Experiment Detail page, an "Analysis Settings" collapsible section shows:
- Provider dropdown: `mock`, `openai_compatible`, `openai`, `anthropic` (only `mock` and `openai_compatible` functional initially)
- Base URL: text input (pre-filled from env var default)
- Model name: text input with suggestions (deepseek-v4-flash, deepseek-v4-pro, gpt-4o, gpt-4o-mini)
- API Key: password input, masked, **never pre-filled from storage**
- Temperature: slider or number input, default 0.1 (analysis should be deterministic)
- Max tokens: number input, default 4096

All fields except API key are persisted in `evaluation_config.analysis_config`. Changing them and saving the experiment updates the config.

### Default values

If no `analysis_config` is present, defaults are read from environment:
- `provider`: `LLM_PROVIDER` env var (or `"openai_compatible"`)
- `base_url`: `OPENAI_COMPATIBLE_BASE_URL` env var
- `model`: `OPENAI_COMPATIBLE_MODEL` env var (or `"deepseek-v4-flash"`)
- `temperature`: `0.1`
- `max_tokens`: `4096`

## 5. API Key Handling Recommendation

### Recommendation: NEVER persist. Session-only input. Env var fallback.

| Approach | Persisted? | Secure? | UX |
|----------|-----------|---------|-----|
| Store in evaluation_config | Yes | ❌ Exposed in API responses, logs, DB dumps | Convenient |
| Store in separate encrypted field | Yes | ⚠️ Needs key management, still decryptable server-side | Convenient |
| Session-only frontend input | No | ✅ Never leaves memory | Must re-enter each session |
| **Fall back to env var** | No | ✅ Server-side only, never in DB | Zero user friction |

**Recommended**: Two-tier approach.

**Tier 1 — Environment variable (preferred for most users)**:
- `OPENAI_COMPATIBLE_API_KEY` is already set in `.env` for workflow runs.
- The analysis service reads this env var by default.
- If the env var is set, the API key field is pre-filled as `••••••••` (masked) and the user doesn't need to enter anything.

**Tier 2 — Session-only override (for users who want a different key)**:
- The API key input on the experiment detail page accepts a key.
- The key is sent to the backend in the `POST /experiments/{id}/analyze` request body.
- The backend uses it for that single analysis call, then discards it.
- The key is NEVER stored in the database, NEVER logged, NEVER returned in responses.
- The key is masked (`••••••••`) in the frontend input.

**Backend implementation**:
```python
def _resolve_api_key(config: dict, settings: Settings) -> str:
    """Resolve API key: session override > env var > error."""
    session_key = config.get("api_key", "").strip()
    if session_key:
        return session_key
    if settings.openai_compatible_api_key:
        return settings.openai_compatible_api_key
    raise ValueError("No API key available. Set OPENAI_COMPATIBLE_API_KEY or provide a session key.")
```

**Frontend masking**:
- API key field type is `password`.
- When loaded from env var (backend indicates "key_from_env": true), show `••••••••` placeholder.
- When user types a new key, it's sent in the request and used for that session.
- The field is never populated from stored data.

## 6. Backend Service Design

### New file: `backend/app/services/experiment_analysis_service.py`

Patterned after `review_service.py` (767 lines, internal LLM service with JSON parsing):

```python
class ExperimentAnalysisService:
    """Internal platform service. Not a user agent. Read-only over experiment data."""

    def __init__(self, db: Session, settings: Settings):
        self.db = db
        self.settings = settings

    def analyze(self, experiment: Experiment, analysis_config: dict) -> AnalysisResult:
        """Run analysis and return structured result."""
        # 1. Gather all data inputs
        # 2. Build analysis prompt
        # 3. Call LLM via provider
        # 4. Parse + validate JSON response
        # 5. Return AnalysisResult
```

### Key methods

| Method | Purpose |
|--------|---------|
| `analyze(experiment, config)` | Main entry point. Gathers data, calls LLM, parses result. |
| `_gather_experiment_data(experiment)` | Collects all experiment/run/collaboration data into a structured dict. |
| `_build_analysis_prompt(data, config)` | Assembles the system + user prompt for the LLM. |
| `_call_llm(prompt, config)` | Calls the LLM via `OpenAICompatibleProvider` (or mock). |
| `_parse_analysis_response(raw)` | JSON extraction, validation, 3-attempt repair. Same pattern as review_service. |
| `_validate_analysis(result)` | Pydantic validation against `AnalysisResult` schema. |

### Provider usage

The analyzer uses the existing `OpenAICompatibleProvider` directly — same as workflow runs and review service. The provider is created per-call with the analysis config's `base_url` and `api_key`, NOT from global settings:

```python
def _call_llm(self, prompt: str, config: dict) -> ProviderResponse:
    provider = OpenAICompatibleProvider(
        api_key=config["api_key"],
        base_url=config["base_url"],
        model=config.get("model", ""),
        provider_name="experiment_analysis",
        timeout=float(self.settings.llm_timeout_seconds),
    )
    return provider.generate(prompt, {
        "model": config.get("model", ""),
        "temperature": config.get("temperature", 0.1),
        "max_tokens": config.get("max_tokens", 4096),
    })
```

### What the analyzer CANNOT do

- Cannot modify agents, souls, workflows, runs, memories, context, or proposed memories
- Cannot create feedback, evaluations, or learning events
- Cannot access private agent context/memory content
- Cannot call tools through Tool Gateway
- Cannot hand off to other agents

## 7. Endpoint / API Design

### `POST /experiments/{experiment_id}/analyze`

**Request body** (`ExperimentAnalysisRequest`):
```json
{
  "provider": "openai_compatible",
  "base_url": "https://api.deepseek.com",
  "model": "deepseek-v4-flash",
  "api_key": "sk-...",
  "temperature": 0.1,
  "max_tokens": 4096
}
```

All fields optional — fall back to env var defaults or experiment's `analysis_config`.

**Response** (`ExperimentAnalysisResponse`):
```json
{
  "experiment_id": 42,
  "analyzed_at": "2026-05-31T12:00:00Z",
  "provider": "openai_compatible",
  "model": "deepseek-v4-flash",
  "analysis": {
    "executive_summary": "...",
    "flow_comparison": { ... },
    "behavioral_differences": [ ... ],
    "expected_vs_actual": { ... },
    "signals": { ... },
    "limitations": [ ... ],
    "recommended_next_steps": [ ... ]
  }
}
```

### Why POST, not GET

- Analysis calls an external LLM — side effect (cost, time, network)
- POST is the correct verb for non-idempotent resource creation
- GET with query params for API key would expose it in URLs/logs

### No separate GET endpoint needed

- Analysis result is returned inline from POST
- Analysis result is also stored in `comparison_result.ai_analysis` (see §10)
- `GET /experiments/{id}` returns the experiment with `evaluation_config`
- `GET /experiments/{id}/runs` returns experiment runs with `comparison_result` (which includes `ai_analysis` if analysis was run)

### Existing APIs assessment

| Need | Existing API supports? |
|------|----------------------|
| Get experiment config | YES — `GET /experiments/{id}` |
| Get comparison result | YES — `GET /experiments/{id}/runs` |
| Get collaboration graph | YES — `GET /runs/{id}/collaboration-graph` |
| Get run details | YES — `GET /runs/{id}` |
| Get token usage | YES — `GET /runs/{id}/monitor` |
| Run analysis | **NO — new `POST` needed** |
| Get past analysis | YES after storage — `GET /experiments/{id}/runs` |

**One new endpoint required**: `POST /experiments/{experiment_id}/analyze`. All data gathering uses existing endpoints internally.

## 8. Structured Analysis Schema

### `AnalysisResult` (Pydantic model)

```python
class FlowComparison(BaseModel):
    """Side-by-side comparison of coordination flow per variant."""
    variant_soul_name: str
    variant_soul_id: int
    delegation_pattern: str  # e.g. "Sequential: Triage → Policy → Writer"
    worker_coverage: str     # e.g. "Used 3/3 available workers"
    decision_style_observed: str  # e.g. "Decisive — finished after 3 delegations"
    instruction_style: str   # e.g. "Short, direct instructions (avg 150 chars)"
    synthesis_approach: str  # e.g. "Delegated to Writer then forwarded output"


class BehavioralDifference(BaseModel):
    """One behavioral difference between variants."""
    dimension: str           # e.g. "delegation_thoroughness"
    observation: str         # What was observed
    variant_a_behavior: str  # Behavior of first variant
    variant_b_behavior: str  # Behavior of second variant
    significance: str        # "clear_signal" | "suggestive" | "inconclusive"
    confidence_rationale: str


class ExpectedVsActual(BaseModel):
    """Comparison of expected differences vs actual observations."""
    expected: str            # What the user expected
    matched: list[str]       # Expectations that were confirmed
    unmatched: list[str]     # Expectations that were not observed
    surprising: list[str]    # Unexpected differences found


class Signals(BaseModel):
    """Quantitative behavioral signals. NOT a winner declaration."""
    efficiency: dict[str, str | None]   # Which variant was more efficient and why
    thoroughness: dict[str, str | None]  # Which variant was more thorough and why
    safety: dict[str, str | None]       # Which variant was safer and why
    overall_pattern: str                 # Summary pattern, not a winner
    caveat: str  # Mandatory: "These are observable signals, not definitive quality judgments."


class AnalysisResult(BaseModel):
    executive_summary: str
    flow_comparison: list[FlowComparison]
    behavioral_differences: list[BehavioralDifference]
    expected_vs_actual: Optional[ExpectedVsActual] = None  # Only if expected_differences configured
    signals: Signals
    limitations: list[str]
    recommended_next_steps: list[str]
```

### Why "signals", not "winner"

The analyzer explicitly refuses to declare a "better" soul. It reports observable behavioral signals with confidence levels (`clear_signal`, `suggestive`, `inconclusive`). The `Signals.caveat` field is mandatory and appears prominently in the UI:

> *"These are observable behavioral signals from a single experiment run, not definitive quality judgments. Different tasks, worker pools, or LLM randomness may produce different patterns. Use these signals to guide further experiments, not to select a 'best' soul."*

### JSON repair strategy

Same 3-attempt pattern as `review_service.py`:
1. Extract JSON from markdown fence or raw text
2. Parse + validate against `AnalysisResult` schema
3. If fails: stack-based bracket closure repair
4. If fails: trim-last-field repair
5. If fails: return error with raw text preview

Mock provider fallback produces deterministic `AnalysisResult` with SHA-256 digest-based content.

## 9. Frontend UX Design

### Analysis section on Experiment Detail page

Located below the soul comparison table, in its own Card:

```
┌──────────────────────────────────────────────────────────┐
│ 🔬 Experiment Analysis                                   │
│                                                          │
│ [Analysis Settings]  (collapsible)                       │
│   Provider: [openai_compatible ▼]                        │
│   Base URL: [https://api.deepseek.com               ]    │
│   Model:     [deepseek-v4-flash                      ]   │
│   API Key:   [••••••••                    ] (env)        │
│   Temperature: [0.1]  Max Tokens: [4096]                 │
│                                                          │
│ [Run Analysis]  (button)                                 │
│                                                          │
│ ── Analysis Results (if run) ──                          │
│                                                          │
│ ┌─ Executive Summary ────────────────────────────────┐   │
│ │ The Authoritative soul completed the task in 3      │   │
│ │ delegations with shorter instructions, while the    │   │
│ │ Collaborative soul used 4 delegations with richer   │   │
│ │ context in each instruction. Both preserved safety  │   │
│ │ guardrails. Neither missed key risk signals.        │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Flow Comparison ──────────────────────────────────┐   │
│ │ Authoritative: Triage→Policy→Writer (3 delegations) │   │
│ │ Collaborative: Triage→Policy→Triage→Writer (4)      │   │
│ │ [expand for per-variant detail]                     │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Behavioral Differences ───────────────────────────┐   │
│ │ ┌──────────────────────────────────────────────┐    │   │
│ │ │ Delegation Thoroughness   [clear_signal]      │    │   │
│ │ │ Authoritative: 3 delegations, avg instr 180c  │    │   │
│ │ │ Collaborative: 4 delegations, avg instr 340c  │    │   │
│ │ │ The Collaborative soul re-engaged Triage for  │    │   │
│ │ │ additional risk assessment before finalizing. │    │   │
│ │ └──────────────────────────────────────────────┘    │   │
│ │ ┌──────────────────────────────────────────────┐    │   │
│ │ │ Instruction Specificity   [suggestive]         │    │   │
│ │ │ ...                                            │    │   │
│ │ └──────────────────────────────────────────────┘    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Signals ──────────────────────────────────────────┐   │
│ │ Efficiency: Authoritative (fewer tokens, faster)    │   │
│ │ Thoroughness: Collaborative (more worker coverage)  │   │
│ │ Safety: Both equivalent (risk signals caught)       │   │
│ │                                                     │   │
│ │ ⚠️ These are observable signals from a single       │   │
│ │ experiment run, not definitive quality judgments.   │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Limitations ──────────────────────────────────────┐   │
│ │ • Single task — results may not generalize          │   │
│ │ • Mock provider used — real LLM may differ          │   │
│ │ • One worker pool — different workers may change    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Recommended Next Steps ───────────────────────────┐   │
│ │ • Re-run with 3+ tasks to confirm pattern            │   │
│ │ • Test with different worker pools                   │   │
│ │ • Compare with a risk-averse soul variant            │   │
│ └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### States

| State | UI |
|-------|-----|
| **Before analysis configured** | Analysis Settings collapsed; "Configure analysis model to get insights" |
| **Ready to run** | Settings visible; "Run Analysis" button enabled |
| **Running** | Button shows spinner; "Analyzing experiment data with deepseek-v4-flash..." |
| **Analysis complete** | Full analysis sections rendered |
| **Error** | Alert with error message; raw LLM output preview if parse failed |
| **No comparison data** | "Run the experiment first to generate comparison data." |
| **Using mock** | Badge: "Mock analysis" with note that real LLM is recommended |

### API key UX

- Field type: `password`
- Placeholder: `••••••••` when env var is available (backend returns `key_from_env: true` in analysis response metadata)
- Empty field + no env var → "Run Analysis" shows tooltip: "API key required"
- After entering key: used for that session; discarded on page unload

## 10. Storage Strategy

### Recommendation: Store in `comparison_result.ai_analysis`

```json
{
  "experiment_type": "soul_behavior_comparison",
  "variants": [ ... ],
  "ai_analysis": {
    "analyzed_at": "2026-05-31T12:00:00Z",
    "provider": "openai_compatible",
    "model": "deepseek-v4-flash",
    "result": { <AnalysisResult> }
  }
}
```

### Why `comparison_result`:

| Option | Pros | Cons |
|--------|------|------|
| `comparison_result.ai_analysis` | No new table; co-located with comparison data; returned by existing API | One analysis per experiment run |
| Separate `experiment_analyses` table | Multiple analyses per experiment; independent lifecycle | New table, new API, overengineered for MVP |
| Not stored (regenerate on demand) | No storage; always fresh | Costs tokens every page view; slow |

**Decision**: Store in `comparison_result.ai_analysis` for phase 1. If users need multiple analyses per experiment run (e.g., comparing analysis models), add a separate table in phase 2.

### Behavior:

- `POST /experiments/{id}/analyze` → stores result in the latest `ExperimentRun.comparison_result.ai_analysis`
- `GET /experiments/{id}/runs` → returns `comparison_result` with `ai_analysis` if present
- Re-running analysis overwrites the previous `ai_analysis` for that experiment run
- Running the experiment again creates a new `ExperimentRun` → new `comparison_result` without `ai_analysis` → user must re-run analysis

## 11. Mock / Test Strategy

### Mock analysis provider

Same pattern as mock reviewer in `review_service.py`:

```python
class MockAnalysisProvider:
    def analyze(self, prompt: str, config: dict) -> AnalysisResult:
        """Deterministic mock analysis for tests."""
        digest = hashlib.sha256(prompt.encode()).hexdigest()[:12]
        return AnalysisResult(
            executive_summary=f"[mock-analysis:{digest}] Both variants completed the task. "
                            f"Differences were observed in delegation patterns.",
            flow_comparison=[...],
            behavioral_differences=[...],
            signals=Signals(
                efficiency={"observation": "Similar", "rationale": "Mock analysis"},
                thoroughness={"observation": "Similar", "rationale": "Mock analysis"},
                safety={"observation": "Similar", "rationale": "Mock analysis"},
                overall_pattern="Deterministic mock — run with real LLM for insights.",
                caveat="Mock analysis. Real LLM recommended."
            ),
            limitations=["Mock analysis — not real LLM output."],
            recommended_next_steps=["Re-run analysis with real LLM provider."],
        )
```

### Test cases

| Test | What it verifies |
|------|-----------------|
| `test_analyze_soul_comparison_mock` | Mock provider returns valid `AnalysisResult` |
| `test_analyze_requires_comparison_data` | 400 if experiment has no runs yet |
| `test_analyze_stores_result_in_comparison` | `ai_analysis` present in `comparison_result` after analysis |
| `test_analyze_api_key_not_in_response` | Response does not contain the API key |
| `test_analyze_api_key_not_in_logs` | API key masked in trace/execution events |
| `test_analyze_json_repair_truncated` | Truncated LLM output is repaired and parsed |
| `test_analyze_fallback_on_parse_failure` | Unparseable LLM output returns error with raw preview |
| `test_analyze_does_not_modify_agents` | No agent/soul/workflow/run mutations after analysis |
| `test_analyze_sequential_experiment_graceful` | Analysis of standard experiment returns useful message |
| `test_analyze_with_env_var_api_key` | Analysis succeeds with API key from env var |
| `test_analyze_with_session_api_key` | Session key overrides env var |
| `test_frontend_displays_analysis_after_run` | Analysis sections render correctly |
| `test_frontend_shows_empty_before_analysis` | "Run analysis to see insights" before first analysis |

## 12. Security and Privacy Considerations

### API key security

| Risk | Mitigation |
|------|-----------|
| Key stored in DB | NEVER stored. Session-only + env var. |
| Key in API responses | `AnalysisResult` schema has no `api_key` field. Backend strips it before response. |
| Key in logs | `_readable_error()` in provider already truncates. Analysis service never logs the key. |
| Key in trace events | Analysis calls don't create trace events (they're not workflow runs). |
| Key in browser memory | Password field with autocomplete="off". GC clears on unmount. |
| Key in URL | POST body only, never query params. |

### Data exposure

| Risk | Mitigation |
|------|-----------|
| Private agent context in analysis prompt | Analysis data gatherer only includes experiment/run/collaboration data, not agent context entries |
| Private memory in analysis prompt | Same — memory content excluded |
| Analysis result exposes raw run data | Only aggregated metrics + analysis, not full trace events |

### API abuse

| Risk | Mitigation |
|------|-----------|
| User spams analysis → high LLM costs | No built-in rate limit for MVP. Document cost awareness. Future: per-experiment cooldown. |
| User uses malicious base_url | base_url validated as HTTP/HTTPS; provider call wrapped in timeout |

## 13. Implementation Phases

### Phase 1: Core analyzer (1 session)

**Backend**:
- `ExperimentAnalysisService` with mock + real LLM support
- `POST /experiments/{id}/analyze` endpoint
- `AnalysisResult` Pydantic schema with all sub-models
- JSON repair (reuse existing pattern from review_service)
- API key resolution (session > env var)
- Store result in `comparison_result.ai_analysis`

**Frontend**:
- Analysis Settings section (collapsible, persisted config)
- Run Analysis button with loading state
- Executive Summary card
- Flow Comparison section (per-variant cards)
- Behavioral Differences list with confidence badges
- Signals section with mandatory caveat
- Limitations + Recommended Next Steps
- API key password input with env var indication

**Tests**: All mock tests from §11.

### Phase 2: Enhanced display (if needed, 0.5-1 session)

- Expected vs Actual comparison section (when `expected_differences` is configured)
- Expandable per-variant detail cards in Flow Comparison
- Link to collaboration graph for each variant directly from analysis
- Analysis history (view previous analyses for this experiment)

### Phase 3: Multi-model comparison (future, 1 session)

- Run analysis with multiple models (e.g., DeepSeek vs GPT-4o)
- Compare analysis quality across models
- Store multiple analyses per experiment run

### Out of scope for all phases

- Automatic winner selection ("Soul A is better than Soul B")
- Analysis as a scheduled/automated pipeline
- Analysis of non-experiment runs
- Analysis sharing/export (PDF, CSV)
- Cost tracking for analysis calls (same `estimated_cost` issue as other LLM calls)

## 14. Risks and Trade-offs

### Risk 1: LLM hallucination in analysis

**Risk**: LLM invents behavioral differences that don't exist in the data.

**Mitigation**:
- System prompt instructs: "Only report differences supported by the provided data. If two variants behaved identically in a dimension, say so rather than inventing differences."
- Confidence levels (`clear_signal`, `suggestive`, `inconclusive`) force the LLM to qualify its claims.
- `Signals.caveat` is mandatory and displayed prominently.
- Mock provider produces deterministic output for regression testing.

### Risk 2: Prompt size with many variants

**Risk**: 5+ soul variants with full outputs could exceed context window.

**Mitigation**:
- Truncate final outputs to 2000 chars each.
- Truncate instruction text to 500 chars each.
- For >5 variants, sample the most informative metrics and note truncation in limitations.
- Use a model with sufficient context window (DeepSeek v4: 128K tokens).

### Risk 3: User expects "winner" declaration

**Risk**: Users may interpret the analysis as declaring one soul "better."

**Mitigation**:
- The word "winner" never appears in the schema, prompt, or UI.
- `Signals.caveat` explicitly states this is not a quality judgment.
- The UI uses neutral language: "Signals," "Observations," "Patterns."
- Behavioral differences are always framed as trade-offs, not rankings.

### Risk 4: API key handling UX friction

**Risk**: Users frustrated by re-entering API key each session.

**Mitigation**:
- Env var fallback means most users never enter a key.
- When env var is set, the UI shows `•••••••• (from environment)` — clear and reassuring.
- Session-only input is only needed for users who want a different key than the env var.

### Risk 5: Analysis cost

**Risk**: Each analysis call consumes LLM tokens (~3000-8000 tokens depending on variant count).

**Mitigation**:
- Token usage is tracked and displayed in analysis metadata.
- Analysis is explicitly triggered by user action — no automatic analysis.
- Mock provider is available for development/testing.

## 15. Recommended Next Implementation Step

**Start with Phase 1 core analyzer.**

Scope: 1 session, full-stack (backend service + endpoint + frontend UI).

Key files to create/modify:
- `backend/app/services/experiment_analysis_service.py` (new, ~300 lines)
- `backend/app/schemas/analysis.py` (new, ~100 lines)
- `backend/app/api/experiments.py` (add `POST /{id}/analyze`)
- `frontend/src/lib/types.ts` (add analysis types)
- `frontend/src/lib/api.ts` (add `analyzeExperiment`)
- `frontend/src/pages/ExperimentsPage.tsx` (add analysis section)
- `backend/tests/test_experiment_analysis.py` (new, ~150 lines)

Existing APIs that support this without changes:
- `GET /experiments/{id}` — experiment config + evaluation_config
- `GET /experiments/{id}/runs` — comparison_result (now includes ai_analysis)
- `GET /runs/{id}` — run detail
- `GET /runs/{id}/collaboration-graph` — collaboration data

Only one new endpoint needed: `POST /experiments/{id}/analyze`.
