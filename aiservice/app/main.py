from fastapi import FastAPI

from app.routes import router

app = FastAPI(title="Vedha Educational Society — AI Service")
app.include_router(router)
