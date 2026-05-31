# Experiment Insight Analyzer — Current State

Date: 2026-06-01 | Merged in PR #9

## Overview

The Experiment Insight Analyzer is an internal platform service that uses an LLM to analyze soul behavior comparison experiment results. It produces structured, product-readable insights displayed as UI cards with confidence badges, behavioral signals, and mandatory caveats.

**Not a user agent** — no soul, context, memory, workflow participation, or proposed memories. Read-only over experiment/run/collaboration data.

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `backend/app/schemas/analysis.py` | 111 | `AnalysisResult`, `FlowComparison`, `BehavioralDifference`, `ExpectedVsActual`, `Signals`, request/response schemas |
| `backend/app/services/experiment_analysis_service.py` | 578 | Data gathering, prompt building, LLM call, 3-attempt + LLM repair parse pipeline, mock analysis |
| `backend/app/api/experiments.py` | +28 | `POST /{id}/analyze` endpoint |
| `backend/tests/test_experiment_analysis.py` | 192 | 10 tests: missing experiment, no runs, mock analysis, storage, persistence across reload, edit safety, rerun freshness, API key security, non-soul-comp rejection |
| `frontend/src/pages/ExperimentsPage.tsx` | `AnalysisSection` component | Settings UI, Run/Re-run button, structured result display, error with expandable raw preview |

## Endpoint

`POST /experiments/{experiment_id}/analyze`

**Request** (`ExperimentAnalysisRequest`):
```json
{
  "provider": "openai_compatible",
  "base_url": "https://api.deepseek.com",
  "model": "deepseek-v4-flash",
  "api_key": "sk-...",
  "temperature": 0.1,
  "max_tokens": 8192,
  "analysis_guidance": "Focus on deliverable alignment"
}
```
All fields optional. Falls back to `evaluation_config.analysis_config` (persisted) → env vars.

**Response** (`ExperimentAnalysisResponse`):
```json
{
  "experiment_id": 42,
  "analyzed_at": "2026-06-01T12:00:00Z",
  "provider": "openai_compatible",
  "model": "deepseek-v4-flash",
  "key_from_env": true,
  "analysis": {
    "executive_summary": "...",
    "flow_comparison": [{...}],
    "behavioral_differences": [{...}],
    "expected_vs_actual": {...},
    "signals": {
      "efficiency": {"observation": "...", "rationale": "..."},
      "thoroughness": {"observation": "...", "rationale": "..."},
      "safety": {"observation": "...", "rationale": "..."},
      "overall_pattern": "...",
      "caveat": "These are signals, not definitive quality judgments."
    },
    "limitations": ["..."],
    "recommended_next_steps": ["..."]
  }
}
```

## Config persistence

Non-secret config lives in `experiment.evaluation_config.analysis_config`:
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

Persisted via `PUT /experiments/{id}`. API key is NEVER in this config.

## API key handling

| Layer | Behavior |
|-------|----------|
| Environment | `OPENAI_COMPATIBLE_API_KEY` used by default |
| Session input | `api_key` in POST body, used for one call, discarded |
| Storage | NEVER written to DB |
| Response | NEVER returned in response body |
| Logs | NEVER logged |
| Frontend | Password field, placeholder shows `(from environment)` when env var active |

## Analysis storage

- Stored in `ExperimentRun.comparison_result.ai_analysis`
- Key structure: `{analyzed_at, provider, model, result: <AnalysisResult>}`
- `flag_modified()` used to ensure SQLAlchemy detects JSON column mutation

## Parse pipeline

```
LLM output → Attempt 1: direct parse + trailing comma removal
          → Attempt 2: extract JSON + 5-retry bracket/string repair
          → Attempt 3: LLM repair call (provider ≠ mock only)
          → Actionable error: max_tokens hint + validation error + raw preview
```

Key functions:
- `_extract_json()` — balanced brace matching
- `_extract_partial_json()` — takes from first `{` to end-of-string
- `_remove_trailing_commas()` — regex before `json.loads()`
- `_close_unclosed_string()` — appends `"` if text ends mid-string
- `_close_brackets()` — stack-based bracket/brace closure
- `_trim_last_field()` — removes last incomplete JSON field
- `_llm_repair()` — one LLM call to fix structural issues only

## Schema tolerance

- All sub-models: `model_config = {"extra": "ignore"}`
- `BehavioralDifference.significance`: normalized via `field_validator` (accepts `"clear signal"` → `"clear_signal"`, defaults to `"inconclusive"`)
- `AnalysisResult.expected_vs_actual`: optional, omitted when no expected differences
- List fields default to `[]`

## Prompt design

The analyzer prompt has three layers:

1. **Task-goal-first framework** (always included): Identifies the requested deliverable from the task, evaluates variants against it, flags output format mismatches, unsupported operational/timeline/legal claims
2. **JSON skeleton** (always included): Exact structure the LLM must fill in, no markdown, no trailing commas
3. **User guidance** (optional): Appended under `## User analysis guidance` with note that platform rules cannot be overridden

Key prompt rules (non-overridable):
- Never declare a "winner"
- More workers ≠ better coordination
- Skipping a worker is neutral unless task required that worker
- Significance: clear_signal / suggestive / inconclusive
- Caveat is mandatory

## Mock analysis

- Deterministic via SHA-256 digest of input data
- Returns valid `AnalysisResult` with `[mock-analysis:{digest}]` markers
- Used when `provider = "mock"` or when expected differences are empty
- All 10 analysis tests use mock provider

## Frontend display

| Card | Content |
|------|---------|
| Executive Summary | Full-width bordered card with summary text |
| Flow Comparison | Per-variant cards: delegation pattern, coverage, decision style, instruction style, synthesis approach |
| Behavioral Differences | Per-difference cards with dimension, significance badge (green/amber/gray), variant A/B comparison, confidence rationale |
| Expected vs Actual | 3-column grid: matched (green), unmatched (amber), surprising (blue) |
| Signals | 3-column efficiency/thoroughness/safety with overall pattern + amber caveat box |
| Limitations | Bullet list |
| Next Steps | Bullet list |

## Lifecycle states

| State | Condition | UI |
|-------|-----------|-----|
| No comparison data | Experiment not run yet | Analysis section hidden |
| Idle | Comparison exists, no analysis | "Run Analysis" button; empty state |
| Running | `POST /analyze` in progress | Animated pulsing dots + status text; button disabled |
| Complete | Parsed successfully | Full structured analysis cards; "Re-run" button |
| Error | Parse/LLM failed | Error alert with truncated message; expandable raw preview; "re-run" suggestion |
| Stale after rerun | Experiment re-run | New run has no `ai_analysis`; old analysis on previous run still viewable |

## Editor integration

- Edit experiment preserves `ai_analysis` (stored per `ExperimentRun`, not per `Experiment`)
- Analysis config editable via experiment edit form (provider, base_url, model, temperature, max_tokens, guidance)
- API key never persists through edit/save
