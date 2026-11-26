import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

RETIRED_GEMINI_MODELS = {"gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"}
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"


def _resolve_gemini_model() -> str:
    raw = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip()
    if not raw or raw in RETIRED_GEMINI_MODELS:
        return DEFAULT_GEMINI_MODEL
    return raw


def _resolve_optional_path(env_val: str) -> str:
    cleaned = env_val.strip()
    if not cleaned:
        return ""
    p = Path(cleaned)
    if not p.is_absolute():
        p = (BASE_DIR / p).resolve()
    return str(p)


class Settings:
    """Application configuration loaded from environment variables."""

    APP_NAME: str = "CampusX API"
    APP_VERSION: str = "1.0.0"

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL: str = _resolve_gemini_model()

    FIREBASE_SERVICE_ACCOUNT_PATH: str = _resolve_optional_path(
        os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    )
    FIREBASE_SERVICE_ACCOUNT_JSON: str = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "").strip()

    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ]

    CHROMA_PERSIST_DIR: str = str(
        (BASE_DIR / os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")).resolve()
    )
    UPLOAD_DIR: str = str((BASE_DIR / os.getenv("UPLOAD_DIR", "./uploads")).resolve())
    EMBEDDING_MODEL: str = (
        os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2").strip() or "all-MiniLM-L6-v2"
    )


settings = Settings()
