from app.runtime.provider_interface import ProviderInterface, ProviderResponse


class OllamaProvider(ProviderInterface):
    supports_tools = False
    supports_json_mode = True

    def generate(self, prompt: str, config: dict) -> ProviderResponse:
        raise NotImplementedError("OllamaProvider is a placeholder for a later milestone.")
