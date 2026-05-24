from app.runtime.provider_interface import ProviderInterface, ProviderResponse


class AnthropicProvider(ProviderInterface):
    supports_tools = True
    supports_json_mode = False

    def generate(self, prompt: str, config: dict) -> ProviderResponse:
        raise NotImplementedError("AnthropicProvider is a placeholder for a later milestone.")
