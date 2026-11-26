import {
  LayoutDashboard,
  UserCircle,
  Bot,
  FileSearch,
  CloudSun,
  CheckSquare,
  CalendarClock,
  StickyNote,
  Settings,
  GraduationCap,
  Mic,
  LogOut,
  X,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'voice', label: 'Voice Study Assistant', icon: Mic },
  { id: 'portfolio', label: 'My Portfolio', icon: UserCircle },
  { id: 'chatbot', label: 'AI Chatbot', icon: Bot },
  { id: 'rag', label: 'Document AI / RAG', icon: FileSearch },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'quiz', label: 'MCQ Quiz', icon: CheckSquare },
  { id: 'planner', label: 'Study Planner', icon: CalendarClock },
  { id: 'notes', label: 'Smart Notes', icon: StickyNote },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({
  activePage,
  onNavigate,
  portfolio,
  authUser,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) {
  const displayName = portfolio?.name || authUser?.displayName || 'Student Profile';
  const avatarSrc = portfolio?.avatarUrl || authUser?.photoURL || '';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const handleSelect = (id) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-navy-900 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => handleSelect('dashboard')}
            className="flex items-center gap-3 text-left group"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                CampusX
              </div>
              <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                AI Student Hub
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Sidebar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800/90 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer & Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
          <button
            type="button"
            onClick={() => handleSelect('portfolio')}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-navy-800/70 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200/80 dark:border-slate-700/60 transition-colors text-left"
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-indigo-500/40"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {displayName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {authUser?.email || portfolio?.location || 'View Portfolio'}
              </div>
            </div>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
