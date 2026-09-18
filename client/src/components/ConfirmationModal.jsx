import { AlertTriangle, X } from 'lucide-react'


export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger', // 'danger' | 'primary'
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null

  const confirmBtnStyles =
    confirmVariant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20'
      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${confirmVariant === 'danger' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-100">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-400">{message}</p>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-md transition-all ${confirmBtnStyles}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
