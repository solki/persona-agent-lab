import json
import re
from typing import Any

from app.schemas.actions import SupervisorDecision


class ActionParseResult:
    def __init__(self, decision, raw: str, parse_success: bool, parse_error: str = ""):
        self.decision = decision  # SupervisorDecision or HandoffDecision
        self.raw = raw
        self.parse_success = parse_success
        self.parse_error = parse_error


def parse_supervisor_decision(raw_output: str) -> ActionParseResult:
    """Extract a SupervisorDecision from raw agent output.

    Attempts JSON extraction, validation, and repair before falling back
    to treating the entire output as a 'finish' final_response.
    """
    json_text = _extract_json(raw_output)

    if json_text:
        decision, error = _parse_and_validate(json_text)
        if decision is not None:
            return ActionParseResult(decision, raw_output, True)

        repaired = _repair_json(json_text)
        if repaired is not None:
            decision, error = _parse_and_validate(repaired)
            if decision is not None:
                return ActionParseResult(decision, raw_output, True, error or "")

    final_text = raw_output.strip() or "(empty output)"
    fallback = SupervisorDecision(action="finish", final_response=final_text, reasoning="Parser fallback: could not extract valid decision JSON.")
    return ActionParseResult(fallback, raw_output, False, "Could not parse or repair JSON; fell back to finish.")


def _extract_json(raw: str) -> str | None:
    """Extract the first JSON object from raw text, preferring markdown-fenced blocks."""
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fence_match:
        return fence_match.group(1)

    brace_start = raw.find("{")
    if brace_start == -1:
        return None

    depth = 0
    in_string = False
    escape = False
    for i in range(brace_start, len(raw)):
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
                return raw[brace_start : i + 1]
    return None


def _parse_and_validate(json_text: str) -> tuple[SupervisorDecision | None, str]:
    try:
        obj = json.loads(json_text)
        decision = SupervisorDecision.model_validate(obj)
        return decision, ""
    except (json.JSONDecodeError, ValueError) as exc:
        return None, str(exc)


def _repair_json(json_text: str) -> str | None:
    """Best-effort JSON repair for truncated or malformed supervisor decisions.

    Try up to 3 strategies:
    1. Stack-based bracket closure
    2. Remove trailing partial content and re-close
    3. Comma-prefix recovery
    """
    for _attempt in range(3):
        repaired = _close_brackets(json_text)
        if repaired is not None and _is_valid_json(repaired):
            return repaired

        trimmed = _trim_last_field(json_text)
        if trimmed and trimmed != json_text:
            json_text = trimmed
            continue
        break

    return None


def _close_brackets(text: str) -> str | None:
    """Close unclosed brackets and braces in truncated JSON."""
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
        elif ch == "}":
            if stack and stack[-1] == "}":
                stack.pop()
        elif ch == "]":
            if stack and stack[-1] == "]":
                stack.pop()

    if not stack:
        return text if _is_valid_json(text) else None
    return text + "".join(reversed(stack))


def _trim_last_field(text: str) -> str | None:
    """Remove the last incomplete field from JSON text."""
    last_comma = text.rfind(",")
    if last_comma == -1:
        return None
    trimmed = text[:last_comma]
    closed = _close_brackets(trimmed)
    if closed:
        return closed
    return trimmed + "}"


def _is_valid_json(text: str) -> bool:
    try:
        json.loads(text)
        return True
    except json.JSONDecodeError:
        return False
