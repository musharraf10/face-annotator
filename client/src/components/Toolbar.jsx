import { useState } from 'react'
import {
  Undo2,
  Redo2,
  Trash,
  ZoomIn,
  ZoomOut,
  Maximize,
  Eye,
  Check,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { ConfirmationModal } from './ConfirmationModal'


export function Toolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitImage,
  onClearAll,
  onDeleteSelected,
  selectedEmployeeName,
  hasImage,
  hasAnnotations,
  onPreviewExport,
  saveStatus = 'saved', // 'saved' | 'saving'
}) {
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const handleConfirmClear = () => {
    onClearAll()
    setClearConfirmOpen(false)
  }

  return (
    <footer className="h-12 border-t border-slate-800 bg-slate-900/95 px-4 flex items-center justify-between shrink-0 select-none text-xs text-slate-300">
      {/* Left: History and Management */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Undo</span>
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Redo2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Redo</span>
        </button>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        {/* Selected Employee Name with Delete Icon */}
        {selectedEmployeeName && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <span className="font-semibold text-blue-400 max-w-[160px] truncate">
              {selectedEmployeeName}
            </span>
            <button
              onClick={onDeleteSelected}
              title={`Remove ${selectedEmployeeName}'s annotation (Delete / Backspace)`}
              className="p-1 rounded text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          onClick={() => setClearConfirmOpen(true)}
          disabled={!hasAnnotations}
          title="Clear all employee tags from canvas"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-rose-400 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Trash className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Clear All</span>
        </button>
      </div>

      {/* Center: Zoom and Fit Controls */}
      {hasImage && (
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80">
          <button
            onClick={onZoomOut}
            title="Zoom Out"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onResetZoom}
            title="Reset Zoom (100%)"
            className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            100%
          </button>

          <button
            onClick={onZoomIn}
            title="Zoom In"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-800 mx-0.5" />

          <button
            onClick={onFitImage}
            title="Fit to Screen"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Maximize className="w-3 h-3" />
            <span className="hidden lg:inline">Fit</span>
          </button>
        </div>
      )}

      {/* Right: Auto-save status and Preview Export */}
      <div className="flex items-center gap-3">
        {/* Auto-save status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 select-none">
          {saveStatus === 'saving' ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
              <span className="hidden sm:inline text-sky-400">Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline text-emerald-400">Saved</span>
            </>
          )}
        </div>

        <button
          onClick={onPreviewExport}
          disabled={!hasImage}
          title="Preview final image before export"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-100 font-medium text-xs disabled:opacity-40 disabled:hover:bg-slate-800 shadow-xs transition-all"
        >
          <Eye className="w-3.5 h-3.5 text-blue-400" />
          <span>Preview Export</span>
        </button>
      </div>

      {/* Clear All Confirmation */}
      <ConfirmationModal
        isOpen={clearConfirmOpen}
        title="Clear All Annotations"
        message="Are you sure you want to remove all placed employee annotations from today's photo? Your master employee list will NOT be affected."
        confirmText="Clear Annotations"
        confirmVariant="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </footer>
  )
}
