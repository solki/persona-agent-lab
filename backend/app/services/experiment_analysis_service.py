"""Experiment Insight Analyzer — internal platform service.

Reads experiment, run, collaboration, and token data to produce a
structured LLM analysis.  Read‑only over platform state except for
storing the analysis result in comparison_result.ai_analysis.

NOT a user agent — no soul, no context, no memory, no workflow
participation, no proposed memories.
"""

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models.agent import Agent
from app.models.experiment import Experiment, ExperimentRun
from app.models.soul import Soul
from app.runtime.openai_compatible_provider import OpenAICompatibleProvider, ProviderConfigurationError
from app.runtime.provider_interface import ProviderResponse
from app.schemas.analysis import (
    AnalysisResult,
    BehavioralDifference,
    ExpectedVsActual,
    FlowComparison,
    Signals,
)
from app.services import collaboration_service, experiment_service, observatory_service


class ExperimentAnalysisError(ValueError):
    """Raised when analysis cannot proceed (missing data, bad config, etc.)."""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def analyze_experiment(
    db: Session,
    experiment: Experiment,
    request_config: dict[str, Any],
    settings: Optional[Settings] = None,
) -> dict[str, Any]:
    """Run analysis for an experiment and return the full response dict.

    Returns a dict matching ExperimentAnalysisResponse so the API layer
    can return it directly.
    """
    if settings is None:
        settings = get_settings()

    # Validate experiment has comparison data
    runs = experiment_service.list_experiment_runs(db, experiment.id)
    if not runs:
        raise ExperimentAnalysisError("Experiment has no runs. Run the experiment first.")
    latest_run = runs[0]
    comparison = latest_run.comparison_result or {}
    if comparison.get("experiment_type") != "soul_behavior_comparison":
        raise ExperimentAnalysisError("Experiment is not a soul behavior comparison.")

    # Resolve config
    eval_cfg = experiment.evaluation_config or {}
    saved_cfg = eval_cfg.get("analysis_config", {}) if isinstance(eval_cfg, dict) else {}
    provider_name = request_config.get("provider") or saved_cfg.get("provider") or settings.llm_provider
    model = request_config.get("model") or saved_cfg.get("model") or settings.openai_compatible_model or "deepseek-v4-flash"
    base_url = request_config.get("base_url") or saved_cfg.get("base_url") or settings.openai_compatible_base_url
    temperature = float(request_config.get("temperature") or saved_cfg.get("temperature") or 0.1)
    max_tokens = int(request_config.get("max_tokens") or saved_cfg.get("max_tokens") or 8192)
    api_key, key_from_env = _resolve_api_key(request_config, settings)

    # Gather data
    data = _gather_data(db, experiment, comparison, latest_run)

    # Run analysis
    if provider_name == "mock":
        result = _mock_analysis(data)
    else:
        result = _llm_analysis(data, provider_name, base_url, model, api_key, temperature, max_tokens)

    # Store result (copy dict so SQLAlchemy detects the JSON column change)
    from sqlalchemy.orm.attributes import flag_modified

    comparison = dict(latest_run.comparison_result or {})
    comparison["ai_analysis"] = {
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "provider": provider_name,
        "model": model,
        "result": result.model_dump(),
    }
    latest_run.comparison_result = comparison
    flag_modified(latest_run, "comparison_result")
    db.commit()
    db.refresh(latest_run)

    return {
        "experiment_id": experiment.id,
        "analyzed_at": datetime.now(timezone.utc),
        "provider": provider_name,
        "model": model,
        "key_from_env": key_from_env,
        "analysis": result.model_dump(),
    }


# ---------------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------------


def _gather_data(db: Session, experiment: Experiment, comparison: dict, latest_run: ExperimentRun) -> dict:
    """Collect all data needed for the analysis prompt."""
    variants = comparison.get("variants", [])
    supervisor = db.get(Agent, comparison.get("supervisor_agent_id"))

    souls_by_id: dict[int, dict] = {}
    for v in variants:
        soul = db.get(Soul, v.get("soul_id"))
        if soul:
            souls_by_id[soul.id] = {"id": soul.id, "name": soul.name, "decision_style": soul.decision_style or "", "principles": (soul.principles or "")[:500]}

    variant_details = []
    for v in variants:
        run_id = v.get("run_id")
        run_detail = _safe_run_output(db, run_id) if run_id else {}
        collab = {}
        try:
            collab = collaboration_service.build_collaboration_graph(db, run_id) if run_id else {}
        except Exception:
            pass
        variant_details.append({
            "soul_name": v.get("soul_name", ""),
            "run_id": run_id,
            "status": v.get("status", ""),
            "delegation_count": v.get("delegation_count", 0),
            "worker_order": v.get("worker_order", []),
            "unique_workers_used": v.get("unique_workers_used", 0),
            "supervisor_iterations": v.get("supervisor_iterations", 0),
            "final_decision": v.get("final_decision"),
            "total_tokens": v.get("total_tokens", 0),
            "avg_instruction_length": v.get("avg_instruction_length"),
            "final_output": (run_detail.get("final_output") or v.get("final_output_preview", ""))[:2000],
            "collab_summary": {
                "edges_count": len(collab.get("edges", [])),
                "worker_agent_ids": sorted({e.get("to_agent_id") for e in collab.get("edges", []) if e.get("type") == "delegation" and e.get("to_agent_id")}),
            },
        })

    return {
        "experiment_name": experiment.name,
        "task_prompt": experiment.task_prompt[:3000],
        "supervisor_name": supervisor.name if supervisor else "unknown",
        "expected_differences": (comparison.get("expected_differences") or experiment.evaluation_config.get("expected_differences", "") if isinstance(experiment.evaluation_config, dict) else ""),
        "souls": [souls_by_id.get(v.get("soul_id"), {}) for v in variants],
        "variants": variant_details,
    }


# ---------------------------------------------------------------------------
# LLM analysis
# ---------------------------------------------------------------------------


def _llm_analysis(
    data: dict,
    provider_name: str,
    base_url: str,
    model: str,
    api_key: str,
    temperature: float,
    max_tokens: int,
) -> AnalysisResult:
    prompt = _build_prompt(data)
    response = _call_provider(prompt, provider_name, base_url, model, api_key, temperature, max_tokens)
    return _parse_response(response.content)


def _build_prompt(data: dict) -> str:
    variants_json = json.dumps(data["variants"], indent=2, ensure_ascii=False)
    souls_json = json.dumps(data["souls"], indent=2, ensure_ascii=False)
    expected = data.get("expected_differences", "")

    expected_section = ""
    if expected:
        expected_section = f"\n\n## Expected differences (user hypothesis)\n{expected}"

    return f"""You are an experiment analysis assistant. Analyze the soul behavior comparison data below.

## Experiment
Name: {data["experiment_name"]}
Supervisor: {data["supervisor_name"]}
Task: {data["task_prompt"]}

## Soul definitions
{souls_json}

## Variant results
{variants_json}{expected_section}

## Instructions
Produce a JSON object with these fields:

1. "executive_summary": 2-4 sentence summary of key findings.
2. "flow_comparison": array of per-variant objects with: variant_soul_name, variant_soul_id, delegation_pattern, worker_coverage, decision_style_observed, instruction_style, synthesis_approach.
3. "behavioral_differences": array of objects with: dimension, observation, variant_a_behavior, variant_b_behavior, significance ("clear_signal"|"suggestive"|"inconclusive"), confidence_rationale.
4. "expected_vs_actual": (only if expected differences provided) object with: expected, matched (string array), unmatched (string array), surprising (string array). Omit if no expected_differences.
5. "signals": object with: efficiency (observation + rationale), thoroughness (observation + rationale), safety (observation + rationale), overall_pattern (summary string), caveat (mandatory disclaimer that these are signals, not definitive judgments).
6. "limitations": array of strings noting limitations of this analysis.
7. "recommended_next_steps": array of strings with actionable next steps.

Rules:
- Only report differences supported by the provided data.
- If variants behaved identically in a dimension, say so.
- Never declare a "winner" or "better" soul.
- Use confidence levels: clear_signal (strong evidence), suggestive (visible but could be noise), inconclusive (not enough data).
- The caveat field in signals is MANDATORY.
- Return ONLY the JSON object, no other text."""


def _call_provider(
    prompt: str,
    provider_name: str,
    base_url: str,
    model: str,
    api_key: str,
    temperature: float,
    max_tokens: int,
) -> ProviderResponse:
    if provider_name not in ("openai_compatible", "openai"):
        raise ExperimentAnalysisError(f"Provider '{provider_name}' is not supported for analysis. Use openai_compatible.")

    try:
        provider = OpenAICompatibleProvider(
            api_key=api_key,
            base_url=base_url,
            model=model,
            provider_name="experiment_analysis",
            timeout=120,
        )
    except ProviderConfigurationError as exc:
        raise ExperimentAnalysisError(str(exc))

    return provider.generate(prompt, {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
    })


def _parse_response(raw: str) -> AnalysisResult:
    json_text = _extract_json(raw)

    # Try parsing the extracted JSON
    if json_text:
        result, error = _parse_and_validate(json_text)
        if result is not None:
            return result
        repaired = _repair_json(json_text)
        if repaired:
            result, error = _parse_and_validate(repaired)
            if result is not None:
                return result

    # If no complete JSON was found (truncated output), try to repair
    # the raw text directly — the LLM may have hit max_tokens mid-output
    if not json_text:
        json_text = _extract_partial_json(raw)
    if json_text:
        repaired = _repair_json(json_text)
        if repaired:
            result, error = _parse_and_validate(repaired)
            if result is not None:
                return result

    raise ExperimentAnalysisError(f"Could not parse analysis LLM output. Raw preview: {raw[:500]}")


def _extract_partial_json(raw: str) -> str | None:
    """Extract a JSON object that starts but may not be complete (truncated).

    Returns the text from the first '{' to the end, which _repair_json
    can then attempt to close and validate.
    """
    start = raw.find("{")
    if start == -1:
        return None
    # Take everything from the first brace to the end
    return raw[start:]


# ---------------------------------------------------------------------------
# Mock analysis
# ---------------------------------------------------------------------------


def _mock_analysis(data: dict) -> AnalysisResult:
    digest = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:12]
    variants = data.get("variants", [])
    v_names = [v["soul_name"] for v in variants[:2]]
    v_a = v_names[0] if len(v_names) > 0 else "Variant A"
    v_b = v_names[1] if len(v_names) > 1 else "Variant B"

    return AnalysisResult(
        executive_summary=f"[mock-analysis:{digest}] Both variants completed the task. Observable differences in delegation patterns were identified. Run with a real LLM for detailed behavioral insights.",
        flow_comparison=[
            FlowComparison(
                variant_soul_name=v.get("soul_name", "Unknown"),
                variant_soul_id=v.get("run_id", 0),
                delegation_pattern=f"Mock: {v.get('delegation_count', 0)} delegations",
                worker_coverage=f"Mock: {v.get('unique_workers_used', 0)} workers",
                decision_style_observed="Mock analysis — run with real LLM.",
                instruction_style="Mock analysis — run with real LLM.",
                synthesis_approach="Mock analysis — run with real LLM.",
            )
            for v in variants
        ],
        behavioral_differences=[
            BehavioralDifference(
                dimension="delegation_count",
                observation=f"{v_a}: {variants[0].get('delegation_count', 0)} delegations, {v_b}: {variants[1].get('delegation_count', 0)} delegations" if len(variants) >= 2 else "Not enough variants.",
                variant_a_behavior=f"{variants[0].get('delegation_count', 0)} delegations" if len(variants) >= 1 else "",
                variant_b_behavior=f"{variants[1].get('delegation_count', 0)} delegations" if len(variants) >= 2 else "",
                significance="suggestive",
                confidence_rationale="Mock analysis — run with real LLM for confidence assessment.",
            )
        ],
        signals=Signals(
            efficiency={"observation": "Similar", "rationale": "Mock analysis."},
            thoroughness={"observation": "Similar", "rationale": "Mock analysis."},
            safety={"observation": "Similar", "rationale": "Mock analysis."},
            overall_pattern=f"[mock:{digest}] Mock analysis. Real LLM recommended for behavioral insights.",
            caveat="Mock analysis — not real LLM output. Re-run with openai_compatible provider for actual analysis.",
        ),
        limitations=["Mock analysis — not real LLM output.", "Run with a real LLM provider for actual behavioral insights."],
        recommended_next_steps=["Re-run analysis with openai_compatible provider and a real model.", "Compare results across 3+ tasks for statistical confidence."],
    )


# ---------------------------------------------------------------------------
# API key resolution
# ---------------------------------------------------------------------------


def _resolve_api_key(request_config: dict, settings: Settings) -> tuple[str, bool]:
    session_key = (request_config.get("api_key") or "").strip()
    if session_key:
        return session_key, False
    if settings.openai_compatible_api_key:
        return settings.openai_compatible_api_key, True
    raise ExperimentAnalysisError("No API key available. Set OPENAI_COMPATIBLE_API_KEY or provide api_key in request.")


# ---------------------------------------------------------------------------
# JSON parsing helpers (same pattern as action_decision_parser + review_service)
# ---------------------------------------------------------------------------


def _extract_json(raw: str) -> Optional[str]:
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fence:
        return fence.group(1)
    start = raw.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(raw)):
        ch = raw[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return raw[start : i + 1]
    return None


def _parse_and_validate(json_text: str) -> tuple[Optional[AnalysisResult], str]:
    try:
        obj = json.loads(json_text)
        return AnalysisResult.model_validate(obj), ""
    except (json.JSONDecodeError, ValueError) as exc:
        return None, str(exc)


def _repair_json(text: str) -> Optional[str]:
    for _ in range(3):
        repaired = _close_brackets(text)
        if repaired and _is_valid_json(repaired):
            return repaired
        trimmed = _trim_last_field(text)
        if trimmed and trimmed != text:
            text = trimmed
            continue
        break
    return None


def _close_brackets(text: str) -> Optional[str]:
    stack: list[str] = []
    in_string = False
    escape = False
    for ch in text:
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            stack.append("}")
        elif ch == "[":
            stack.append("]")
        elif ch in ("}", "]"):
            if stack and stack[-1] == ch:
                stack.pop()
    if not stack:
        return text if _is_valid_json(text) else None
    return text + "".join(reversed(stack))


def _trim_last_field(text: str) -> Optional[str]:
    last_comma = text.rfind(",")
    if last_comma == -1:
        return None
    trimmed = text[:last_comma]
    closed = _close_brackets(trimmed)
    return closed or trimmed + "}"


def _is_valid_json(text: str) -> bool:
    try:
        json.loads(text)
        return True
    except json.JSONDecodeError:
        return False


def _safe_run_output(db: Session, run_id: int) -> dict:
    from app.models.run import Run

    run = db.get(Run, run_id)
    if run is None:
        return {}
    return {
        "status": run.status,
        "final_output": (run.output or {}).get("final_output", ""),
        "iterations": (run.output or {}).get("iterations", 0),
        "elapsed_ms": int((run.ended_at - run.started_at).total_seconds() * 1000) if run.started_at and run.ended_at else None,
    }
