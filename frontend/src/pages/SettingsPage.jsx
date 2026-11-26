import { Sun, Moon, Server, KeyRound, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function SettingsPage({
  theme,
  onToggleTheme,
  healthStatus,
  healthLoading,
  onRefreshHealth,
  onClearLocalData,
}) {
  const integrations = healthStatus?.integrations || {};
  const isOnline = healthStatus?.status === 'ok';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Workspace Settings & Diagnostics
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage appearance, verify FastAPI backend integrations, and reset local browser data.
        </p>
      </div>

      {/* Appearance */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          Theme Appearance
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Your selected theme is persisted automatically in browser localStorage.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => theme !== 'dark' && onToggleTheme()}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              theme === 'dark'
                ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Moon className="h-4 w-4" />
            Dark Navy Mode
          </button>
          <button
            type="button"
            onClick={() => theme !== 'light' && onToggleTheme()}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              theme === 'light'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Sun className="h-4 w-4" />
            Light Mode
          </button>
        </div>
      </section>

      {/* Backend Diagnostics */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Python Backend & API Key Status
            </h3>
          </div>
          <button
            type="button"
            onClick={onRefreshHealth}
            disabled={healthLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
            Recheck
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800/70 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                FastAPI Server
              </span>
              {isOnline ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800/70 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Firebase Auth
              </span>
              <KeyRound
                className={`h-4 w-4 ${
                  integrations.firebase_auth_configured ? 'text-emerald-500' : 'text-amber-500'
                }`}
              />
            </div>
            <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
              {integrations.firebase_auth_configured ? 'Configured' : 'Not Set'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800/70 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Gemini Key
              </span>
              <KeyRound
                className={`h-4 w-4 ${
                  integrations.gemini_configured ? 'text-emerald-500' : 'text-amber-500'
                }`}
              />
            </div>
            <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
              {integrations.gemini_configured ? 'Configured' : 'Not Set'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800/70 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Weather API
              </span>
              <KeyRound
                className={`h-4 w-4 ${
                  isOnline ? 'text-emerald-500' : 'text-amber-500'
                }`}
              />
            </div>
            <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
              {isOnline ? 'Open-Meteo Ready' : 'Offline'}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
          <div className="font-semibold text-indigo-600 dark:text-indigo-400">
            Security Notice for API Keys
          </div>
          <p>
            API keys are never stored in React or browser localStorage. Live weather via Open-Meteo
            requires no API key; to enable live Google Gemini responses, copy{' '}
            <code>backend/.env.example</code> to <code>backend/.env</code>, add{' '}
            <code>GEMINI_API_KEY</code>, and restart the FastAPI server.
          </p>
        </div>
      </section>

      {/* Local Data Reset */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          Browser Storage Management
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Reset your locally stored Portfolio edits, Smart Notes, Quiz history, and Study Plan back
          to defaults.
        </p>
        <button
          type="button"
          onClick={onClearLocalData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-semibold hover:bg-rose-500/20 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Reset All Local Workspace Data
        </button>
      </section>
    </div>
  );
}
