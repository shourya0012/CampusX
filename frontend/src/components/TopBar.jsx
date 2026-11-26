import { Menu, Sun, Moon, Wifi, WifiOff, RefreshCw, LogOut } from 'lucide-react';
import { NAV_ITEMS } from './Sidebar.jsx';

export default function TopBar({
  activePage,
  theme,
  onToggleTheme,
  onOpenMobile,
  healthStatus,
  onRefreshHealth,
  onNavigate,
  onLogout,
}) {
  const currentItem = NAV_ITEMS.find((item) => item.id === activePage) || NAV_ITEMS[0];
  const backendOnline = healthStatus?.status === 'ok';

  return (
    <header className="h-16 sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800/80 bg-white/85 dark:bg-navy-900/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {currentItem.label}
          </h1>
          <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 truncate">
            AI-Powered Student Productivity Workspace
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Backend Connectivity Status Pill */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          title="View backend & API key configuration in Settings"
          className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            backendOnline
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/15'
          }`}
        >
          {backendOnline ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          <span>{backendOnline ? 'API Connected' : 'API Offline'}</span>
        </button>

        <button
          type="button"
          onClick={onRefreshHealth}
          title="Recheck backend health"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          aria-label="Refresh backend connection"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Working Dark/Light Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors text-xs font-semibold"
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-indigo-600" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Sign out of CampusX"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors text-xs font-semibold"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        )}
      </div>
    </header>
  );
}
