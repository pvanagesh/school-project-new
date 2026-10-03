import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from app.config import settings
from app.schemas import TimetableGenerateRequest
from app.services.timetable_generator import generate_timetable

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "default_provider": settings.AI_PROVIDER}


@router.post("/timetable/generate")
async def generate(request: Request):
    # Auth is checked before the body is even parsed, so a request with a bad
    # key never leaks validation details about the payload shape.
    if settings.AISERVICE_API_KEY:
        provided = request.headers.get("x-api-key")
        if provided != settings.AISERVICE_API_KEY:
            raise HTTPException(status_code=401, detail="Invalid or missing API key.")

    try:
        payload = json.loads(await request.body() or b"{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON.") from exc

    try:
        parsed = TimetableGenerateRequest.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    try:
        result = await generate_timetable(parsed)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"The AI provider call failed: {exc}") from exc

    return result.model_dump()
