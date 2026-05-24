from pydantic import BaseModel, Field


class HandoffDecision(BaseModel):
    requested: bool = False
    allowed: bool = False
    payload: dict = Field(default_factory=dict)
    reason: str = "No handoff requested."


class HandoffEngine:
    def evaluate(self, sender_policy: dict, target_agent_id: int, payload: dict) -> HandoffDecision:
        allowed_ids = sender_policy.get("allowed_agent_ids", [])
        allowed = bool(sender_policy.get("allow_handoff")) and target_agent_id in allowed_ids
        return HandoffDecision(
            requested=True,
            allowed=allowed,
            payload=payload if allowed else {},
            reason="Handoff allowed." if allowed else "Handoff denied by sender policy.",
        )
