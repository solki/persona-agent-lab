from app.config import Settings
from app.runtime.anthropic_provider import AnthropicProvider
from app.runtime.mock_llm_runner import MockProvider
from app.runtime.ollama_provider import OllamaProvider
from app.runtime.openai_compatible_provider import OpenAICompatibleProvider, ProviderConfigurationError
from app.runtime.openai_provider import OpenAIProvider
from app.runtime.provider_interface import ProviderInterface


def create_provider(settings: Settings) -> ProviderInterface:
    if settings.llm_provider == "mock":
        return MockProvider()
    if settings.llm_provider == "openai_compatible":
        return _create_openai_compatible_provider(settings)
    if settings.llm_provider == "openai":
        return OpenAIProvider()
    if settings.llm_provider == "anthropic":
        return AnthropicProvider()
    if settings.llm_provider == "ollama":
        return OllamaProvider()
    raise ProviderConfigurationError(f"Unsupported LLM_PROVIDER value: {settings.llm_provider}")


def _create_openai_compatible_provider(settings: Settings) -> OpenAICompatibleProvider:
    if not settings.openai_compatible_api_key:
        raise ProviderConfigurationError("OPENAI_COMPATIBLE_API_KEY is required when LLM_PROVIDER=openai_compatible.")
    if not settings.openai_compatible_base_url:
        raise ProviderConfigurationError("OPENAI_COMPATIBLE_BASE_URL is required when LLM_PROVIDER=openai_compatible.")

    return OpenAICompatibleProvider(
        api_key=settings.openai_compatible_api_key,
        base_url=settings.openai_compatible_base_url,
        model=settings.openai_compatible_model or "",
        provider_name=settings.openai_compatible_provider_name,
        timeout=float(settings.llm_timeout_seconds),
    )

