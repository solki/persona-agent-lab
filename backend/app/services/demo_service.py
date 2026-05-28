from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.agent import Agent
from app.models.context import AgentContext
from app.models.learning import AgentEvaluation, AgentFeedback, ProposedMemory
from app.models.memory import AgentMemory
from app.models.observatory import AgentExecution, AgentExecutionEvent, LearningEvent, TokenUsage
from app.models.run import Run, TraceEvent
from app.models.soul import Soul
from app.models.workflow import Workflow
from app.schemas.demo import DemoCleanupResponse, DemoEntityRef, DemoSeedResponse

DEMO_PREFIX = "Demo:"
DEMO_WORKFLOW_NAME = f"{DEMO_PREFIX}Escalation Recovery Workflow"

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

ACCEPTANCE_CHECKLIST = [
    "Demo data seeded (souls, agents, contexts, memories, workflow)",
    "Workflow run created with first complaint",
    "Feedback added to Escalation Triage Agent on the completed run",
    "Proposed memory generated from feedback (click 'Generate Proposed Memory')",
    "Proposed memory approved (go to agent detail → Proposed Memories tab)",
    "Active memory created (automatic on approval)",
    "Re-run workflow with second complaint",
    "Approved memory appears in agent's context for the re-run",
    "Second run output shows improved behavior (no repeated info requests)",
    "No cross-agent memory leakage (Policy Guardrail does not see Triage's memory)",
]

AGENT_DEFS = [
    {
        "name": f"{DEMO_PREFIX}Escalation Triage Agent",
        "role": "escalation-triage",
        "system_prompt": (
            "You are an escalation triage specialist. Analyze customer complaints to determine "
            "severity, identify repeated information requests, and assess escalation risk. "
            "Never ask customers for information they have already provided. "
            "Flag chargeback threats, public complaint risks, and regulatory concerns immediately. "
            "When you see a pattern of repeated support contacts, treat it as a high-priority case."
        ),
        "soul_name": f"{DEMO_PREFIX}Escalation Triage Soul",
        "soul_persona": (
            "Methodical and detail-oriented triage analyst. "
            "Prioritizes customer risk signals over process formalities. "
            "Direct communicator who flags risks without sugar-coating."
        ),
        "temperature": 0.2,
        "max_tokens": 1024,
        "initial_contexts": [
            {
                "title": "Chargeback Risk Indicators",
                "context_type": "knowledge",
                "content": (
                    "Chargeback risk indicators include: customer explicitly threatens chargeback, "
                    "repeated failed support contacts, high-value transactions, late delivery, "
                    "missing items. When 3+ indicators present, flag as high risk."
                ),
                "priority": 10,
            }
        ],
        "initial_memories": [
            {
                "memory_type": "lesson",
                "content": (
                    "Always scan the full complaint for order numbers, contact details, "
                    "and dates before asking any clarifying questions. Customers who have "
                    "contacted support multiple times are already frustrated."
                ),
                "importance": 85,
                "status": "active",
                "source": "demo-seed",
            }
        ],
    },
    {
        "name": f"{DEMO_PREFIX}Policy Guardrail Agent",
        "role": "policy-guardrail",
        "system_prompt": (
            "You are a policy compliance guard. Review responses for policy violations, "
            "verify refund eligibility before promising refunds, and ensure regulatory "
            "requirements are met. Flag any response that promises a refund before "
            "verification is complete. Identify chargeback risk indicators and "
            "recommend escalation to human agents when appropriate."
        ),
        "soul_name": f"{DEMO_PREFIX}Policy Guard Soul",
        "soul_persona": (
            "Strict but fair compliance officer who protects both customer and company interests. "
            "Known for catching policy gaps before they become liabilities. "
            "Believes in process but not at the expense of customer fairness."
        ),
        "temperature": 0.2,
        "max_tokens": 1024,
        "initial_contexts": [
            {
                "title": "Refund Verification Policy",
                "context_type": "policy",
                "content": (
                    "Refunds must be verified before being promised to customers. "
                    "Verification requires: order confirmation, payment receipt, and "
                    "delivery status. Never authorize refund verbally without completing "
                    "all three verification steps."
                ),
                "priority": 10,
            }
        ],
        "initial_memories": [
            {
                "memory_type": "lesson",
                "content": (
                    "When a customer mentions chargeback or public complaint, treat it as "
                    "an immediate escalation trigger. The response must acknowledge the risk, "
                    "provide a concrete next step, and recommend human agent involvement."
                ),
                "importance": 90,
                "status": "active",
                "source": "demo-seed",
            }
        ],
    },
    {
        "name": f"{DEMO_PREFIX}Customer Response Writer",
        "role": "customer-response-writer",
        "system_prompt": (
            "You are a customer response writer. Draft empathetic, professional responses "
            "to escalated complaints. Never ask for information already provided by the "
            "customer. Include clear next steps and, when appropriate, recommend urgent "
            "human follow-up for high-risk cases. Verify all facts before writing."
        ),
        "soul_name": f"{DEMO_PREFIX}Customer Response Soul",
        "soul_persona": (
            "Empathetic communicator who balances customer care with business reality. "
            "Writes clear, actionable responses that make customers feel heard while "
            "protecting the company from unnecessary liability."
        ),
        "temperature": 0.3,
        "max_tokens": 1536,
        "initial_contexts": [
            {
                "title": "Response Template - High Risk",
                "context_type": "template",
                "content": (
                    "High-risk response template: (1) Acknowledge the customer's frustration "
                    "and repeated contacts. (2) Confirm all details already provided without "
                    "asking for repeats. (3) State concrete next step with timeline. "
                    "(4) Indicate human follow-up is being arranged."
                ),
                "priority": 10,
            }
        ],
        "initial_memories": [
            {
                "memory_type": "lesson",
                "content": (
                    "Customers who threaten chargebacks need immediate acknowledgment of "
                    "their specific complaint details. Do not use generic templates — "
                    "reference their order number, contact history, and specific issue. "
                    "Promise a concrete timeline, not vague assurances."
                ),
                "importance": 90,
                "status": "active",
                "source": "demo-seed",
            }
        ],
    },
]


def _demo_model(settings) -> str:
    provider = settings.llm_provider
    if provider == "mock":
        return "mock-deterministic"
    if provider == "openai_compatible":
        return settings.openai_compatible_model or "default"
    if provider == "openai":
        return settings.openai_model or "default"
    if provider == "anthropic":
        return settings.anthropic_model or "default"
    if provider == "ollama":
        return settings.ollama_model or "default"
    return "mock-deterministic"


def seed_demo(db: Session) -> DemoSeedResponse:
    settings = get_settings()
    provider = settings.llm_provider
    model = _demo_model(settings)

    souls_result: list[DemoEntityRef] = []
    agents_result: list[DemoEntityRef] = []
    contexts_result: list[DemoEntityRef] = []
    memories_result: list[DemoEntityRef] = []

    for agent_def in AGENT_DEFS:
        # Idempotent soul
        soul_name = agent_def["soul_name"]
        existing_soul = db.scalars(select(Soul).where(Soul.name == soul_name)).first()
        if existing_soul:
            soul = existing_soul
            souls_result.append(DemoEntityRef(id=soul.id, name=soul.name, created=False))
        else:
            soul = Soul(
                name=soul_name,
                description=agent_def["soul_persona"],
                is_active=True,
            )
            db.add(soul)
            db.commit()
            db.refresh(soul)
            souls_result.append(DemoEntityRef(id=soul.id, name=soul.name, created=True))

        # Idempotent agent
        agent_name = agent_def["name"]
        existing_agent = db.scalars(select(Agent).where(Agent.name == agent_name)).first()
        if existing_agent:
            agent = existing_agent
            agents_result.append(DemoEntityRef(id=agent.id, name=agent.name, created=False))
        else:
            agent = Agent(
                name=agent_name,
                role=agent_def["role"],
                system_prompt=agent_def["system_prompt"],
                soul_id=soul.id,
                llm_provider=provider,
                model=model,
                temperature=agent_def["temperature"],
                max_tokens=agent_def["max_tokens"],
                memory_policy={"write_mode": "manual_review", "retrieval_enabled": True},
                context_policy={"include_active_context": True},
                handoff_policy={"allow_handoff": False, "allowed_agent_ids": []},
                is_active=True,
            )
            db.add(agent)
            db.commit()
            db.refresh(agent)
            agents_result.append(DemoEntityRef(id=agent.id, name=agent.name, created=True))

        # Idempotent contexts
        for ctx_def in agent_def["initial_contexts"]:
            ctx_title = ctx_def["title"]
            existing_ctx = db.scalars(
                select(AgentContext).where(
                    AgentContext.agent_id == agent.id,
                    AgentContext.title == ctx_title,
                )
            ).first()
            if existing_ctx:
                contexts_result.append(DemoEntityRef(id=existing_ctx.id, name=existing_ctx.title, created=False))
            else:
                ctx = AgentContext(
                    agent_id=agent.id,
                    title=ctx_title,
                    context_type=ctx_def["context_type"],
                    content=ctx_def["content"],
                    priority=ctx_def["priority"],
                    is_active=True,
                )
                db.add(ctx)
                db.commit()
                db.refresh(ctx)
                contexts_result.append(DemoEntityRef(id=ctx.id, name=ctx.title, created=True))

        # Idempotent memories
        for mem_def in agent_def["initial_memories"]:
            mem_content = mem_def["content"]
            existing_mem = db.scalars(
                select(AgentMemory).where(
                    AgentMemory.agent_id == agent.id,
                    AgentMemory.content == mem_content,
                )
            ).first()
            if existing_mem:
                memories_result.append(DemoEntityRef(id=existing_mem.id, name=existing_mem.memory_type, created=False))
            else:
                mem = AgentMemory(
                    agent_id=agent.id,
                    memory_type=mem_def["memory_type"],
                    content=mem_content,
                    importance=mem_def["importance"],
                    status=mem_def["status"],
                    source=mem_def.get("source"),
                )
                db.add(mem)
                db.commit()
                db.refresh(mem)
                memories_result.append(DemoEntityRef(id=mem.id, name=mem.memory_type, created=True))

    # Idempotent workflow
    workflow_ref: Optional[DemoEntityRef] = None
    existing_workflow = db.scalars(select(Workflow).where(Workflow.name == DEMO_WORKFLOW_NAME)).first()
    if existing_workflow:
        workflow_ref = DemoEntityRef(id=existing_workflow.id, name=existing_workflow.name, created=False)
    else:
        agent_ids = [ref.id for ref in agents_result]
        workflow = Workflow(
            name=DEMO_WORKFLOW_NAME,
            workflow_type="sequential",
            graph_config={"agent_sequence": agent_ids},
            is_active=True,
        )
        db.add(workflow)
        db.commit()
        db.refresh(workflow)
        workflow_ref = DemoEntityRef(id=workflow.id, name=workflow.name, created=True)

    return DemoSeedResponse(
        souls=souls_result,
        agents=agents_result,
        contexts=contexts_result,
        memories=memories_result,
        workflow=workflow_ref,
        first_complaint=FIRST_COMPLAINT,
        second_complaint=SECOND_COMPLAINT,
        feedback_text=FEEDBACK_TEXT,
        acceptance_checklist=ACCEPTANCE_CHECKLIST,
    )


def cleanup_demo(db: Session) -> DemoCleanupResponse:
    # Collect IDs first
    demo_agent_ids = [
        a.id for a in db.scalars(select(Agent).where(Agent.name.startswith(DEMO_PREFIX))).all()
    ]
    demo_run_ids: list[int] = []
    soul_ids: list[int] = []
    demo_wf_id: Optional[int] = None

    demo_wf = db.scalars(select(Workflow).where(Workflow.name == DEMO_WORKFLOW_NAME)).first()
    if demo_wf:
        demo_wf_id = demo_wf.id
        demo_run_ids = [
            r.id for r in db.scalars(select(Run).where(Run.workflow_id == demo_wf.id)).all()
        ]

    for agent_id in demo_agent_ids:
        agent = db.get(Agent, agent_id)
        if agent and agent.soul_id:
            soul_ids.append(agent.soul_id)

    # Count before deletion (for accurate reporting)
    deleted_contexts = db.scalars(
        select(AgentContext).where(AgentContext.agent_id.in_(demo_agent_ids))
    ).all()
    deleted_memories = db.scalars(
        select(AgentMemory).where(AgentMemory.agent_id.in_(demo_agent_ids))
    ).all()
    ctx_count = len(deleted_contexts)
    mem_count = len(deleted_memories)
    run_count = len(demo_run_ids)
    wf_count = 1 if demo_wf_id else 0
    agent_count = len(demo_agent_ids)
    soul_count = len(soul_ids)

    # Delete in FK-safe order: leaf tables first, then parent tables
    all_agent_ids = demo_agent_ids if demo_agent_ids else [-1]
    all_run_ids = demo_run_ids if demo_run_ids else [-1]

    # Phase 1: Tables referencing both runs and agents
    db.execute(LearningEvent.__table__.delete().where(
        LearningEvent.run_id.in_(all_run_ids) | LearningEvent.agent_id.in_(all_agent_ids)
    ))
    db.execute(AgentExecutionEvent.__table__.delete().where(
        AgentExecutionEvent.run_id.in_(all_run_ids) | AgentExecutionEvent.agent_id.in_(all_agent_ids)
    ))
    db.execute(TokenUsage.__table__.delete().where(
        TokenUsage.run_id.in_(all_run_ids) | TokenUsage.agent_id.in_(all_agent_ids)
    ))

    # Phase 2: Tables referencing feedback/evaluations (before feedback/eval deletes)
    db.execute(ProposedMemory.__table__.delete().where(
        ProposedMemory.agent_id.in_(all_agent_ids)
    ))

    # Phase 3: Tables referencing runs
    db.execute(AgentFeedback.__table__.delete().where(AgentFeedback.run_id.in_(all_run_ids)))
    db.execute(AgentEvaluation.__table__.delete().where(AgentEvaluation.run_id.in_(all_run_ids)))
    db.execute(TraceEvent.__table__.delete().where(TraceEvent.run_id.in_(all_run_ids)))
    db.execute(AgentExecution.__table__.delete().where(AgentExecution.run_id.in_(all_run_ids)))

    # Also clean agent-referencing rows in case they reference non-demo runs
    db.execute(AgentFeedback.__table__.delete().where(AgentFeedback.agent_id.in_(all_agent_ids)))
    db.execute(AgentEvaluation.__table__.delete().where(AgentEvaluation.agent_id.in_(all_agent_ids)))
    db.execute(TraceEvent.__table__.delete().where(TraceEvent.agent_id.in_(all_agent_ids)))
    db.execute(AgentExecution.__table__.delete().where(AgentExecution.agent_id.in_(all_agent_ids)))

    # Phase 4: Delete runs via bulk delete
    db.execute(Run.__table__.delete().where(Run.id.in_(all_run_ids)))

    # Phase 5: Delete workflow
    db.execute(Workflow.__table__.delete().where(Workflow.id == demo_wf_id))

    # Phase 6: Delete agent-owned data
    db.execute(AgentContext.__table__.delete().where(AgentContext.agent_id.in_(all_agent_ids)))
    db.execute(AgentMemory.__table__.delete().where(AgentMemory.agent_id.in_(all_agent_ids)))

    # Phase 7: Unlink and delete souls, then agents
    db.execute(Agent.__table__.update().where(Agent.id.in_(all_agent_ids)).values(soul_id=None))
    db.execute(Soul.__table__.delete().where(Soul.id.in_(soul_ids if soul_ids else [-1])))
    db.execute(Agent.__table__.delete().where(Agent.id.in_(all_agent_ids)))

    # Expire session so stale cached objects don't cause issues
    db.expire_all()

    db.commit()

    return DemoCleanupResponse(
        deleted_souls=soul_count,
        deleted_agents=agent_count,
        deleted_workflows=wf_count,
        deleted_runs=run_count,
        deleted_contexts=ctx_count,
        deleted_memories=mem_count,
    )
