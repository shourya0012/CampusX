from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.auth.firebase_auth import AuthenticatedUser, get_current_user
from app.config import settings
from app.models.schemas import (
    ChapterStudyNote,
    StudyTimetable,
    TimetableDay,
    TimetableSession,
    VoiceGenerateRequest,
    VoiceGenerateResponse,
    VoiceParseRequest,
    VoiceParseResponse,
    VoiceRequirements,
)
from app.services.gemini_service import generate_with_gemini
from app.services.stt_service import stt_service

router = APIRouter(prefix="/api/voice-study", tags=["voice-study"])

MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("/transcribe")
async def transcribe_voice_audio(
    file: UploadFile = File(...),
    language: str = Form(default="en-IN"),
    _current_user: AuthenticatedUser = Depends(get_current_user),
):
    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=400, detail="Audio recording exceeds the 25 MB upload limit."
        )
    return await stt_service.transcribe_bytes(
        audio_bytes,
        file.filename or "recording.webm",
        language,
        content_type=file.content_type,
    )


class _GeminiParsedRequirements(BaseModel):
    subject_name: str = ""
    exam_date: str = ""
    chapters_and_topics: list[str] = Field(default_factory=list)
    daily_study_hours: float = 0.0
    preferred_study_timings: str = ""
    weak_topics: list[str] = Field(default_factory=list)
    preparation_level: str = ""
    revision_and_practice_preference: str = ""
    follow_up_questions: list[str] = Field(default_factory=list)


class _GeminiTimetableSession(BaseModel):
    topic: str
    startTime: str
    endTime: str
    hours: float
    sessionType: str
    priority: str
    focusTip: str


class _GeminiTimetableDay(BaseModel):
    date: str
    dayLabel: str
    sessions: list[_GeminiTimetableSession] = Field(default_factory=list)


class _GeminiChapterNote(BaseModel):
    chapter: str
    title: str
    definitions: list[str] = Field(default_factory=list)
    key_concepts: list[str] = Field(default_factory=list)
    simple_explanation: str = ""
    formulas: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)
    exam_questions: list[str] = Field(default_factory=list)
    quick_revision_points: list[str] = Field(default_factory=list)
    insufficient_info: bool = False
    insufficient_note: str = ""


class _GeminiGeneratedTimetable(BaseModel):
    timetable_summary: str = ""
    days: list[_GeminiTimetableDay] = Field(default_factory=list)


class _GeminiGeneratedNotes(BaseModel):
    notes: list[_GeminiChapterNote] = Field(default_factory=list)


def _strip_json_fences(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _resolve_today(today_date: str | None) -> str:
    if today_date and re.match(r"^\d{4}-\d{2}-\d{2}$", today_date.strip()):
        return today_date.strip()
    return datetime.now(timezone.utc).date().isoformat()


def _compute_missing(req: VoiceRequirements) -> VoiceRequirements:
    missing: list[str] = []
    questions: list[str] = []

    if not (req.subject_name or "").strip():
        missing.append("subject_name")
        questions.append("Which subject is this exam for?")
    if not (req.exam_date or "").strip():
        missing.append("exam_date")
        questions.append("What is your exact exam date (YYYY-MM-DD)?")
    if not req.chapters_and_topics:
        missing.append("chapters_and_topics")
        questions.append(
            "Which chapters or topics do you need to study for this exam?"
        )

    for q in req.follow_up_questions:
        if q and q not in questions and len(questions) < 5:
            # Keep only relevant follow-ups when critical items are missing
            if missing:
                questions.append(q)

    req.missing_fields = missing
    req.follow_up_questions = questions if missing else []
    req.ready_to_generate = len(missing) == 0
    return req


def _format_note_content(note: ChapterStudyNote) -> str:
    sections: list[str] = []
    if note.insufficient_info and note.insufficient_note:
        sections.append(f"[Note on Topic Scope]\n{note.insufficient_note}")
    if note.simple_explanation:
        sections.append(f"Simple Explanation:\n{note.simple_explanation}")
    if note.definitions:
        sections.append(
            "Important Definitions:\n" + "\n".join(f"- {d}" for d in note.definitions)
        )
    if note.key_concepts:
        sections.append(
            "Key Concepts:\n" + "\n".join(f"- {c}" for c in note.key_concepts)
        )
    if note.formulas:
        sections.append(
            "Important Formulas:\n" + "\n".join(f"- {f}" for f in note.formulas)
        )
    if note.examples:
        sections.append(
            "Examples:\n" + "\n".join(f"- {ex}" for ex in note.examples)
        )
    if note.exam_questions:
        sections.append(
            "Important Exam Questions:\n"
            + "\n".join(f"{i}. {q}" for i, q in enumerate(note.exam_questions, start=1))
        )
    if note.quick_revision_points:
        sections.append(
            "Quick Revision Points:\n"
            + "\n".join(f"- {p}" for p in note.quick_revision_points)
        )
    return "\n\n".join(sections).strip()


@router.post("/parse", response_model=VoiceParseResponse)
async def parse_voice_requirements(
    payload: VoiceParseRequest,
    _current_user: AuthenticatedUser = Depends(get_current_user),
):
    transcript = payload.transcript.strip()
    if not transcript:
        raise HTTPException(
            status_code=400, detail="Please speak or enter a study transcript first."
        )

    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "GEMINI_API_KEY is not configured on the backend server. "
                "Add your Google Gemini API key to backend/.env to use the Voice Study Assistant."
            ),
        )

    today_str = _resolve_today(payload.today_date)
    system_instruction = (
        "You are an academic requirement extractor for CampusX. Extract structured exam "
        "preparation details from the student's spoken transcript (which may be in English, "
        "Hindi, or Hinglish). STRICT RULES: "
        "1. NEVER invent or guess an exam_date or chapters_and_topics if the student did not state them. "
        "2. Return empty string '' for unknown string fields, 0.0 for unknown daily_study_hours, "
        "and [] for unknown lists. "
        f"3. Today's date is {today_str}. If the student states a relative date (like 'in 5 days' "
        "or 'December 5'), convert it to YYYY-MM-DD; if they give no date, leave exam_date as ''. "
        "4. Preserve topic/chapter names clearly in English (translating Hindi phrasing cleanly if helpful, "
        "while keeping subject terminology exact)."
    )
    prompt = (
        f"Spoken Language Hint: {payload.language}\n"
        f"Today's Date: {today_str}\n"
        f"Student Transcript:\n{transcript}\n\n"
        "Extract the structured requirements into the JSON schema."
    )

    raw_json, used_model = await generate_with_gemini(
        contents=prompt,
        system_instruction=system_instruction,
        temperature=0.1,
        max_output_tokens=1024,
        response_mime_type="application/json",
        response_schema=_GeminiParsedRequirements,
    )

    try:
        parsed_raw = _GeminiParsedRequirements.model_validate_json(
            _strip_json_fences(raw_json)
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an unreadable structure while analyzing your transcript. Please try again.",
        )

    exam_date_clean = parsed_raw.exam_date.strip()
    if exam_date_clean and not re.match(r"^\d{4}-\d{2}-\d{2}$", exam_date_clean):
        exam_date_clean = ""

    requirements = VoiceRequirements(
        subject_name=parsed_raw.subject_name.strip() or None,
        exam_date=exam_date_clean or None,
        chapters_and_topics=[t.strip() for t in parsed_raw.chapters_and_topics if t.strip()],
        daily_study_hours=(
            round(parsed_raw.daily_study_hours, 1)
            if parsed_raw.daily_study_hours and parsed_raw.daily_study_hours > 0
            else None
        ),
        preferred_study_timings=parsed_raw.preferred_study_timings.strip() or None,
        weak_topics=[w.strip() for w in parsed_raw.weak_topics if w.strip()],
        preparation_level=parsed_raw.preparation_level.strip() or None,
        revision_and_practice_preference=(
            parsed_raw.revision_and_practice_preference.strip() or None
        ),
        follow_up_questions=parsed_raw.follow_up_questions,
    )
    requirements = _compute_missing(requirements)

    return VoiceParseResponse(requirements=requirements, model=used_model)


@router.post("/generate", response_model=VoiceGenerateResponse)
async def generate_voice_study_bundle(
    payload: VoiceGenerateRequest,
    _current_user: AuthenticatedUser = Depends(get_current_user),
):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "GEMINI_API_KEY is not configured on the backend server. "
                "Add your Google Gemini API key to backend/.env to generate study plans and notes."
            ),
        )

    req = _compute_missing(payload.requirements.model_copy(deep=True))
    if not req.ready_to_generate:
        missing_readable = ", ".join(req.missing_fields)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot generate plan yet because required details are missing: {missing_readable}. "
                "Please provide the exam date, subject, and chapter/topic list first."
            ),
        )

    today_str = _resolve_today(payload.today_date)
    daily_hours = req.daily_study_hours if (req.daily_study_hours and req.daily_study_hours > 0) else 3.0
    preferred_timings = req.preferred_study_timings or "Flexible daytime / evening slots"
    prep_level = req.preparation_level or "Intermediate"
    revision_pref = req.revision_and_practice_preference or "Include regular revision, practice questions, and mock tests"

    timetable_system = (
        "You are CampusX AI Study Architect. Generate a personalized, practical daily study "
        "timetable from today up to the day before/of the exam (cap at most 10 scheduled days if "
        "the exam is far away, always including the final revision day before the exam).\n"
        "- Include explicit startTime and endTime (e.g., '06:00 PM', '07:00 PM') matching preferred_study_timings.\n"
        "- Include short 'Break' sessions, 'Study' sessions, 'Revision' sessions, 'Practice' question sessions, "
        "at least one 'Mock Test', and 'Final Revision' right before the exam.\n"
        "- Give 'High' priority and extra time to weak_topics.\n"
        "- Allowed sessionType values ONLY: 'Study', 'Break', 'Revision', 'Practice', 'Mock Test', 'Final Revision'.\n"
        "- Allowed priority values ONLY: 'High', 'Medium', 'Low'.\n"
        "- Keep focusTip concise (under 15 words)."
    )

    notes_system = (
        "You are CampusX AI Study Tutor. Generate concise, exam-ready chapter-wise study notes "
        "for EVERY topic listed in chapters_and_topics:\n"
        "- Include 2-3 definitions, 3-4 key_concepts, a clear simple_explanation, formulas (when relevant, else []), "
        "1-2 examples, 2-3 exam_questions, and 3 quick_revision_points.\n"
        "- HONESTY RULE: Do NOT fabricate niche syllabus details or textbook-specific facts not implied by "
        "standard well-known concepts or the student's input. If a topic name is too vague/ambiguous "
        "(e.g. 'Chapter 4' with no topic name) or lacks sufficient detail, set insufficient_info=true "
        "and explain clearly in insufficient_note what the student should clarify."
    )

    prompt = (
        f"Today's Date: {today_str}\n"
        f"Subject: {req.subject_name}\n"
        f"Exam Date: {req.exam_date}\n"
        f"Chapters & Topics: {json.dumps(req.chapters_and_topics)}\n"
        f"Weak Topics: {json.dumps(req.weak_topics)}\n"
        f"Daily Available Study Hours: {daily_hours}\n"
        f"Preferred Study Timings: {preferred_timings}\n"
        f"Preparation Level: {prep_level}\n"
        f"Revision & Practice Preference: {revision_pref}\n"
        f"Original Student Transcript:\n{payload.transcript}\n"
    )

    (raw_timetable_json, used_model), (raw_notes_json, _) = await asyncio.gather(
        generate_with_gemini(
            contents=prompt,
            system_instruction=timetable_system,
            temperature=0.25,
            max_output_tokens=6144,
            response_mime_type="application/json",
            response_schema=_GeminiGeneratedTimetable,
        ),
        generate_with_gemini(
            contents=prompt,
            system_instruction=notes_system,
            temperature=0.25,
            max_output_tokens=8192,
            response_mime_type="application/json",
            response_schema=_GeminiGeneratedNotes,
        ),
    )

    try:
        timetable_parsed = _GeminiGeneratedTimetable.model_validate_json(
            _strip_json_fences(raw_timetable_json)
        )
        notes_parsed = _GeminiGeneratedNotes.model_validate_json(
            _strip_json_fences(raw_notes_json)
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an incomplete timetable/notes structure. Please try regenerating.",
        )

    valid_types = {"Study", "Break", "Revision", "Practice", "Mock Test", "Final Revision"}
    valid_priorities = {"High", "Medium", "Low"}

    days: list[TimetableDay] = []
    total_hours = 0.0
    for d_idx, raw_day in enumerate(timetable_parsed.days):
        sessions: list[TimetableSession] = []
        for s_idx, raw_sess in enumerate(raw_day.sessions):
            s_type = raw_sess.sessionType if raw_sess.sessionType in valid_types else "Study"
            prio = raw_sess.priority if raw_sess.priority in valid_priorities else "Medium"
            hrs = max(0.2, round(float(raw_sess.hours or 0.5), 1))
            if s_type != "Break":
                total_hours += hrs
            sessions.append(
                TimetableSession(
                    id=f"vs-{d_idx}-{s_idx}-{int(datetime.now().timestamp())}",
                    subjectName=f"{req.subject_name}: {raw_sess.topic}"
                    if s_type != "Break"
                    else f"Break — {raw_sess.topic or 'Short Rest'}",
                    topic=raw_sess.topic,
                    startTime=raw_sess.startTime,
                    endTime=raw_sess.endTime,
                    hours=hrs,
                    sessionType=s_type,
                    priority=prio,
                    deadline=req.exam_date or "",
                    focusTip=raw_sess.focusTip or f"{s_type} session",
                    completed=False,
                )
            )
        if sessions:
            days.append(
                TimetableDay(
                    date=raw_day.date,
                    dayLabel=raw_day.dayLabel or raw_day.date,
                    sessions=sessions,
                )
            )

    timetable = StudyTimetable(
        days=days,
        totalScheduledHours=round(total_hours, 1),
        unallocatedHours=0.0,
        summary=timetable_parsed.timetable_summary
        or f"{len(days)}-day personalized {req.subject_name} exam plan until {req.exam_date}.",
    )

    notes: list[ChapterStudyNote] = []
    for n_idx, raw_note in enumerate(notes_parsed.notes):
        note = ChapterStudyNote(
            id=f"vnote-{int(datetime.now().timestamp())}-{n_idx}",
            title=raw_note.title or f"{req.subject_name}: {raw_note.chapter}",
            chapter=raw_note.chapter,
            category="Exam Prep",
            definitions=raw_note.definitions,
            key_concepts=raw_note.key_concepts,
            simple_explanation=raw_note.simple_explanation,
            formulas=raw_note.formulas,
            examples=raw_note.examples,
            exam_questions=raw_note.exam_questions,
            quick_revision_points=raw_note.quick_revision_points,
            insufficient_info=raw_note.insufficient_info,
            insufficient_note=raw_note.insufficient_note,
        )
        note.formatted_content = _format_note_content(note)
        notes.append(note)

    return VoiceGenerateResponse(
        requirements=req,
        timetable=timetable,
        notes=notes,
        model=used_model,
    )
