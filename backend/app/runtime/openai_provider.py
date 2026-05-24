from app.runtime.provider_interface import ProviderInterface, ProviderResponse


class OpenAIProvider(ProviderInterface):
    supports_tools = True
    supports_json_mode = True

    def generate(self, prompt: str, config: dict) -> ProviderResponse:
        raise NotImplementedError("OpenAIProvider is a placeholder for a later milestone.")
