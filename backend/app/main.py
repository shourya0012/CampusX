from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes.auth import router as auth_router
from app.routes.health import router as health_router
from app.routes.weather import router as weather_router
from app.routes.chat import router as chat_router
from app.routes.rag import router as rag_router
from app.routes.voice_study import router as voice_study_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for CampusX — AI Student Hub",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(weather_router)
app.include_router(chat_router)
app.include_router(rag_router)
app.include_router(voice_study_router)


@app.get("/")
async def root():
    return {
        "message": "CampusX Backend API is running",
        "docs": "/docs",
        "health": "/api/health",
    }
