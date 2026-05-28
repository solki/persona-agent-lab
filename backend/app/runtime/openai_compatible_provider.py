from typing import Any, Optional

from openai import APIError, OpenAI

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
        timeout: float = 120.0,
    ) -> None:
        self.base_url = base_url
        self.model = model
        self.provider_name = provider_name or "openai_compatible"
        self.client = client or OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)

    def generate(self, prompt: str, config: dict) -> ProviderResponse:
        model = config.get("model") or self.model
        request: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if config.get("temperature") is not None:
            request["temperature"] = config["temperature"]
        if config.get("max_tokens") is not None:
            request["max_tokens"] = config["max_tokens"]

        try:
            response = self.client.chat.completions.create(**request)
        except Exception as exc:
            raise ProviderConfigurationError(
                f"Provider '{self.provider_name}' ({self.base_url}) call failed: {_readable_error(exc)}"
            ) from exc

        content = response.choices[0].message.content or ""
        metadata: dict[str, Any] = {
            "provider": self.provider_name,
            "model": model,
            "base_url": self.base_url,
        }
        if hasattr(response, "usage") and response.usage is not None:
            usage = response.usage
            metadata["usage"] = {
                "prompt_tokens": usage.prompt_tokens,
                "completion_tokens": usage.completion_tokens,
                "total_tokens": usage.total_tokens,
            }

        return ProviderResponse(content=content, metadata=metadata)


def _readable_error(exc: Exception) -> str:
    if isinstance(exc, APIError):
        msg = exc.message or str(exc.body) if exc.body else ""
        if msg:
            return msg[:500]
        if exc.status_code:
            return f"HTTP {exc.status_code}"
    msg = str(exc)
    return msg[:500] if len(msg) > 500 else msg
