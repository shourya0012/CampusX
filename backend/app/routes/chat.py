from fastapi import APIRouter, Depends, HTTPException
from google.genai import types as genai_types
from app.auth.firebase_auth import AuthenticatedUser, get_current_user
from app.config import settings
from app.models.schemas import ChatRequest, ChatResponse
from app.services.gemini_service import generate_with_gemini

router = APIRouter(prefix="/api", tags=["chat"])

STUDENT_TUTOR_SYSTEM_PROMPT = (
    "You are CampusX AI Tutor, a friendly, clear, and encouraging academic assistant for "
    "college students. Help students understand programming concepts, answer study questions, "
    "summarize topics concisely, and explain difficult subjects in simple language with "
    "practical examples."
)


@router.post("/chat", response_model=ChatResponse)
async def chat_with_tutor(
    payload: ChatRequest,
    _current_user: AuthenticatedUser = Depends(get_current_user),
):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "GEMINI_API_KEY is not configured on the backend server. "
                "Add your Google Gemini API key to backend/.env and restart the server to use the AI Chatbot."
            ),
        )

    temperature = round(max(0.1, min(1.0, float(payload.temperature))), 2)

    contents: list[genai_types.Content] = []
    for msg in payload.messages[-16:]:
        if msg.role == "system":
            continue
        gemini_role = "model" if msg.role == "assistant" else "user"
        contents.append(
            genai_types.Content(
                role=gemini_role,
                parts=[genai_types.Part.from_text(text=msg.content)],
            )
        )

    if not contents:
        raise HTTPException(status_code=400, detail="Please enter a message to send.")

    reply, used_model = await generate_with_gemini(
        contents=contents,
        system_instruction=STUDENT_TUTOR_SYSTEM_PROMPT,
        temperature=temperature,
        max_output_tokens=1024,
    )

    return ChatResponse(
        reply=reply,
        model=used_model,
        temperature=temperature,
    )
