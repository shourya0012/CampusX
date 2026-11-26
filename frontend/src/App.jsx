import { useState, useEffect, useCallback } from 'react';
import { Loader2, GraduationCap } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Sidebar, { NAV_ITEMS } from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PortfolioPage from './pages/PortfolioPage.jsx';
import QuizPage from './pages/QuizPage.jsx';
import NotesPage from './pages/NotesPage.jsx';
import StudyPlannerPage from './pages/StudyPlannerPage.jsx';
import VoiceStudyPage from './pages/VoiceStudyPage.jsx';
import WeatherPage from './pages/WeatherPage.jsx';
import ChatbotPage from './pages/ChatbotPage.jsx';
import RagPage from './pages/RagPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import {
  DEFAULT_PORTFOLIO,
  DEFAULT_NOTES,
  DEFAULT_STUDY_SUBJECTS,
} from './data/defaultData.js';
import { checkHealth, listRagDocuments } from './services/api.js';

const THEME_KEY = 'campusx_theme';

function userStorageKey(uid, suffix) {
  return `campusx_u_${uid}_${suffix}`;
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeNotes(rawNotes) {
  if (!Array.isArray(rawNotes)) return DEFAULT_NOTES;
  return rawNotes.map((note) => {
    if (note.id === 'note-1' && note.title === 'Module 3: Prompt Engineering Patterns') {
      return { ...note, title: 'Prompt Engineering Patterns' };
    }
    if (note.id === 'note-2' && note.title === 'Module 4: 7-Stage RAG Checklist') {
      return {
        ...note,
        title: '7-Stage RAG Architecture Checklist',
        content: note.content.replace('OpenAI grounded prompt', 'Gemini grounded prompt'),
      };
    }
    return note;
  });
}

function defaultStudyPlan() {
  return {
    subjects: DEFAULT_STUDY_SUBJECTS,
    dailyHours: 3,
    schedule: { days: [], unallocatedHours: 0, totalScheduledHours: 0 },
  };
}

function loadUserWorkspaceData(authUser) {
  const uid = authUser.uid;
  const pKey = userStorageKey(uid, 'portfolio_v1');
  const nKey = userStorageKey(uid, 'notes_v1');
  const qKey = userStorageKey(uid, 'quiz_result_v1');
  const sKey = userStorageKey(uid, 'study_plan_v1');

  // Preserve pre-auth local data once for the first user signing in on this browser
  const legacyMigratedFlag = 'campusx_legacy_migrated_uid';
  const migratedTo = localStorage.getItem(legacyMigratedFlag);
  if (!migratedTo && !localStorage.getItem(pKey)) {
    const legacyNotes = localStorage.getItem('campusx_notes_v1');
    const legacyPlan = localStorage.getItem('campusx_study_plan_v1');
    const legacyPortfolio = localStorage.getItem('campusx_portfolio_v1');
    const legacyQuiz = localStorage.getItem('campusx_quiz_result_v1');
    if (legacyNotes) localStorage.setItem(nKey, legacyNotes);
    if (legacyPlan) localStorage.setItem(sKey, legacyPlan);
    if (legacyPortfolio) localStorage.setItem(pKey, legacyPortfolio);
    if (legacyQuiz) localStorage.setItem(qKey, legacyQuiz);
    if (legacyNotes || legacyPlan || legacyPortfolio || legacyQuiz) {
      localStorage.setItem(legacyMigratedFlag, uid);
    }
  }

  const hasRealDisplayName = Boolean(
    authUser.displayName && authUser.displayName !== authUser.email
  );
  const seededPortfolio = {
    ...DEFAULT_PORTFOLIO,
    name: hasRealDisplayName ? authUser.displayName : authUser.email || DEFAULT_PORTFOLIO.name,
    email: authUser.email || DEFAULT_PORTFOLIO.email,
    avatarUrl: authUser.photoURL || DEFAULT_PORTFOLIO.avatarUrl,
  };

  let loadedPortfolio = readStorage(pKey, seededPortfolio);
  if (
    loadedPortfolio &&
    loadedPortfolio.name === DEFAULT_PORTFOLIO.name &&
    hasRealDisplayName
  ) {
    loadedPortfolio = {
      ...loadedPortfolio,
      name: authUser.displayName,
      email: authUser.email || loadedPortfolio.email,
      avatarUrl: authUser.photoURL || loadedPortfolio.avatarUrl,
    };
    localStorage.setItem(pKey, JSON.stringify(loadedPortfolio));
  }

  return {
    portfolio: loadedPortfolio,
    notes: normalizeNotes(readStorage(nKey, DEFAULT_NOTES)),
    quizResult: readStorage(qKey, null),
    studyPlan: readStorage(sKey, defaultStudyPlan()),
  };
}

const VALID_APP_PAGES = new Set(NAV_ITEMS.map((item) => item.id));

function CampusXShell() {
  const { user, authLoading, logout } = useAuth();

  const [authScreen, setAuthScreen] = useState(() =>
    window.location.pathname === '/register' ? 'register' : 'login'
  );
  const [activePage, setActivePage] = useState(() => {
    const pathPart = window.location.pathname.replace(/^\/+/, '');
    return VALID_APP_PAGES.has(pathPart) ? pathPart : 'dashboard';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  const [portfolio, setPortfolio] = useState(DEFAULT_PORTFOLIO);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [quizResult, setQuizResult] = useState(null);
  const [studyPlan, setStudyPlan] = useState(defaultStudyPlan);

  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [ragDocuments, setRagDocuments] = useState([]);

  // Persist theme in localStorage & apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const status = await checkHealth();
      setHealthStatus(status);
    } catch {
      setHealthStatus({ status: 'offline', integrations: {} });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const refreshRagDocuments = useCallback(async () => {
    if (!user) {
      setRagDocuments([]);
      return;
    }
    try {
      const data = await listRagDocuments();
      setRagDocuments(data.documents || []);
    } catch {
      setRagDocuments([]);
    }
  }, [user]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshHealth(), refreshRagDocuments()]);
  }, [refreshHealth, refreshRagDocuments]);

  // Synchronize URL paths cleanly and protect private routes
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const targetPath = authScreen === 'register' ? '/register' : '/login';
      if (window.location.pathname !== targetPath) {
        window.history.replaceState(null, '', targetPath);
      }
      return;
    }
    if (window.location.pathname === '/login' || window.location.pathname === '/register' || window.location.pathname === '/') {
      window.history.replaceState(null, '', `/${activePage}`);
    }
  }, [user, authLoading, authScreen, activePage]);

  // Load user-scoped workspace data on login, clear in-memory private state on logout
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPortfolio(DEFAULT_PORTFOLIO);
      setNotes(DEFAULT_NOTES);
      setQuizResult(null);
      setStudyPlan(defaultStudyPlan());
      setRagDocuments([]);
      refreshHealth();
      return;
    }

    const loaded = loadUserWorkspaceData(user);
    setPortfolio(loaded.portfolio);
    setNotes(loaded.notes);
    setQuizResult(loaded.quizResult);
    setStudyPlan(loaded.studyPlan);
    refreshAll();
  }, [user, authLoading, refreshAll, refreshHealth]);

  const handleNavigate = (pageId) => {
    setActivePage(pageId);
    if (user) {
      window.history.replaceState(null, '', `/${pageId}`);
    }
  };

  const handleSavePortfolio = (updated) => {
    setPortfolio(updated);
    if (user) {
      localStorage.setItem(userStorageKey(user.uid, 'portfolio_v1'), JSON.stringify(updated));
    }
  };

  const handleResetPortfolio = () => {
    const resetVal = {
      ...DEFAULT_PORTFOLIO,
      name: user?.displayName || DEFAULT_PORTFOLIO.name,
      email: user?.email || DEFAULT_PORTFOLIO.email,
      avatarUrl: user?.photoURL || DEFAULT_PORTFOLIO.avatarUrl,
    };
    setPortfolio(resetVal);
    if (user) {
      localStorage.setItem(userStorageKey(user.uid, 'portfolio_v1'), JSON.stringify(resetVal));
    }
  };

  const handleSaveNotes = (updated) => {
    setNotes(updated);
    if (user) {
      localStorage.setItem(userStorageKey(user.uid, 'notes_v1'), JSON.stringify(updated));
    }
  };

  const handleCompleteQuiz = (result) => {
    setQuizResult(result);
    if (user) {
      localStorage.setItem(userStorageKey(user.uid, 'quiz_result_v1'), JSON.stringify(result));
    }
  };

  const handleSaveStudyPlan = (updated) => {
    setStudyPlan(updated);
    if (user) {
      localStorage.setItem(userStorageKey(user.uid, 'study_plan_v1'), JSON.stringify(updated));
    }
  };

  const handleClearLocalData = () => {
    handleResetPortfolio();
    setNotes(DEFAULT_NOTES);
    setQuizResult(null);
    const defaultPlan = defaultStudyPlan();
    setStudyPlan(defaultPlan);
    if (user) {
      localStorage.removeItem(userStorageKey(user.uid, 'portfolio_v1'));
      localStorage.removeItem(userStorageKey(user.uid, 'notes_v1'));
      localStorage.removeItem(userStorageKey(user.uid, 'quiz_result_v1'));
      localStorage.removeItem(userStorageKey(user.uid, 'study_plan_v1'));
    }
  };

  const handleLogout = async () => {
    await logout();
    setAuthScreen('login');
    setActivePage('dashboard');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          <span>Checking CampusX session...</span>
        </div>
      </div>
    );
  }

  // Protected route gate: unauthenticated users only see Login or Register
  if (!user) {
    if (authScreen === 'register') {
      return (
        <RegisterPage
          onSwitchToLogin={() => setAuthScreen('login')}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />
      );
    }
    return (
      <LoginPage
        onSwitchToRegister={() => setAuthScreen('register')}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  const studyTasksCount = (studyPlan?.schedule?.days || []).reduce(
    (sum, d) => sum + (d.sessions?.length || 0),
    0
  );

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            portfolio={portfolio}
            notes={notes}
            quizResult={quizResult}
            studyTasksCount={studyTasksCount}
            ragDocsCount={ragDocuments.length}
            healthStatus={healthStatus}
            onNavigate={handleNavigate}
          />
        );
      case 'portfolio':
        return (
          <PortfolioPage
            portfolio={portfolio}
            onSavePortfolio={handleSavePortfolio}
            onResetPortfolio={handleResetPortfolio}
          />
        );
      case 'quiz':
        return <QuizPage lastResult={quizResult} onCompleteQuiz={handleCompleteQuiz} />;
      case 'notes':
        return <NotesPage notes={notes} onSaveNotes={handleSaveNotes} />;
      case 'voice':
        return (
          <VoiceStudyPage
            studyPlan={studyPlan}
            onSaveStudyPlan={handleSaveStudyPlan}
            notes={notes}
            onSaveNotes={handleSaveNotes}
            healthStatus={healthStatus}
            onNavigate={handleNavigate}
          />
        );
      case 'planner':
        return (
          <StudyPlannerPage
            studyPlan={studyPlan}
            onSaveStudyPlan={handleSaveStudyPlan}
            onNavigate={handleNavigate}
          />
        );
      case 'weather':
        return <WeatherPage />;
      case 'chatbot':
        return <ChatbotPage healthStatus={healthStatus} />;
      case 'rag':
        return (
          <RagPage
            documents={ragDocuments}
            onDocumentsChange={refreshRagDocuments}
            healthStatus={healthStatus}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            healthStatus={healthStatus}
            healthLoading={healthLoading}
            onRefreshHealth={refreshAll}
            onClearLocalData={handleClearLocalData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        portfolio={portfolio}
        authUser={user}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activePage={activePage}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onOpenMobile={() => setMobileOpen(true)}
          healthStatus={healthStatus}
          onRefreshHealth={refreshAll}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CampusXShell />
    </AuthProvider>
  );
}
