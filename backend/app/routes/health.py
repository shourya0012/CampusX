from fastapi import APIRouter
from app.auth.firebase_auth import is_firebase_configured
from app.config import settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check():
    """Return service health and configuration status without exposing secrets."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "integrations": {
            "firebase_auth_configured": is_firebase_configured(),
            "gemini_configured": bool(settings.GEMINI_API_KEY),
            "weather_configured": True,
            "weather_provider": "Open-Meteo",
            "gemini_model": settings.GEMINI_MODEL,
            "embedding_model": settings.EMBEDDING_MODEL,
        },
    }
