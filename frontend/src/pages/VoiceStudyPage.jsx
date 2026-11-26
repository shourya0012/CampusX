import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  BookOpen,
  Languages,
  Send,
  Pencil,
  Save,
  RotateCcw,
  ArrowRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  parseVoiceStudyTranscript,
  generateVoiceStudyBundle,
  transcribeVoiceAudio,
} from '../services/api.js';

const SPEECH_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'hi-IN', label: 'Hindi (India) — हिन्दी' },
];

const SAMPLE_SCRIPTS = [
  {
    label: 'DBMS Exam (English)',
    text:
      'I have a Database Management Systems exam on December 6. I need to cover Normalization, B-Trees, SQL Joins, and ACID Transactions. I can study 4 hours daily in the evening from 6 PM to 10 PM. My weak topics are Normalization and B-Trees. My current level is beginner and I want daily practice questions plus a mock test before final revision.',
  },
  {
    label: 'Physics Exam (Hindi)',
    text:
      'मेरी Physics की परीक्षा 8 दिसंबर को है। मुझे Newton Laws of Motion, Work Energy Power, और Rotational Dynamics पढ़ना है। मैं रोज़ सुबह 7 से 10 बजे तक 3 घंटे पढ़ सकता हूँ। Rotational Dynamics मेरा weak topic है और मुझे हर दिन revision और practice questions चाहिए।',
  },
  {
    label: 'Incomplete Prompt (Missing Info Test)',
    text:
      'I want to prepare for my Computer Networks exam. I can study 2 hours every evening.',
  },
];

const SESSION_BADGE_CLASS = {
  Study: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  Break: 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300',
  Revision: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  Practice: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  'Mock Test': 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'Final Revision': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

export default function VoiceStudyPage({
  studyPlan,
  onSaveStudyPlan,
  notes,
  onSaveNotes,
  healthStatus,
  onNavigate,
}) {
  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window.MediaRecorder !== 'undefined';

  const [language, setLanguage] = useState('en-IN');
  const [isListening, setIsListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcriptionNote, setTranscriptionNote] = useState('');
  const [transcript, setTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');

  const [parsing, setParsing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [apiError, setApiError] = useState('');

  const [requirements, setRequirements] = useState(null);
  const [chaptersInput, setChaptersInput] = useState('');
  const [weakTopicsInput, setWeakTopicsInput] = useState('');

  const [generatedTimetable, setGeneratedTimetable] = useState(null);
  const [generatedNotes, setGeneratedNotes] = useState([]);
  const [usedModel, setUsedModel] = useState('');
  const [resultTab, setResultTab] = useState('timetable');

  const [savedToPlanner, setSavedToPlanner] = useState(false);
  const [savedNoteIds, setSavedNoteIds] = useState({});
  const [editingNoteIdx, setEditingNoteIdx] = useState(null);
  const [noteDraft, setNoteDraft] = useState({ title: '', formatted_content: '' });

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const discardRecordingRef = useRef(false);
  const geminiReady = healthStatus?.integrations?.gemini_configured;

  const stopMediaTracks = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  // Never keep listening after leaving the page
  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
      stopMediaTracks();
    };
  }, []);

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        stopMediaTracks();
      }
    } else {
      stopMediaTracks();
    }
    setIsListening(false);
  };

  const startListening = async () => {
    setSpeechError('');
    setTranscriptionNote('');

    if (!speechSupported) {
      setSpeechError(
        'Microphone audio recording is not supported in this browser. Please use Chrome, Edge, or Firefox, or type/edit your transcript below.'
      );
      return;
    }

    if (transcribing) return;

    if (isListening) {
      stopListening();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType =
        preferredMimeTypes.find((type) => window.MediaRecorder.isTypeSupported(type)) || '';

      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);

      audioChunksRef.current = [];
      discardRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stopMediaTracks();
        setIsListening(false);
        mediaRecorderRef.current = null;

        if (discardRecordingRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const effectiveType = recorder.mimeType || mimeType || 'audio/webm';
        const ext = effectiveType.includes('ogg')
          ? 'ogg'
          : effectiveType.includes('mp4')
          ? 'mp4'
          : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: effectiveType });
        audioChunksRef.current = [];

        if (audioBlob.size < 500) {
          setSpeechError(
            'Recording was too short or silent. Click Start, speak clearly, and then click Stop.'
          );
          return;
        }

        setTranscribing(true);
        try {
          const result = await transcribeVoiceAudio({
            audioBlob,
            filename: `voice-note.${ext}`,
            language,
          });
          const spoken = (result.transcript || '').trim();
          if (spoken) {
            setTranscript((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${spoken}`);
            setTranscriptionNote(
              `Transcribed locally via ${result.engine} (${result.language}, ${result.duration_seconds}s)`
            );
          } else {
            setSpeechError('No speech was detected in the recording. Please try again.');
          }
        } catch (err) {
          setSpeechError(err.message || 'Unable to transcribe recorded audio.');
        } finally {
          setTranscribing(false);
        }
      };

      recorder.onerror = () => {
        stopMediaTracks();
        setIsListening(false);
        setSpeechError('Audio recording encountered an error. Please try again or type below.');
      };

      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setIsListening(true);
      recorder.start(250);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err) {
      stopMediaTracks();
      setIsListening(false);
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setSpeechError(
          'Microphone permission was denied. Allow microphone access in your browser site settings or type your exam details below.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setSpeechError('No microphone device was found. Connect a microphone or type below.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setSpeechError('Microphone is currently in use by another application.');
      } else {
        setSpeechError(err?.message || 'Unable to access microphone.');
      }
    }
  };

  const handleClearTranscript = () => {
    discardRecordingRef.current = true;
    stopListening();
    setRecordingSeconds(0);
    setTranscriptionNote('');
    setTranscript('');
    setSpeechError('');
    setApiError('');
    setRequirements(null);
    setGeneratedTimetable(null);
    setGeneratedNotes([]);
    setSavedToPlanner(false);
    setSavedNoteIds({});
  };

  const syncRequirementsInputs = (req) => {
    setRequirements(req);
    setChaptersInput((req.chapters_and_topics || []).join(', '));
    setWeakTopicsInput((req.weak_topics || []).join(', '));
  };

  const handleAnalyze = async () => {
    const clean = transcript.trim();
    if (!clean) {
      setApiError('Please speak into the microphone or type your exam details first.');
      return;
    }
    if (isListening) stopListening();

    setParsing(true);
    setApiError('');
    setGeneratedTimetable(null);
    setGeneratedNotes([]);
    setSavedToPlanner(false);
    setSavedNoteIds({});

    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      const data = await parseVoiceStudyTranscript({
        transcript: clean,
        language,
        todayDate,
      });
      syncRequirementsInputs(data.requirements);
    } catch (err) {
      setApiError(err.message || 'Failed to analyze your study transcript.');
    } finally {
      setParsing(false);
    }
  };

  const buildUpdatedRequirements = () => {
    const chapters = chaptersInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const weak = weakTopicsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const missing = [];
    if (!(requirements?.subject_name || '').trim()) missing.push('subject_name');
    if (!(requirements?.exam_date || '').trim()) missing.push('exam_date');
    if (!chapters.length) missing.push('chapters_and_topics');

    return {
      ...(requirements || {}),
      chapters_and_topics: chapters,
      weak_topics: weak,
      missing_fields: missing,
      ready_to_generate: missing.length === 0,
    };
  };

  const handleGenerateBundle = async () => {
    const nextReq = buildUpdatedRequirements();
    setRequirements(nextReq);

    if (!nextReq.ready_to_generate) {
      setApiError(
        `Please fill in the missing details (${nextReq.missing_fields.join(', ')}) before generating your timetable and notes.`
      );
      return;
    }

    setGenerating(true);
    setApiError('');
    setSavedToPlanner(false);
    setSavedNoteIds({});

    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      const res = await generateVoiceStudyBundle({
        transcript: transcript.trim(),
        requirements: nextReq,
        language,
        todayDate,
      });
      setRequirements(res.requirements);
      setGeneratedTimetable(res.timetable);
      setGeneratedNotes(res.notes || []);
      setUsedModel(res.model || '');
      setResultTab('timetable');
    } catch (err) {
      setApiError(err.message || 'Failed to generate timetable and notes.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleGeneratedSession = (dayIdx, sessId) => {
    if (!generatedTimetable) return;
    setGeneratedTimetable((prev) => ({
      ...prev,
      days: prev.days.map((d, idx) =>
        idx === dayIdx
          ? {
              ...d,
              sessions: d.sessions.map((s) =>
                s.id === sessId ? { ...s, completed: !s.completed } : s
              ),
            }
          : d
      ),
    }));
    setSavedToPlanner(false);
  };

  const deleteGeneratedSession = (dayIdx, sessId) => {
    if (!generatedTimetable) return;
    setGeneratedTimetable((prev) => {
      const nextDays = prev.days
        .map((d, idx) =>
          idx === dayIdx
            ? { ...d, sessions: d.sessions.filter((s) => s.id !== sessId) }
            : d
        )
        .filter((d) => d.sessions.length > 0);
      const total = nextDays
        .flatMap((d) => d.sessions)
        .filter((s) => s.sessionType !== 'Break')
        .reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
      return { ...prev, days: nextDays, totalScheduledHours: Math.round(total * 10) / 10 };
    });
    setSavedToPlanner(false);
  };

  const handleSaveToStudyPlanner = () => {
    if (!generatedTimetable || !requirements) return;

    const existingSubjects = studyPlan?.subjects || [];
    const subjectName = requirements.subject_name || 'Voice Study Subject';
    const newSubjectEntry = {
      id: `sub-voice-${Date.now()}`,
      name: subjectName,
      hoursNeeded: Math.max(1, Math.round(generatedTimetable.totalScheduledHours || 4)),
      priority: (requirements.weak_topics || []).length ? 'High' : 'Medium',
      deadline: requirements.exam_date || '',
    };

    const filteredExisting = existingSubjects.filter(
      (s) => s.name.toLowerCase() !== subjectName.toLowerCase()
    );

    onSaveStudyPlan({
      subjects: [newSubjectEntry, ...filteredExisting],
      dailyHours: requirements.daily_study_hours || studyPlan?.dailyHours || 3,
      schedule: {
        days: generatedTimetable.days,
        totalScheduledHours: generatedTimetable.totalScheduledHours,
        unallocatedHours: generatedTimetable.unallocatedHours || 0,
      },
    });
    setSavedToPlanner(true);
  };

  const handleSaveSingleNote = (noteObj) => {
    if (savedNoteIds[noteObj.id]) return;
    const now = new Date().toISOString();
    const smartNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: noteObj.title,
      category: 'Exam Prep',
      pinned: false,
      content: noteObj.formatted_content || noteObj.simple_explanation || '',
      updatedAt: now,
    };
    onSaveNotes([smartNote, ...notes]);
    setSavedNoteIds((prev) => ({ ...prev, [noteObj.id]: true }));
  };

  const handleSaveAllNotes = () => {
    const now = new Date().toISOString();
    const toAdd = [];
    const nextSaved = { ...savedNoteIds };

    generatedNotes.forEach((n, idx) => {
      if (!nextSaved[n.id]) {
        toAdd.push({
          id: `note-${Date.now()}-${idx}`,
          title: n.title,
          category: 'Exam Prep',
          pinned: false,
          content: n.formatted_content || n.simple_explanation || '',
          updatedAt: now,
        });
        nextSaved[n.id] = true;
      }
    });

    if (toAdd.length) {
      onSaveNotes([...toAdd, ...notes]);
      setSavedNoteIds(nextSaved);
    }
  };

  const startEditNote = (idx, note) => {
    setEditingNoteIdx(idx);
    setNoteDraft({
      title: note.title,
      formatted_content: note.formatted_content,
    });
  };

  const saveEditNote = (idx) => {
    setGeneratedNotes((prev) =>
      prev.map((n, i) =>
        i === idx
          ? {
              ...n,
              title: noteDraft.title.trim() || n.title,
              formatted_content: noteDraft.formatted_content,
            }
          : n
      )
    );
    setEditingNoteIdx(null);
  };

  const allNotesSaved =
    generatedNotes.length > 0 && generatedNotes.every((n) => savedNoteIds[n.id]);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            CampusX Voice Study Assistant
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Speak naturally about your upcoming exam, syllabus topics, and study timings to
            auto-generate a personalized timetable and chapter-wise notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-indigo-500" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isListening}
            aria-label="Speech recognition language"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            {SPEECH_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Missing Gemini Key Notice */}
      {healthStatus && !geminiReady && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Gemini API Key Required for Plan & Note Generation</div>
            <p className="mt-0.5 opacity-90">
              Voice dictation works locally in your browser, and adding <code>GEMINI_API_KEY</code>{' '}
              to <code>backend/.env</code> enables AI requirement extraction, timetable creation,
              and chapter-wise notes.
            </p>
          </div>
        </div>
      )}

      {/* Unsupported Browser Notice */}
      {!speechSupported && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Audio Recording Not Supported in This Browser</div>
            <p className="mt-0.5 opacity-90">
              Microphone recording requires Chrome, Edge, or Firefox. You can still type or paste
              your study requirements in the transcript box below and generate your timetable and
              notes.
            </p>
          </div>
        </div>
      )}

      {/* Step 1: Microphone & Transcript Studio */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Pulsing Microphone Button */}
          <div className="flex flex-col items-center justify-center gap-3 shrink-0">
            <div className="relative flex items-center justify-center">
              {isListening && (
                <>
                  <span className="absolute h-24 w-24 rounded-full bg-rose-500/25 animate-ping" />
                  <span className="absolute h-20 w-20 rounded-full bg-rose-500/20 animate-pulse" />
                </>
              )}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={transcribing}
                aria-label={isListening ? 'Stop recording' : 'Start voice recording'}
                className={`relative z-10 h-16 w-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all disabled:opacity-60 ${
                  isListening
                    ? 'bg-gradient-to-br from-rose-500 to-red-600 scale-105 shadow-rose-500/35'
                    : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-500 hover:scale-105 shadow-indigo-500/30'
                }`}
              >
                {transcribing ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : isListening ? (
                  <MicOff className="h-7 w-7" />
                ) : (
                  <Mic className="h-7 w-7" />
                )}
              </button>
            </div>

            <div className="text-center">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  transcribing
                    ? 'bg-indigo-500/15 text-indigo-500'
                    : isListening
                    ? 'bg-rose-500/15 text-rose-500'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    transcribing
                      ? 'bg-indigo-500 animate-pulse'
                      : isListening
                      ? 'bg-rose-500 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                />
                {transcribing
                  ? 'Transcribing...'
                  : isListening
                  ? `Recording ${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(
                      recordingSeconds % 60
                    ).padStart(2, '0')}`
                  : 'Mic Idle'}
              </span>
            </div>
          </div>

          {/* Transcript Controls & Preview */}
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Spoken Transcript Preview (Editable)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={startListening}
                  disabled={isListening || transcribing || !speechSupported}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-xs font-semibold transition-colors"
                >
                  <Mic className="h-3.5 w-3.5" /> Start
                </button>
                <button
                  type="button"
                  onClick={stopListening}
                  disabled={!isListening}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-45 text-white text-xs font-semibold transition-colors"
                >
                  <Square className="h-3.5 w-3.5" /> Stop
                </button>
                <button
                  type="button"
                  onClick={handleClearTranscript}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
            </div>

            <textarea
              rows={4}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Click Start (or the microphone), speak naturally about your exam, then click Stop to transcribe automatically—or edit/type here."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {transcribing && (
              <div className="px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-600 dark:text-indigo-300 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Converting your recorded speech to text on the CampusX backend...</span>
              </div>
            )}

            {transcriptionNote && !transcribing && (
              <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>{transcriptionNote}</span>
              </div>
            )}

            {/* Quick Example Prompts */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Sample prompts:</span>
              {SAMPLE_SCRIPTS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => {
                    setTranscript(sample.text);
                    setSpeechError('');
                    setApiError('');
                  }}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {speechError && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs sm:text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{speechError}</span>
          </div>
        )}

        {apiError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs sm:text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{apiError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={parsing || generating || !transcript.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold shadow-md transition-all"
          >
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>{parsing ? 'Analyzing Transcript...' : 'Analyze Study Requirements'}</span>
          </button>
        </div>
      </section>

      {/* Step 2: Extracted Requirements & Missing Info Follow-Up */}
      {requirements && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Extracted Exam Requirements
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify or complete any missing details below before generating your timetable and
                notes.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                requirements.ready_to_generate
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {requirements.ready_to_generate ? 'Ready to Generate' : 'Missing Required Details'}
            </span>
          </div>

          {!requirements.ready_to_generate && requirements.follow_up_questions?.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                Please provide these missing details (CampusX never invents exam dates or chapters):
              </div>
              <ul className="list-disc list-inside text-xs text-amber-800 dark:text-amber-200 space-y-1">
                {requirements.follow_up_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Subject Name *
              </label>
              <input
                type="text"
                value={requirements.subject_name || ''}
                onChange={(e) =>
                  setRequirements({ ...requirements, subject_name: e.target.value })
                }
                placeholder="e.g., Database Management Systems"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Exam Date *
              </label>
              <input
                type="date"
                value={requirements.exam_date || ''}
                onChange={(e) => setRequirements({ ...requirements, exam_date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Daily Study Hours
              </label>
              <input
                type="number"
                min="0.5"
                max="16"
                step="0.5"
                value={requirements.daily_study_hours || ''}
                onChange={(e) =>
                  setRequirements({
                    ...requirements,
                    daily_study_hours: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="e.g., 4"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Chapters & Topics (comma-separated) *
              </label>
              <input
                type="text"
                value={chaptersInput}
                onChange={(e) => setChaptersInput(e.target.value)}
                placeholder="e.g., Normalization, B-Trees, SQL Joins, ACID Transactions"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Preparation Level
              </label>
              <input
                type="text"
                value={requirements.preparation_level || ''}
                onChange={(e) =>
                  setRequirements({ ...requirements, preparation_level: e.target.value })
                }
                placeholder="Beginner / Intermediate / Advanced"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Preferred Study Timings
              </label>
              <input
                type="text"
                value={requirements.preferred_study_timings || ''}
                onChange={(e) =>
                  setRequirements({ ...requirements, preferred_study_timings: e.target.value })
                }
                placeholder="e.g., 6 PM to 10 PM"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Weak Topics (prioritized)
              </label>
              <input
                type="text"
                value={weakTopicsInput}
                onChange={(e) => setWeakTopicsInput(e.target.value)}
                placeholder="e.g., Normalization, B-Trees"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Revision & Practice Goal
              </label>
              <input
                type="text"
                value={requirements.revision_and_practice_preference || ''}
                onChange={(e) =>
                  setRequirements({
                    ...requirements,
                    revision_and_practice_preference: e.target.value,
                  })
                }
                placeholder="e.g., Daily practice + mock test"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerateBundle}
              disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-semibold shadow-md transition-all"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>
                {generating
                  ? 'Generating Timetable & Chapter Notes...'
                  : 'Generate Timetable & Chapter Notes'}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* Loading Indicator */}
      {generating && (
        <div className="rounded-2xl border border-indigo-500/30 bg-white dark:bg-navy-900 p-10 text-center space-y-3">
          <Loader2 className="h-9 w-9 text-indigo-500 animate-spin mx-auto" />
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            Building your personalized study timetable and chapter-wise notes...
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Allocating weak topics, revision blocks, breaks, mock tests, and exam-ready chapter
            notes with Gemini.
          </p>
        </div>
      )}

      {/* Step 3: Generated Timetable & Notes Results */}
      {generatedTimetable && !generating && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 p-1">
              <button
                type="button"
                onClick={() => setResultTab('timetable')}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  resultTab === 'timetable'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                <span>Study Timetable ({generatedTimetable.days.length} days)</span>
              </button>
              <button
                type="button"
                onClick={() => setResultTab('notes')}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  resultTab === 'notes'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Chapter-Wise Notes ({generatedNotes.length})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {usedModel && (
                <span className="text-[11px] text-slate-400 px-2">Generated via {usedModel}</span>
              )}
              <button
                type="button"
                onClick={handleGenerateBundle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Regenerate
              </button>
            </div>
          </div>

          {resultTab === 'timetable' ? (
            <div className="space-y-4">
              {/* Save to Study Planner Bar */}
              <div className="rounded-2xl border border-indigo-500/25 bg-white dark:bg-navy-900 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-cyan-500" />
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {generatedTimetable.summary}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {generatedTimetable.totalScheduledHours} study hours scheduled
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveToStudyPlanner}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      savedToPlanner
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                    }`}
                  >
                    {savedToPlanner ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Saved to Study Planner
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" /> Save to Study Planner
                      </>
                    )}
                  </button>
                  {savedToPlanner && onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('planner')}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-navy-800"
                    >
                      Open Planner <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {generatedTimetable.days.map((day, dayIdx) => (
                  <div
                    key={`${day.date}-${dayIdx}`}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-4 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Day {dayIdx + 1} — {day.dayLabel} ({day.date})
                      </div>
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {day.sessions.length} sessions
                      </span>
                    </div>

                    <div className="space-y-2">
                      {day.sessions.map((sess) => {
                        const badgeClass =
                          SESSION_BADGE_CLASS[sess.sessionType] || SESSION_BADGE_CLASS.Study;
                        return (
                          <div
                            key={sess.id}
                            className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                              sess.completed
                                ? 'border-emerald-500/30 bg-emerald-500/10 opacity-80'
                                : 'border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/60'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleGeneratedSession(dayIdx, sess.id)}
                              className="flex items-start gap-2.5 text-left min-w-0 flex-1"
                            >
                              <CheckCircle2
                                className={`h-4 w-4 shrink-0 mt-0.5 ${
                                  sess.completed ? 'text-emerald-500' : 'text-slate-400'
                                }`}
                              />
                              <div className="min-w-0">
                                <div
                                  className={`text-sm font-semibold ${
                                    sess.completed
                                      ? 'line-through text-slate-500'
                                      : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {sess.subjectName}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {sess.startTime} – {sess.endTime} • {sess.focusTip}
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${badgeClass}`}
                              >
                                {sess.sessionType}
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                  sess.priority === 'High'
                                    ? 'bg-rose-500/10 text-rose-500'
                                    : sess.priority === 'Medium'
                                    ? 'bg-amber-500/10 text-amber-500'
                                    : 'bg-sky-500/10 text-sky-500'
                                }`}
                              >
                                {sess.priority}
                              </span>
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                {sess.hours}h
                              </span>
                              <button
                                type="button"
                                onClick={() => deleteGeneratedSession(dayIdx, sess.id)}
                                className="p-1 text-slate-400 hover:text-rose-500"
                                aria-label="Remove session"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Save All Notes Bar */}
              <div className="rounded-2xl border border-indigo-500/25 bg-white dark:bg-navy-900 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Chapter-Wise Study Notes ({generatedNotes.length} topics)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAllNotes}
                    disabled={allNotesSaved}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      allNotesSaved
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                    }`}
                  >
                    {allNotesSaved ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> All Notes Saved to Smart Notes
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" /> Save All to Smart Notes
                      </>
                    )}
                  </button>
                  {Object.keys(savedNoteIds).length > 0 && onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('notes')}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-navy-800"
                    >
                      Open Smart Notes <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {generatedNotes.map((note, idx) => {
                  const isSaved = Boolean(savedNoteIds[note.id]);
                  const isEditing = editingNoteIdx === idx;
                  return (
                    <article
                      key={note.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white">
                              {note.title}
                            </h4>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                              {note.chapter}
                            </span>
                            {note.insufficient_info && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                Needs More Syllabus Detail
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              isEditing ? setEditingNoteIdx(null) : startEditNote(idx, note)
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-navy-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>{isEditing ? 'Cancel' : 'Edit'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveSingleNote(note)}
                            disabled={isSaved}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                              isSaved
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            {isSaved ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                              </>
                            ) : (
                              <>
                                <Save className="h-3.5 w-3.5" /> Save to Smart Notes
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {note.insufficient_info && note.insufficient_note && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300">
                          {note.insufficient_note}
                        </div>
                      )}

                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={noteDraft.title}
                            onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2 text-sm font-semibold"
                          />
                          <textarea
                            rows={10}
                            value={noteDraft.formatted_content}
                            onChange={(e) =>
                              setNoteDraft({ ...noteDraft, formatted_content: e.target.value })
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2.5 text-xs font-mono leading-relaxed"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => saveEditNote(idx)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                            >
                              <Save className="h-3.5 w-3.5" /> Apply Edits
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                          {note.simple_explanation && (
                            <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800/60">
                              <div className="font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                                Simple Explanation
                              </div>
                              <p className="text-slate-700 dark:text-slate-200">
                                {note.simple_explanation}
                              </p>
                            </div>
                          )}

                          {note.definitions?.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800/60">
                              <div className="font-bold text-slate-900 dark:text-white mb-1.5">
                                Important Definitions
                              </div>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                                {note.definitions.map((d, i) => (
                                  <li key={i}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {note.key_concepts?.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800/60">
                              <div className="font-bold text-slate-900 dark:text-white mb-1.5">
                                Key Concepts
                              </div>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                                {note.key_concepts.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {note.formulas?.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800/60">
                              <div className="font-bold text-slate-900 dark:text-white mb-1.5">
                                Important Formulas
                              </div>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 font-mono">
                                {note.formulas.map((f, i) => (
                                  <li key={i}>{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {note.examples?.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800/60">
                              <div className="font-bold text-slate-900 dark:text-white mb-1.5">
                                Examples
                              </div>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                                {note.examples.map((ex, i) => (
                                  <li key={i}>{ex}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {note.exam_questions?.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800/60">
                              <div className="font-bold text-purple-600 dark:text-purple-400 mb-1.5">
                                Important Exam Questions
                              </div>
                              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                                {note.exam_questions.map((q, i) => (
                                  <li key={i}>{q}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {note.quick_revision_points?.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800/60">
                              <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">
                                Quick Revision Points
                              </div>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                                {note.quick_revision_points.map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
