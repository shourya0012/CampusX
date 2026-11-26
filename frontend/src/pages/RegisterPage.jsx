import { useState } from 'react';
import {
  GraduationCap,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { GoogleLogo } from './LoginPage.jsx';

export default function RegisterPage({ onSwitchToLogin, theme, onToggleTheme }) {
  const { registerWithEmail, signInWithGoogle, isFirebaseConfigured } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please complete all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both password fields.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await registerWithEmail({ fullName, email, password });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle({ rememberMe: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-10 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />

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

      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-7 sm:p-8 shadow-2xl space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            CampusX <span className="text-indigo-500">• AI Student Hub</span>
          </div>
          <h1 className="mt-2.5 text-2xl font-extrabold text-slate-900 dark:text-white">
            Create Student Account
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Keep your personal study planner, notes, and private PDFs isolated to your account.
          </p>
        </div>

        {!isFirebaseConfigured && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
            <div className="font-bold">Firebase Setup Required</div>
            <p className="mt-0.5">
              Add your <code>VITE_FIREBASE_*</code> config values to <code>frontend/.env</code>{' '}
              and restart Vite to create accounts.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs sm:text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={googleLoading || loading}
          className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 hover:bg-slate-50 dark:hover:bg-navy-700/80 text-slate-800 dark:text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
        >
          {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleLogo />}
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center">
          <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
          <span className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            OR
          </span>
          <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
        </div>

        <form onSubmit={handleRegister} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Aarav Sharma"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
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
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
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

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Create Account</span>
          </button>
        </form>

        <div className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
