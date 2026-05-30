from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class SupervisorDecision(BaseModel):
    action: Literal["delegate", "finish"]
    agent_id: Optional[int] = None
    instruction: Optional[str] = None
    final_response: Optional[str] = None
    reasoning: Optional[str] = None

    @model_validator(mode="after")
    def _validate_delegate_fields(self) -> "SupervisorDecision":
        if self.action == "delegate":
            if self.agent_id is None:
                raise ValueError("agent_id is required when action is 'delegate'")
            if not self.instruction:
                raise ValueError("instruction is required when action is 'delegate'")
        if self.action == "finish":
            if not self.final_response:
                raise ValueError("final_response is required when action is 'finish'")
        return self
