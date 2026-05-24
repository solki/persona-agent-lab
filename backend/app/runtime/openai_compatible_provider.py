from typing import Any, Optional

from openai import OpenAI

from app.runtime.provider_interface import ProviderInterface, ProviderResponse


class ProviderConfigurationError(ValueError):
    pass


class OpenAICompatibleProvider(ProviderInterface):
    supports_tools = True
    supports_json_mode = True

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        provider_name: Optional[str] = None,
        client: Optional[Any] = None,
    ) -> None:
        self.base_url = base_url
        self.model = model
        self.provider_name = provider_name or "openai_compatible"
        self.client = client or OpenAI(api_key=api_key, base_url=base_url)

    def generate(self, prompt: str, config: dict) -> ProviderResponse:
        request = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if config.get("temperature") is not None:
            request["temperature"] = config["temperature"]
        if config.get("max_tokens") is not None:
            request["max_tokens"] = config["max_tokens"]

        response = self.client.chat.completions.create(**request)
        content = response.choices[0].message.content or ""
        return ProviderResponse(
            content=content,
            metadata={
                "provider": self.provider_name,
                "model": self.model,
                "base_url": self.base_url,
            },
        )
