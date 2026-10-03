# Vedha Educational Society — AI Service

Standalone FastAPI microservice that analyzes a school's teacher/class/subject data
and returns an assignment-coverage summary using an LLM. It is **stateless**: no
database, no models, no migrations. The main Django backend fetches real school
data (classes, sections, subjects, teachers) and POSTs it here; this service only
returns the LLM's analysis as Markdown — it never writes to the school database
itself.

Originally built with FastAPI, briefly converted to Django, then converted back
to FastAPI. The HTTP contract (`/health`, `/timetable/generate`) has stayed
unchanged across both conversions, so nothing on the Django backend side needs
to change.

## Supported providers ("hybrid model")

Pick a provider per deployment via `.env`, or override it per-request in the API
call:

| Provider    | `AI_PROVIDER` value | Requires                                |
|-------------|----------------------|------------------------------------------|
| OpenAI      | `openai`             | `OPENAI_API_KEY`                         |
| Anthropic   | `anthropic`          | `ANTHROPIC_API_KEY`                      |
| Gemini      | `gemini`             | `GEMINI_API_KEY`                         |
| Groq        | `groq`               | `GROQ_API_KEY`                           |
| Local/Ollama| `local`              | A running Ollama-compatible server       |

## Setup

```bash
cd aiservice
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `.env` with:
- `AI_PROVIDER` — which provider to use by default.
- `AISERVICE_API_KEY` — a shared secret. If set, every request must send it in
  the `x-api-key` header. If left blank, the service runs in open dev mode (no
  auth) — do not deploy that way.
- The API key / model for whichever provider(s) you intend to use
  (`OPENAI_API_KEY`/`OPENAI_MODEL`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`,
  `GEMINI_API_KEY`/`GEMINI_MODEL`, `GROQ_API_KEY`/`GROQ_MODEL`,
  `LOCAL_LLM_BASE_URL`/`LOCAL_LLM_MODEL`).
- `MAX_OUTPUT_TOKENS` / `REQUEST_TIMEOUT_SECONDS` — generation limits. Reasoning
  models (e.g. Gemini's newer "thinking" models) can spend most of their token
  budget on invisible reasoning, so this may need to be well above the visible
  report length — see `MAX_OUTPUT_TOKENS` in `.env`.

## Run

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Add `--reload` during local development to auto-restart on code changes.

## Project layout

```
app/
  main.py                    # FastAPI() instance, mounts routes
  routes.py                  # GET /health, POST /timetable/generate
  config.py                  # pydantic-settings, reads .env
  schemas.py                 # Pydantic request/response models
  prompts.py                 # system prompt + user-prompt builder
  services/timetable_generator.py
  providers/                 # one class per LLM backend + factory.py
```

## Endpoints

### `GET /health`
No auth required. Returns `{"status": "ok", "default_provider": "..."}`.

### `POST /timetable/generate`
Requires `x-api-key: <AISERVICE_API_KEY>` header if a key is configured.

Request body:
```json
{
  "school_data": {
    "school_name": "Vedha Educational Society",
    "academic_year": "2026-2027",
    "board": "CBSE",
    "state": "Andhra Pradesh",
    "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "period_schedule": [
      {"label": "P1", "start_time": "09:00", "end_time": "09:40"}
    ],
    "classes": [
      {"name": "III", "sections": ["A", "B"]}
    ],
    "subjects": [
      {"name": "Mathematics", "applicable_classes": ["III"], "periods_per_week": 6}
    ],
    "teachers": [
      {"teacher_id": "T001", "name": "Ramesh Kumar", "subject_specialization": ["Mathematics"]}
    ]
  },
  "provider": "gemini",
  "model": null,
  "extra_instructions": null
}
```

`provider` and `model` are optional — omit them to use the `.env` defaults.

Response:
```json
{
  "provider": "gemini",
  "model": "gemini-3.5-flash",
  "raw_output": "# Assignment Summary\n\n## Teachers\n\n- Total Teachers: 1\n..."
}
```

`raw_output` is a Markdown "Assignment Summary" — pure counts and tables (total
teachers, teachers by subject, assigned/not-assigned class-sections, additional
teachers needed by subject). See `app/prompts.py` for the exact rules the model
is given.

## Verification performed (Django → FastAPI conversion)

- `GET /health` — 200, `{"status": "ok", "default_provider": "..."}`.
- `POST /timetable/generate` with no `x-api-key` — 401.
- `POST /timetable/generate` with an empty body — 422 with a Pydantic validation
  error (missing `school_data`).
- A real end-to-end call against the configured Gemini key — 200, full
  Assignment Summary returned correctly.
- Confirmed via the actual Django backend + React frontend "Generate with AI"
  flow that the swap is a drop-in replacement — `AISERVICE_BASE_URL` didn't need
  to change.
