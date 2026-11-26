import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  CloudSun,
  FileSearch,
  Sparkles,
  StickyNote,
  UserCircle,
  AlertCircle,
  Mic,
} from 'lucide-react';

export default function DashboardPage({
  portfolio,
  notes,
  quizResult,
  studyTasksCount,
  ragDocsCount,
  healthStatus,
  onNavigate,
}) {
  const firstName = (portfolio?.name || 'Student').split(' ')[0];

  const featureCards = [
    {
      id: 'voice',
      title: 'Voice Study Assistant',
      tag: 'Voice AI',
      description: 'Speak about your exam and auto-generate a study timetable plus chapter-wise notes.',
      icon: Mic,
      accent: 'from-rose-500 to-indigo-600',
      actionLabel: 'Open Voice Assistant',
    },
    {
      id: 'portfolio',
      title: 'AI Personal Portfolio',
      tag: 'Profile',
      description: 'Showcase bio, education, technical skills, projects, and edit profile live.',
      icon: UserCircle,
      accent: 'from-indigo-500 to-blue-500',
      actionLabel: 'Open Portfolio',
    },
    {
      id: 'quiz',
      title: 'Prompt Eng MCQ Quiz',
      tag: 'Assessment',
      description: '5 interactive questions with scoring, answer review, and dark/light mode.',
      icon: CheckSquare,
      accent: 'from-purple-500 to-pink-500',
      actionLabel: 'Take Quiz',
    },
    {
      id: 'planner',
      title: 'AI Study Planner',
      tag: 'Productivity',
      description: 'Generate a deadline-aware daily study schedule from your subjects and hours.',
      icon: CalendarClock,
      accent: 'from-cyan-500 to-teal-500',
      actionLabel: 'Plan Schedule',
    },
    {
      id: 'notes',
      title: 'Smart Notes',
      tag: 'Notes',
      description: 'Create, search, tag, pin, and save study notes locally in your browser.',
      icon: StickyNote,
      accent: 'from-amber-500 to-orange-500',
      actionLabel: 'Manage Notes',
    },
    {
      id: 'weather',
      title: 'Live Weather Widget',
      tag: 'Live Data',
      description: 'City weather search with humidity, wind speed, icon, and error handling.',
      icon: CloudSun,
      accent: 'from-sky-500 to-indigo-500',
      actionLabel: 'Check Weather',
    },
    {
      id: 'chatbot',
      title: 'Gemini Study Chatbot',
      tag: 'AI Tutor',
      description: 'Conversational AI tutor with adjustable temperature slider (0.1 to 1.0).',
      icon: Bot,
      accent: 'from-violet-500 to-purple-600',
      actionLabel: 'Start Chat',
    },
    {
      id: 'rag',
      title: 'Document AI / RAG',
      tag: 'Document AI',
      description: 'Upload PDFs, chunk & embed with ChromaDB, and ask grounded questions with citations.',
      icon: FileSearch,
      accent: 'from-emerald-500 to-cyan-500',
      actionLabel: 'Open RAG Studio',
    },
  ];

  const backendReady = healthStatus?.status === 'ok';
  const geminiReady = healthStatus?.integrations?.gemini_configured;
  const weatherReady = healthStatus?.integrations?.weather_configured;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-navy-900 via-navy-800 to-indigo-950 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-indigo-200 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              <span>All-in-One AI Student Productivity Suite</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {firstName}!
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
              Your all-in-one AI Student Hub is ready. Manage your portfolio, revise with Smart
              Notes and the Study Planner, test your Prompt Engineering skills, or query uploaded
              PDFs with ChromaDB RAG.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('voice')}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-rose-500/25 transition-all"
            >
              <Mic className="h-4 w-4" />
              <span>Voice Study Assistant</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('rag')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all"
            >
              <FileSearch className="h-4 w-4" />
              <span>Ask Your PDFs</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('chatbot')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-sm font-semibold transition-all"
            >
              <Bot className="h-4 w-4" />
              <span>Open AI Tutor</span>
            </button>
          </div>
        </div>
      </section>

      {/* Productivity Overview KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Smart Notes
            </span>
            <StickyNote className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {notes.length}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Saved in browser localStorage
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Latest Quiz Score
            </span>
            <CheckSquare className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {quizResult ? `${quizResult.score} / ${quizResult.total}` : 'Not Attempted'}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {quizResult ? `${quizResult.percentage}% accuracy` : '5 Prompt Eng MCQs waiting'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Study Sessions
            </span>
            <CalendarClock className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {studyTasksCount}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Scheduled blocks in Study Planner
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Indexed PDFs (RAG)
            </span>
            <FileSearch className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {ragDocsCount}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Stored in ChromaDB vector store
          </p>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Workspace Modules
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Click any module to launch
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm hover:shadow-lg hover:border-indigo-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`h-10 w-10 rounded-xl bg-gradient-to-br ${card.accent} flex items-center justify-center text-white shadow-md`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                      {card.tag}
                    </span>
                  </div>
                  <h4 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                    {card.title}
                  </h4>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate(card.id)}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform"
                >
                  <span>{card.actionLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Row: Recent Notes & System Readiness */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Smart Notes
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('notes')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View All
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No notes yet. Create your first study note in Smart Notes.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.slice(0, 3).map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onNavigate('notes')}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/60 hover:border-indigo-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {note.title}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                      {note.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {note.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Backend & API Readiness
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Configure
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                label: 'FastAPI Backend Server',
                ready: backendReady,
                detail: backendReady
                  ? 'Healthy and responding on /api/health'
                  : 'Start uvicorn in backend/ to enable Weather, Chat, and RAG',
              },
              {
                label: 'Google Gemini API Key (Chatbot & RAG Generation)',
                ready: geminiReady,
                detail: geminiReady
                  ? `Configured (${healthStatus?.integrations?.gemini_model})`
                  : 'Set GEMINI_API_KEY in backend/.env to enable AI answers',
              },
              {
                label: 'Live Weather Service (WeatherAPI)',
                ready: weatherReady,
                detail: weatherReady
                  ? 'Configured via backend WeatherAPI integration'
                  : 'Set WEATHERAPI_API_KEY in backend environment variables',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-navy-800/60 border border-slate-200/80 dark:border-slate-800"
              >
                {item.ready ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
