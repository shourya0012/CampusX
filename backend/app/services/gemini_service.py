from __future__ import annotations

from typing import Any
from fastapi import HTTPException
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from app.config import settings

FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-4-hydrogen",
]


def _candidate_models(preferred: str) -> list[str]:
    ordered: list[str] = []
    for m in [preferred, *FALLBACK_MODELS]:
        if m and m not in ordered:
            ordered.append(m)
    return ordered


async def generate_with_gemini(
    *,
    contents: Any,
    system_instruction: str,
    temperature: float,
    max_output_tokens: int = 1024,
    response_mime_type: str | None = None,
    response_schema: Any = None,
) -> tuple[str, str]:
    """Call Google Gemini asynchronously using the official google-genai SDK.

    Falls back automatically across active Flash models if the primary model
    returns 404 (deprecated) or 503 (temporary high demand). Never exposes keys.
    """
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    config_kwargs: dict[str, Any] = {
        "system_instruction": system_instruction,
        "temperature": temperature,
        "max_output_tokens": max_output_tokens,
    }
    if response_mime_type:
        config_kwargs["response_mime_type"] = response_mime_type
    if response_schema is not None:
        config_kwargs["response_schema"] = response_schema

    config = genai_types.GenerateContentConfig(**config_kwargs)

    last_api_error: genai_errors.APIError | None = None
    for model_name in _candidate_models(settings.GEMINI_MODEL):
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
            reply = (getattr(response, "text", None) or "").strip()
            if not reply:
                reply = "I received an empty response from Gemini. Please try rephrasing your question."
            return reply, model_name
        except genai_errors.APIError as exc:
            last_api_error = exc
            code = getattr(exc, "code", None)
            msg_lower = str(exc).lower()

            if code in (401, 403) or "api key" in msg_lower or "permission" in msg_lower:
                raise HTTPException(
                    status_code=502,
                    detail="Google Gemini rejected the configured API key. Please verify GEMINI_API_KEY in backend/.env.",
                )
            if code in (404, 503, 429):
                continue
            raise HTTPException(
                status_code=502,
                detail="Google Gemini returned an upstream service error. Please try again shortly.",
            )
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Unable to reach Google Gemini servers. Please check network connectivity and try again.",
            )

    last_code = getattr(last_api_error, "code", None) if last_api_error else None
    if last_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Google Gemini rate limit or quota exceeded across available models. Please check your Gemini API quota.",
        )
    if last_code == 503:
        raise HTTPException(
            status_code=503,
            detail="Google Gemini models are temporarily experiencing high demand (503). Please try again in a moment.",
        )
    raise HTTPException(
        status_code=502,
        detail="No configured Google Gemini model is currently available for this API key.",
    )
