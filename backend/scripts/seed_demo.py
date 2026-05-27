#!/usr/bin/env python3
"""Seed the Customer Escalation Recovery learning demo.

Creates three agents and a sequential workflow for demonstrating the full
feedback-reflect-approve-re-run learning loop.

Usage:
    python scripts/seed_demo.py [--base-url http://localhost:8000]

The script is idempotent: re-running it creates new agents and workflow each time.
"""

import argparse
import json
import os
import sys
from typing import Any
from urllib import request
from urllib.error import HTTPError, URLError


def api_post(base: str, path: str, body: dict) -> dict:
    url = f"{base}{path}"
    data = json.dumps(body).encode("utf-8")
    req = request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with request.urlopen(req) as resp:
            return json.loads(resp.read())
    except HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        print(f"  POST {path} failed ({exc.code}): {detail}", file=sys.stderr)
        raise


ESCALATION_TRIAGE_AGENT = {
    "name": "Escalation Triage Agent",
    "role": "escalation-triage",
    "system_prompt": (
        "You are an escalation triage specialist. Analyze customer complaints to determine "
        "severity, identify repeated information requests, and assess escalation risk. "
        "Never ask customers for information they have already provided. "
        "Flag chargeback threats, public complaint risks, and regulatory concerns immediately. "
        "When you see a pattern of repeated support contacts, treat it as a high-priority case."
    ),
    "soul_name": "Diana - Escalation Triage",
    "soul_persona": (
        "Methodical and detail-oriented triage analyst. "
        "Prioritizes customer risk signals over process formalities. "
        "Direct communicator who flags risks without sugar-coating."
    ),
    "llm_provider": "mock",
    "model": "mock-deterministic",
    "temperature": 0.2,
    "max_tokens": 1024,
    "memory_policy": {"write_mode": "manual_review", "retrieval_enabled": True},
    "context_policy": {"include_active_context": True},
    "handoff_policy": {"allow_handoff": False, "allowed_agent_ids": []},
    "is_active": True,
}

POLICY_GUARDRAIL_AGENT = {
    "name": "Policy Guardrail Agent",
    "role": "policy-guardrail",
    "system_prompt": (
        "You are a policy compliance guard. Review responses for policy violations, "
        "verify refund eligibility before promising refunds, and ensure regulatory "
        "requirements are met. Flag any response that promises a refund before "
        "verification is complete. Identify chargeback risk indicators and "
        "recommend escalation to human agents when appropriate."
    ),
    "soul_name": "Victor - Policy Guard",
    "soul_persona": (
        "Strict but fair compliance officer who protects both customer and company interests. "
        "Known for catching policy gaps before they become liabilities. "
        "Believes in process but not at the expense of customer fairness."
    ),
    "llm_provider": "mock",
    "model": "mock-deterministic",
    "temperature": 0.2,
    "max_tokens": 1024,
    "memory_policy": {"write_mode": "manual_review", "retrieval_enabled": True},
    "context_policy": {"include_active_context": True},
    "handoff_policy": {"allow_handoff": False, "allowed_agent_ids": []},
    "is_active": True,
}

CUSTOMER_RESPONSE_WRITER = {
    "name": "Customer Response Writer",
    "role": "customer-response-writer",
    "system_prompt": (
        "You are a customer response writer. Draft empathetic, professional responses "
        "to escalated complaints. Never ask for information already provided by the "
        "customer. Include clear next steps and, when appropriate, recommend urgent "
        "human follow-up for high-risk cases. Verify all facts before writing."
    ),
    "soul_name": "Clara - Customer Response",
    "soul_persona": (
        "Empathetic communicator who balances customer care with business reality. "
        "Writes clear, actionable responses that make customers feel heard while "
        "protecting the company from unnecessary liability."
    ),
    "llm_provider": "mock",
    "model": "mock-deterministic",
    "temperature": 0.3,
    "max_tokens": 1536,
    "memory_policy": {"write_mode": "manual_review", "retrieval_enabled": True},
    "context_policy": {"include_active_context": True},
    "handoff_policy": {"allow_handoff": False, "allowed_agent_ids": []},
    "is_active": True,
}

FIRST_COMPLAINT = (
    "Customer Complaint - Order #ORD-98234:\n"
    "I've contacted support 3 times already about my missing item from order #ORD-98234. "
    "The delivery was 2 weeks late and now the package is missing the main item I ordered. "
    "I paid $249.99 for this and I'm getting nowhere with your team. "
    "If this isn't resolved today I'm filing a chargeback with my credit card company "
    "and posting about this on social media. "
    "My email is customer@example.com and phone is 555-0123."
)

SECOND_COMPLAINT = (
    "Customer Complaint - Order #ORD-10456:\n"
    "This is my fourth attempt to get help. I ordered a premium subscription upgrade "
    "3 weeks ago, was charged $199.99 immediately, but my account still shows the basic tier. "
    "I've emailed twice and called once with no resolution. "
    "My order number is ORD-10456 and you can reach me at jane@example.com. "
    "If my account isn't upgraded by tomorrow I will dispute the charge and file a complaint "
    "with the consumer protection agency."
)

FEEDBACK_TEXT = (
    "The agent asked for the order number and contact details when both were already "
    "provided in the complaint. It failed to identify the chargeback threat and social "
    "media risk. It promised a refund without verification. It did not recommend urgent "
    "human follow-up for this high-risk case."
)


def create_agent(base_url: str, agent_def: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "name": agent_def["name"],
        "role": agent_def["role"],
        "system_prompt": agent_def["system_prompt"],
        "llm_provider": agent_def.get("llm_provider", "mock"),
        "model": agent_def.get("model", "mock-deterministic"),
        "temperature": agent_def.get("temperature", 0.2),
        "max_tokens": agent_def.get("max_tokens", 1024),
        "memory_policy": agent_def.get("memory_policy", {}),
        "context_policy": agent_def.get("context_policy", {}),
        "handoff_policy": agent_def.get("handoff_policy", {}),
        "is_active": agent_def.get("is_active", True),
    }

    # Create soul first, then attach to agent
    if "soul_name" in agent_def:
        soul = api_post(base_url, "/souls", {
            "name": agent_def["soul_name"],
            "persona": agent_def.get("soul_persona", ""),
            "is_active": True,
        })
        payload["soul_id"] = soul["id"]

    agent = api_post(base_url, "/agents", payload)
    print(f"  Created agent: {agent['name']} (id={agent['id']})")
    return agent


def create_workflow(base_url: str, agent_ids: list[int]) -> dict[str, Any]:
    payload = {
        "name": "Escalation Recovery Workflow",
        "workflow_type": "sequential",
        "graph_config": {"agent_sequence": agent_ids},
        "is_active": True,
    }
    workflow = api_post(base_url, "/workflows", payload)
    print(f"  Created workflow: {workflow['name']} (id={workflow['id']})")
    return workflow


def main():
    parser = argparse.ArgumentParser(description="Seed Customer Escalation Recovery demo")
    parser.add_argument("--base-url", default=os.environ.get("API_BASE_URL", "http://localhost:8000"))
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    print(f"Seeding Customer Escalation Recovery demo at {base} ...")
    print()

    # Create agents
    print("Creating agents:")
    triage = create_agent(base, ESCALATION_TRIAGE_AGENT)
    policy = create_agent(base, POLICY_GUARDRAIL_AGENT)
    writer = create_agent(base, CUSTOMER_RESPONSE_WRITER)
    print()

    # Create workflow
    print("Creating workflow:")
    workflow = create_workflow(base, [triage["id"], policy["id"], writer["id"]])
    print()

    print("=" * 60)
    print("Demo seeded successfully.")
    print()
    print(f"  Workflow ID: {workflow['id']}")
    print(f"  Agent IDs:   triage={triage['id']}  policy={policy['id']}  writer={writer['id']}")
    print()
    print("First complaint (paste into Run input):")
    print("-" * 40)
    print(FIRST_COMPLAINT)
    print("-" * 40)
    print()
    print("Feedback (paste after first run completes):")
    print("-" * 40)
    print(FEEDBACK_TEXT)
    print("-" * 40)
    print()
    print("Second complaint (paste after approving memory):")
    print("-" * 40)
    print(SECOND_COMPLAINT)
    print("-" * 40)
    print()
    print("Manual demo steps:")
    print("  1. Open http://localhost:3000")
    print(f"  2. Run workflow {workflow['id']} with the first complaint")
    print("  3. Submit feedback on the run (Escalation Triage Agent)")
    print("  4. Click 'Generate Proposed Memory from Feedback'")
    print("  5. Go to agent detail, approve the proposed memory")
    print("  6. Re-run the workflow with the second complaint")
    print("  7. Compare: second run should not ask for already-provided info")
    print("=" * 60)


if __name__ == "__main__":
    main()
