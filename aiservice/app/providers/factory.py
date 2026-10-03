from app.config import settings

from .anthropic_provider import AnthropicProvider
from .base import LLMProvider
from .gemini_provider import GeminiProvider
from .local_provider import LocalProvider
from .openai_provider import GroqProvider, OpenAIProvider

_PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
    "groq": GroqProvider,
    "local": LocalProvider,
}


def get_provider(provider_name: str | None = None, model: str | None = None) -> LLMProvider:
    name = (provider_name or settings.AI_PROVIDER).lower()
    provider_cls = _PROVIDERS.get(name)
    if provider_cls is None:
        raise ValueError(f"Unknown AI provider '{name}'. Valid options: {', '.join(_PROVIDERS)}.")
    return provider_cls(model=model)
