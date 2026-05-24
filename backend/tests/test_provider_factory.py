import pytest

from app.config import Settings
from app.runtime.mock_llm_runner import MockProvider
from app.runtime.openai_compatible_provider import OpenAICompatibleProvider, ProviderConfigurationError
from app.runtime.provider_factory import create_provider


def test_mock_provider_selection_still_works():
    settings = Settings(llm_provider="mock")

    provider = create_provider(settings)

    assert isinstance(provider, MockProvider)


def test_openai_compatible_provider_selection_works_with_required_values():
    settings = Settings(
        llm_provider="openai_compatible",
        openai_compatible_api_key="test-key",
        openai_compatible_base_url="https://example.test/v1",
        openai_compatible_model="provider-model",
        openai_compatible_provider_name="example-provider",
    )

    provider = create_provider(settings)

    assert isinstance(provider, OpenAICompatibleProvider)
    assert provider.provider_name == "example-provider"


@pytest.mark.parametrize(
    ("field", "message"),
    [
        ("openai_compatible_api_key", "OPENAI_COMPATIBLE_API_KEY is required"),
        ("openai_compatible_base_url", "OPENAI_COMPATIBLE_BASE_URL is required"),
        ("openai_compatible_model", "OPENAI_COMPATIBLE_MODEL is required"),
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
        create_provider(Settings(**values))


def test_openai_compatible_provider_name_is_optional_and_defaults_metadata():
    settings = Settings(
        llm_provider="openai_compatible",
        openai_compatible_api_key="test-key",
        openai_compatible_base_url="https://example.test/v1",
        openai_compatible_model="provider-model",
    )

    provider = create_provider(settings)

    assert provider.provider_name == "openai_compatible"


def test_openai_compatible_generate_uses_mocked_sdk_client():
    class FakeMessage:
        content = "Provider response"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        choices = [FakeChoice()]

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
    assert result.metadata == {
        "provider": "example-provider",
        "model": "provider-model",
        "base_url": "https://example.test/v1",
    }
    assert fake_client.chat.completions.request["model"] == "provider-model"
    assert fake_client.chat.completions.request["messages"] == [{"role": "user", "content": "Assembled prompt"}]
    assert fake_client.chat.completions.request["temperature"] == 0.3
    assert fake_client.chat.completions.request["max_tokens"] == 256
