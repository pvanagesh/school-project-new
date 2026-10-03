from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Common interface every model backend implements. `generate` sends a
    system+user prompt pair and returns the model's raw text reply."""

    name: str

    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str) -> str: ...
