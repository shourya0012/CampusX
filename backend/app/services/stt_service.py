from __future__ import annotations

from fastapi import HTTPException
from google.genai import types as genai_types

from app.config import settings
from app.services.gemini_service import generate_with_gemini

_EXTENSION_MIME_MAP = {
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
}


def _resolve_mime_type(filename: str, content_type: str | None) -> str:
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct.startswith("audio/"):
        return ct
    if ct == "video/webm":
        return "audio/webm"
    lower_name = (filename or "").lower()
    for ext, mime in _EXTENSION_MIME_MAP.items():
        if lower_name.endswith(ext):
            return mime
    return "audio/webm"


def _normalize_language_label(language_hint: str) -> str:
    hint = (language_hint or "").strip()
    if not hint:
        return "en-IN"
    return hint


class GeminiSpeechToTextService:
    """Zero-local-RAM speech-to-text service powered by Gemini multimodal audio input."""

    async def transcribe_bytes(
        self,
        audio_bytes: bytes,
        filename: str,
        language_hint: str = "en-IN",
        content_type: str | None = None,
    ) -> dict[str, object]:
        if not audio_bytes or len(audio_bytes) < 100:
            raise HTTPException(
                status_code=400,
                detail="Recorded audio was empty. Please speak into your microphone and try again.",
            )

        if not settings.GEMINI_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="GEMINI_API_KEY is not configured on the backend server for voice transcription.",
            )

        mime_type = _resolve_mime_type(filename, content_type)
        lang_label = _normalize_language_label(language_hint)
        lang_instruction = (
            "The speaker is likely speaking Hindi (Devanagari or Hinglish) or English."
            if lang_label.lower().startswith("hi")
            else "The speaker is likely speaking English (or Indian English / technical study terms)."
        )

        prompt = (
            f"Transcribe the attached student voice recording word for word. {lang_instruction} "
            "Return ONLY the exact spoken transcript text with proper punctuation and no commentary. "
            "If the audio is silent or contains no intelligible speech, return exactly [NO_SPEECH]."
        )

        transcript, used_model = await generate_with_gemini(
            contents=[
                genai_types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                prompt,
            ],
            system_instruction=(
                "You are an accurate speech-to-text transcriber. Output only the spoken transcript."
            ),
            temperature=0.0,
            max_output_tokens=1024,
        )

        cleaned = transcript.strip()
        if not cleaned or "[NO_SPEECH]" in cleaned.upper():
            raise HTTPException(
                status_code=400,
                detail="No speech was detected in the recording. Please speak clearly or type below.",
            )

        return {
            "transcript": cleaned,
            "language": lang_label,
            "duration_seconds": None,
            "engine": f"gemini ({used_model})",
        }


stt_service = GeminiSpeechToTextService()
