import { useState } from 'react';
import {
  Layers,
  LogIn,
  UserPlus,
  Lock,
  Mail,
  User,
  CheckCircle2,
  Clock,
  Award,
  AlertCircle,
  Database,
  ArrowRight,
} from 'lucide-react';
import { apiLogin, apiRegister } from '../utils/api';
import { saveAuthSession } from '../utils/storage';
import { CreditsModal } from '../components/CreditsModal';

export function AuthPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true); // 14-day persistent login
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creditsOpen, setCreditsOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please provide your email/username and password.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    setLoading(true);

    try {
      let res;
      if (mode === 'register') {
        res = await apiRegister({ name, email, password });
      } else {
        res = await apiLogin({ email, password });
      }

      if (res.token && res.user) {
        // Save session with 14-day expiry
        saveAuthSession(res.token, res.user, res.expiresAt);
        onLoginSuccess(res.user);
      } else {
        setError('Authentication succeeded, but invalid response received.');
      }
    } catch (err) {
      // If server or MongoDB is offline, provide graceful offline fallback login
      if (err.isOffline) {
        console.warn('Backend server offline. Activating fast local profile session.');
        const fallbackUser = {
          id: `local_${btoa(email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`,
          name: name.trim() || email.split('@')[0],
          email: email.trim().toLowerCase(),
        };
        const localExpiry = Date.now() + 14 * 24 * 60 * 60 * 1000;
        saveAuthSession(`local_token_${Date.now()}`, fallbackUser, localExpiry);
        onLoginSuccess(fallbackUser);
        return;
      }

      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-between text-slate-100 font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/70 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-tight text-white uppercase">
              Professional Presence
            </h1>
            <p className="text-[10px] text-slate-400 font-medium leading-none">
              Image Annotator & Presence Suite
            </p>
          </div>
        </div>

        {/* Developer Credit Chip in Header */}
        <button
          onClick={() => setCreditsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition-all shadow-xs"
        >
          <Award className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Developer:</span>
          <span className="font-semibold text-blue-400">Shaik Musharaf (NW0007365)</span>
        </button>
      </header>

      {/* Main Authentication Card */}
      <div className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">
          {/* Card Title & Description */}
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {mode === 'login' ? 'Sign in to your Profile' : 'Create your Profile'}
            </h2>
            <p className="text-xs text-slate-400 mt-1.5">
              {mode === 'login'
                ? 'Access your personalized employee roster and annotation sessions'
                : 'Your profile starts with an empty employee roster ready for your team'}
            </p>
          </div>

          {/* Toggle between Login and Register */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${mode === 'login'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${mode === 'register'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Profile</span>
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Shaik Musharaf"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email / Profile Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. employee@company.com or NW0007365"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* 14-Day Session Persistence Checkbox */}
            <div className="pt-1 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={stayLoggedIn}
                  onChange={(e) => setStayLoggedIn(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  <span>Keep me logged in for 14 days</span>
                  <Clock className="w-3 h-3 text-blue-400" />
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Workspace' : 'Create Profile & Start'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-3 border-t border-slate-900 bg-slate-950/80 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 z-10">
        <div>
          Professional Presence Image Annotator &copy; 2026
        </div>
        <div className="flex items-center gap-1">
          <span>Developed with passion by</span>
          <button
            onClick={() => setCreditsOpen(true)}
            className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2"
          >
            Shaik Musharaf (NW0007365)
          </button>
        </div>
      </footer>

      <CreditsModal isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </div>
  );
}