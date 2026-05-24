from pydantic import BaseModel, Field


class ProviderResponse(BaseModel):
    content: str
    metadata: dict = Field(default_factory=dict)


class ProviderInterface:
    supports_tools = False
    supports_json_mode = False

    def generate(self, prompt: str, config: dict) -> ProviderResponse:
        raise NotImplementedError

    def stream(self, prompt: str, config: dict):
        raise NotImplementedError

    def tool_call(self, prompt: str, config: dict):
        raise NotImplementedError
