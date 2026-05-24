import hashlib

from app.runtime.provider_interface import ProviderInterface, ProviderResponse


class MockProvider(ProviderInterface):
    supports_tools = False
    supports_json_mode = True

    def generate(self, prompt: str, config: dict) -> ProviderResponse:
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:12]
        agent_name = config.get("agent_name", "Mock Agent")
        task = config.get("task", "")
        return ProviderResponse(
            content=f"[mock:{agent_name}:{digest}] Deterministic response for task: {task}",
            metadata={
                "provider": "mock",
                "prompt_digest": digest,
                "context_injected": bool(prompt),
                "memory_injected": "Agent-specific retrieved memory" in prompt,
            },
        )

    def stream(self, prompt: str, config: dict):
        yield self.generate(prompt, config).content

    def tool_call(self, prompt: str, config: dict):
        return {"status": "unsupported", "message": "MockProvider does not execute tool calls."}
