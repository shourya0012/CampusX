from typing import Literal, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    temperature: float = Field(default=0.7, ge=0.1, le=1.0)


class ChatResponse(BaseModel):
    reply: str
    model: str
    temperature: float


class RagQueryRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=2000)
    document_id: Optional[str] = None
    top_k: int = Field(default=4, ge=1, le=10)


class VoiceParseRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=8000)
    language: str = Field(default="en-IN", max_length=20)
    today_date: Optional[str] = Field(default=None, max_length=20)


class VoiceRequirements(BaseModel):
    subject_name: Optional[str] = None
    exam_date: Optional[str] = None
    chapters_and_topics: list[str] = Field(default_factory=list)
    daily_study_hours: Optional[float] = None
    preferred_study_timings: Optional[str] = None
    weak_topics: list[str] = Field(default_factory=list)
    preparation_level: Optional[str] = None
    revision_and_practice_preference: Optional[str] = None
    missing_fields: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    ready_to_generate: bool = False


class VoiceParseResponse(BaseModel):
    requirements: VoiceRequirements
    model: str


class VoiceGenerateRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=8000)
    requirements: VoiceRequirements
    language: str = Field(default="en-IN", max_length=20)
    today_date: Optional[str] = Field(default=None, max_length=20)


class TimetableSession(BaseModel):
    id: str = ""
    subjectName: str
    topic: str = ""
    startTime: str = ""
    endTime: str = ""
    hours: float = 1.0
    sessionType: Literal[
        "Study", "Break", "Revision", "Practice", "Mock Test", "Final Revision"
    ] = "Study"
    priority: Literal["High", "Medium", "Low"] = "Medium"
    deadline: str = ""
    focusTip: str = ""
    completed: bool = False


class TimetableDay(BaseModel):
    date: str
    dayLabel: str
    sessions: list[TimetableSession] = Field(default_factory=list)


class StudyTimetable(BaseModel):
    days: list[TimetableDay] = Field(default_factory=list)
    totalScheduledHours: float = 0.0
    unallocatedHours: float = 0.0
    summary: str = ""


class ChapterStudyNote(BaseModel):
    id: str = ""
    title: str
    chapter: str
    category: str = "Exam Prep"
    definitions: list[str] = Field(default_factory=list)
    key_concepts: list[str] = Field(default_factory=list)
    simple_explanation: str = ""
    formulas: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)
    exam_questions: list[str] = Field(default_factory=list)
    quick_revision_points: list[str] = Field(default_factory=list)
    insufficient_info: bool = False
    insufficient_note: str = ""
    formatted_content: str = ""


class VoiceGeneratedBundle(BaseModel):
    timetable: StudyTimetable
    notes: list[ChapterStudyNote] = Field(default_factory=list)


class VoiceGenerateResponse(BaseModel):
    requirements: VoiceRequirements
    timetable: StudyTimetable
    notes: list[ChapterStudyNote]
    model: str
