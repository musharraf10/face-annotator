import { useState, useRef, useEffect } from 'react';
import {
  User,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Database,
  Award,
  Clock,
} from 'lucide-react';
import { CreditsModal } from './CreditsModal';

export function UserProfileMenu({ user, onLogout, syncStatus = 'synced' }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const dbStatusLabel = {
    synced: { text: 'MongoDB Synced', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    syncing: { text: 'Syncing to DB...', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
    offline: { text: 'Local DB Storage', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  }[syncStatus] || { text: 'DB Ready', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile Chip / Trigger */}
      <button
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors shadow-xs"
        title="View user profile & session details"
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
          {getInitials(user?.name)}
        </div>
        <span className="max-w-[110px] truncate text-slate-100 font-medium">
          {user?.name || 'User'}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {/* Profile Dropdown */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95">
          {/* User Info Header */}
          <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-800 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-blue-600/30">
                {getInitials(user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs text-white truncate">
                  {user?.name || 'Logged In User'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  {user?.email || 'user@company.com'}
                </p>
              </div>
            </div>

            {/* 14-day persistent badge */}
            <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3 text-blue-400" />
                <span>14-day persistent login</span>
              </span>
              <span className="font-medium text-emerald-400">Active</span>
            </div>

            {/* Database sync badge */}
            <div className="mt-1.5 flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-slate-400">
                <Database className="w-3 h-3 text-indigo-400" />
                <span>Database</span>
              </span>
              <span className={`px-1.5 py-0.2 rounded border font-medium ${dbStatusLabel.color}`}>
                {dbStatusLabel.text}
              </span>
            </div>
          </div>

          {/* Developer Credits Trigger */}
          <button
            onClick={() => {
              setDropdownOpen(false);
              setCreditsOpen(true);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <div className="flex flex-col text-left">
              <span>Developer Credits</span>
              <span className="text-[10px] text-slate-400">
                Shaik Musharaf (NW0007365)
              </span>
            </div>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          {/* Logout Action */}
          <button
            onClick={() => {
              setDropdownOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Credits Modal */}
      <CreditsModal isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </div>
  );
}
