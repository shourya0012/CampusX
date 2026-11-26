import { useState } from 'react';
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function GoogleLogo() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
      />
    </svg>
  );
}

export default function LoginPage({ onSwitchToRegister, theme, onToggleTheme }) {
  const { signInWithEmail, signInWithGoogle, resetPassword, isFirebaseConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [forgotMode, setForgotMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await signInWithEmail({ email, password, rememberMe });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle({ rememberMe });
    } catch (err) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }
    setError('');
    setResetSuccess('');
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSuccess(
        `Password reset link sent to ${email.trim()}. Check your inbox (and spam folder).`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-10 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
      {/* Subtle SaaS Background Glows */}
      <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />

      {/* Top-right theme toggle */}
      <button
        type="button"
        onClick={onToggleTheme}
        className="fixed top-5 right-5 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/90 dark:bg-navy-900/90 text-xs font-semibold shadow-sm hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        aria-label="Toggle color theme"
      >
        {theme === 'dark' ? (
          <>
            <Sun className="h-4 w-4 text-amber-400" />
            <span>Light</span>
          </>
        ) : (
          <>
            <Moon className="h-4 w-4 text-indigo-600" />
            <span>Dark</span>
          </>
        )}
      </button>

      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-7 sm:p-8 shadow-2xl space-y-6">
        {/* CampusX Logo & Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            CampusX <span className="text-indigo-500">• AI Student Hub</span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-white">
            {forgotMode ? 'Reset Password' : 'Welcome Back'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {forgotMode
              ? 'Enter your account email and we will send a Firebase reset link.'
              : 'Sign in to access your study planner, notes, RAG documents, and AI tutors.'}
          </p>
        </div>

        {!isFirebaseConfigured && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
            <div className="font-bold">Firebase Setup Required</div>
            <p className="mt-0.5">
              Add your <code>VITE_FIREBASE_*</code> config values to <code>frontend/.env</code>{' '}
              and restart Vite to enable Google and Email sign-in.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs sm:text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resetSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{resetSuccess}</span>
          </div>
        )}

        {forgotMode ? (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white text-sm font-semibold shadow-md transition-all"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Send Reset Link</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setError('');
                setResetSuccess('');
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </button>
          </form>
        ) : (
          <>
            {/* Official Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 hover:bg-slate-50 dark:hover:bg-navy-700/80 text-slate-800 dark:text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
            >
              {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleLogo />}
              <span>Continue with Google</span>
            </button>

            {/* OR Divider */}
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
              <span className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                OR
              </span>
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 accent-indigo-600"
                  />
                  <span>Remember Me</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setError('');
                    setResetSuccess('');
                  }}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Sign In</span>
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              New to CampusX?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Create an Account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
