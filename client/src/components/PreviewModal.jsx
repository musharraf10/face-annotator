import { Download, ArrowLeft, X } from 'lucide-react'


export function PreviewModal({
  isOpen,
  previewDataUrl,
  onClose,
  onExport,
}) {
  if (!isOpen || !previewDataUrl) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Header bar */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/90 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Edit
          </button>
          <span className="text-xs text-slate-400 border-l border-slate-700 pl-3">
            Final Annotated Preview (no editor guides)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-md shadow-blue-900/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export PNG
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-950/60">
        <div className="max-w-full max-h-full flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-slate-900/40">
          <img
            src={previewDataUrl}
            alt="Annotated Preview"
            className="max-h-[82vh] max-w-full object-contain rounded select-none"
          />
        </div>
      </div>
    </div>
  )
}
