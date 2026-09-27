import { X, Award, Code, Heart, Sparkles, CheckCircle2 } from 'lucide-react';

export function CreditsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl p-6 text-slate-100 animate-in zoom-in-95 duration-200 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-indigo-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-blue-400">
              Project Developer
            </span>
            <h3 className="text-lg font-bold text-white leading-tight">
              Shaik Musharaf
            </h3>
            <span className="inline-block px-2 py-0.5 mt-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono text-[11px] font-semibold">
              NW0007365
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3.5 text-xs text-slate-300">
          <p className="leading-relaxed text-slate-300 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/50">
            <strong>Professional Presence Image Annotator</strong> is engineered and designed by{' '}
            <span className="text-white font-medium">Shaik Musharaf (NW0007365)</span> to streamline corporate team photo labeling, face tagging, and high-resolution presence exports with MongoDB integration and instantaneous local browser caching.
          </p>

          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Key Contributions</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-400 pl-1">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Fabric.js interactive multi-point tagging & callout lines</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Personalized profile system & 14-day persistent sessions</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Dual-tier MongoDB & instant browser storage caching</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Lossless full-resolution composite PNG rendering</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>Crafted with dedication</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-900/30 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
