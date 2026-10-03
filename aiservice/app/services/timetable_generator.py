from app.prompts import SYSTEM_PROMPT, build_user_prompt
from app.providers.factory import get_provider
from app.schemas import TimetableGenerateRequest, TimetableGenerateResponse


async def generate_timetable(request: TimetableGenerateRequest) -> TimetableGenerateResponse:
    provider = get_provider(request.provider, request.model)
    user_prompt = build_user_prompt(request.school_data, request.extra_instructions)
    raw_output = await provider.generate(SYSTEM_PROMPT, user_prompt)
    return TimetableGenerateResponse(
        provider=provider.name,
        model=getattr(provider, "model", getattr(provider, "model_name", "")),
        raw_output=raw_output,
    )
