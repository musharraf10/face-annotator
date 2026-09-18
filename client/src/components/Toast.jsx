import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'


export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      onClose()
    }, toast.duration || 3000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-sky-400 shrink-0" />,
  }

  const borderColors = {
    success: 'border-emerald-500/30 bg-slate-900/95 text-slate-100',
    error: 'border-rose-500/30 bg-slate-900/95 text-slate-100',
    info: 'border-sky-500/30 bg-slate-900/95 text-slate-100',
  }

  const type = toast.type || 'info'

  return (
    <div className="fixed bottom-14 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
      <div
        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-xl backdrop-blur text-xs font-medium ${
          borderColors[type] || borderColors.info
        }`}
      >
        {icons[type] || icons.info}
        <span className="leading-snug">{toast.message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-slate-400 hover:text-white transition-colors p-0.5"
          aria-label="Dismiss toast"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
