import asyncio

import google.generativeai as genai

from app.config import settings

from .base import LLMProvider


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, model: str | None = None):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set.")
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model_name = model or settings.GEMINI_MODEL

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        model = genai.GenerativeModel(self.model_name, system_instruction=system_prompt)
        # The SDK's generate_content is sync-only; run it off the event loop thread.
        response = await asyncio.to_thread(
            model.generate_content,
            user_prompt,
            generation_config={"max_output_tokens": settings.MAX_OUTPUT_TOKENS},
        )
        return response.text or ""
