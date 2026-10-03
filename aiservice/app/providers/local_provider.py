import httpx

from app.config import settings

from .base import LLMProvider


class LocalProvider(LLMProvider):
    """Talks to a local Ollama-compatible server (POST /api/chat)."""

    name = "local"

    def __init__(self, model: str | None = None):
        self.base_url = settings.LOCAL_LLM_BASE_URL.rstrip("/")
        self.model = model or settings.LOCAL_LLM_MODEL

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")
