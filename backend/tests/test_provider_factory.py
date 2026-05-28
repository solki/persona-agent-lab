import pytest

from app.config import Settings
from app.runtime.mock_llm_runner import MockProvider
from app.runtime.openai_compatible_provider import OpenAICompatibleProvider, ProviderConfigurationError
from app.runtime.provider_factory import create_provider


def isolated_settings(**values):
    return Settings(_env_file=None, **values)


def test_mock_provider_selection_still_works():
    settings = isolated_settings(llm_provider="mock")

    provider = create_provider(settings)

    assert isinstance(provider, MockProvider)


def test_openai_compatible_provider_selection_works_with_required_values():
    settings = isolated_settings(
        llm_provider="openai_compatible",
        openai_compatible_api_key="test-key",
        openai_compatible_base_url="https://example.test/v1",
        openai_compatible_model="provider-model",
        openai_compatible_provider_name="example-provider",
    )

    provider = create_provider(settings)

    assert isinstance(provider, OpenAICompatibleProvider)
    assert provider.provider_name == "example-provider"


def test_openai_compatible_provider_model_is_optional_fallback():
    """OPENAI_COMPATIBLE_MODEL is a fallback when agent model is empty."""
    settings = isolated_settings(
        llm_provider="openai_compatible",
        openai_compatible_api_key="test-key",
        openai_compatible_base_url="https://example.test/v1",
    )

    provider = create_provider(settings)

    assert provider.model == ""


@pytest.mark.parametrize(
    ("field", "message"),
    [
        ("openai_compatible_api_key", "OPENAI_COMPATIBLE_API_KEY is required"),
        ("openai_compatible_base_url", "OPENAI_COMPATIBLE_BASE_URL is required"),
    ],
)
def test_openai_compatible_provider_requires_configuration(field, message):
    values = {
        "llm_provider": "openai_compatible",
        "openai_compatible_api_key": "test-key",
        "openai_compatible_base_url": "https://example.test/v1",
        "openai_compatible_model": "provider-model",
    }
    values[field] = None

    with pytest.raises(ProviderConfigurationError, match=message):
        create_provider(isolated_settings(**values))


def test_openai_compatible_provider_name_is_optional_and_defaults_metadata():
    settings = isolated_settings(
        llm_provider="openai_compatible",
        openai_compatible_api_key="test-key",
        openai_compatible_base_url="https://example.test/v1",
        openai_compatible_model="provider-model",
    )

    provider = create_provider(settings)

    assert provider.provider_name == "openai_compatible"


def test_openai_compatible_generate_uses_mocked_sdk_client():
    class FakeUsage:
        prompt_tokens = 120
        completion_tokens = 80
        total_tokens = 200

    class FakeMessage:
        content = "Provider response"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        choices = [FakeChoice()]
        usage = FakeUsage()

    class FakeCompletions:
        def __init__(self):
            self.request = None

        def create(self, **kwargs):
            self.request = kwargs
            return FakeResponse()

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    fake_client = FakeClient()
    provider = OpenAICompatibleProvider(
        api_key="test-key",
        base_url="https://example.test/v1",
        model="provider-model",
        provider_name="example-provider",
        client=fake_client,
    )

    result = provider.generate("Assembled prompt", {"temperature": 0.3, "max_tokens": 256})

    assert result.content == "Provider response"
    assert result.metadata["provider"] == "example-provider"
    assert result.metadata["model"] == "provider-model"
    assert result.metadata["base_url"] == "https://example.test/v1"
    assert result.metadata["usage"] == {"prompt_tokens": 120, "completion_tokens": 80, "total_tokens": 200}
    assert fake_client.chat.completions.request["model"] == "provider-model"
    assert fake_client.chat.completions.request["messages"] == [{"role": "user", "content": "Assembled prompt"}]
    assert fake_client.chat.completions.request["temperature"] == 0.3
    assert fake_client.chat.completions.request["max_tokens"] == 256


def test_per_agent_model_overrides_provider_fallback():
    """Agent config model should override the provider-level fallback model."""
    class FakeMessage:
        content = "Response"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        choices = [FakeChoice()]
        usage = None

    class FakeCompletions:
        def __init__(self):
            self.request = None

        def create(self, **kwargs):
            self.request = kwargs
            return FakeResponse()

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    fake_client = FakeClient()
    provider = OpenAICompatibleProvider(
        api_key="test-key",
        base_url="https://example.test/v1",
        model="fallback-model",
        client=fake_client,
    )

    result = provider.generate("Prompt", {"model": "agent-specific-model", "temperature": 0.7})

    assert fake_client.chat.completions.request["model"] == "agent-specific-model"
    assert result.metadata["model"] == "agent-specific-model"


def test_per_agent_model_empty_uses_provider_fallback():
    """When agent config has no model, the provider fallback is used."""
    class FakeMessage:
        content = "Response"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        choices = [FakeChoice()]
        usage = None

    class FakeCompletions:
        def __init__(self):
            self.request = None

        def create(self, **kwargs):
            self.request = kwargs
            return FakeResponse()

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    fake_client = FakeClient()
    provider = OpenAICompatibleProvider(
        api_key="test-key",
        base_url="https://example.test/v1",
        model="fallback-model",
        client=fake_client,
    )

    result = provider.generate("Prompt", {})

    assert fake_client.chat.completions.request["model"] == "fallback-model"
    assert result.metadata["model"] == "fallback-model"


def test_missing_api_key_raises_configuration_error():
    """Provider factory raises clear error when API key is missing."""
    settings = isolated_settings(
        llm_provider="openai_compatible",
        openai_compatible_base_url="https://example.test/v1",
        openai_compatible_model="model",
    )

    with pytest.raises(ProviderConfigurationError, match="OPENAI_COMPATIBLE_API_KEY is required"):
        create_provider(settings)


def test_provider_failure_creates_readable_error():
    """When the provider call fails, the error message includes provider context."""
    class FakeCompletions:
        def create(self, **kwargs):
            raise RuntimeError("Connection refused")

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    provider = OpenAICompatibleProvider(
        api_key="test-key",
        base_url="https://example.test/v1",
        model="test-model",
        provider_name="test-provider",
        client=FakeClient(),
    )

    with pytest.raises(ProviderConfigurationError) as exc_info:
        provider.generate("Prompt", {})

    msg = str(exc_info.value)
    assert "test-provider" in msg
    assert "https://example.test/v1" in msg
    assert "Connection refused" in msg


def test_provider_error_includes_provider_context():
    """Provider errors are wrapped with provider name and base_url context."""
    class FakeCompletions:
        def create(self, **kwargs):
            raise RuntimeError("Connection timed out after 30s")

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    provider = OpenAICompatibleProvider(
        api_key="test-key",
        base_url="https://api.example.test/v1",
        model="test-model",
        provider_name="example-test-provider",
        client=FakeClient(),
    )

    with pytest.raises(ProviderConfigurationError) as exc_info:
        provider.generate("Prompt", {})

    msg = str(exc_info.value)
    assert "example-test-provider" in msg
    assert "https://api.example.test/v1" in msg
    assert "Connection timed out" in msg


def test_token_usage_is_captured_in_metadata():
    """Real provider response.usage is captured in metadata for observatory tracking."""
    class FakeUsage:
        prompt_tokens = 310
        completion_tokens = 150
        total_tokens = 460

    class FakeMessage:
        content = "Response"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        choices = [FakeChoice()]
        usage = FakeUsage()

    class FakeCompletions:
        def create(self, **kwargs):
            return FakeResponse()

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    provider = OpenAICompatibleProvider(
        api_key="k", base_url="https://x", model="m", client=FakeClient(),
    )

    result = provider.generate("Prompt", {})

    assert result.metadata["usage"] == {"prompt_tokens": 310, "completion_tokens": 150, "total_tokens": 460}


def test_token_usage_none_when_response_has_no_usage():
    """When usage is not in response, metadata omits the usage key (estimation fallback)."""
    class FakeMessage:
        content = "Response"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        choices = [FakeChoice()]
        usage = None

    class FakeCompletions:
        def create(self, **kwargs):
            return FakeResponse()

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    provider = OpenAICompatibleProvider(
        api_key="k", base_url="https://x", model="m", client=FakeClient(),
    )

    result = provider.generate("Prompt", {})

    assert "usage" not in result.metadata


def test_readable_error_truncates_long_messages():
    from app.runtime.openai_compatible_provider import _readable_error

    result = _readable_error(RuntimeError("x" * 600))

    assert len(result) == 500
    assert result == ("x" * 600)[:500]


def test_readable_error_handles_generic_exception():
    from app.runtime.openai_compatible_provider import _readable_error

    result = _readable_error(ValueError("Something went wrong with the request"))

    assert result == "Something went wrong with the request"
