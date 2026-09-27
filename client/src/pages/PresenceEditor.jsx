import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Calendar,
  Upload,
  Download,
  Layers,
  ChevronDown,
  RotateCcw,
  Award,
} from 'lucide-react'

import { useEmployees } from '../hooks/useEmployees'
import { ImageCanvas } from '../components/ImageCanvas'
import { EmployeePanel } from '../components/EmployeePanel'
import { Toolbar } from '../components/Toolbar'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { PreviewModal } from '../components/PreviewModal'
import { Toast } from '../components/Toast'
import { UserProfileMenu } from '../components/UserProfileMenu'
import { CreditsModal } from '../components/CreditsModal'
import {
  getActiveSessionDate,
  setActiveSessionDate,
  getTodayDateString,
  formatDisplayDate,
  getAllSessions,
  saveSession,
  getSession,
  saveImageToIndexedDB,
  getImageFromIndexedDB,
} from '../utils/storage'
import { apiGetSessions, apiSaveSession } from '../utils/api'
import { exportCanvasAsPNG, generatePreviewDataUrl } from '../utils/exportImage'

export function PresenceEditor({ user, onLogout }) {
  const userId = user?.id || null;

  const {
    employees,
    filteredEmployees,
    searchQuery,
    setSearchQuery,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    syncStatus,
  } = useEmployees(user)

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)

  // Session State
  const [sessionDate, setSessionDate] = useState(() => getActiveSessionDate(userId))
  const [sessionsList, setSessionsList] = useState(() => getAllSessions(userId))
  const [showSessionsDropdown, setShowSessionsDropdown] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)

  // Canvas & Annotation State
  const [imageDataUrl, setImageDataUrl] = useState(null)
  const [imageFileName, setImageFileName] = useState(null)
  const [placedEmployeeIds, setPlacedEmployeeIds] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Undo / Redo History
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoingRedoingRef = useRef(false)

  // Auto-save status & Modals
  const [saveStatus, setSaveStatus] = useState('saved')
  const [newSessionConfirmOpen, setNewSessionConfirmOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'info') => {
    setToast({ message, type, duration: 2800 })
  }

  // Track whether initial load has completed to prevent saving empty state over stored session
  const isSessionLoadedRef = useRef(false)

  // Synchronize past sessions from backend if available
  useEffect(() => {
    if (!userId) return
    apiGetSessions()
      .then((res) => {
        if (res.success && res.sessions) {
          setSessionsList((prev) => ({ ...prev, ...res.sessions }))
        }
      })
      .catch(() => {})
  }, [userId])

  // Load session from storage / IndexedDB on mount or sessionDate change
  useEffect(() => {
    let isMounted = true
    isSessionLoadedRef.current = false

    async function loadCurrentSession() {
      const saved = getSession(userId, sessionDate)
      const cachedImg = await getImageFromIndexedDB(`img_${userId || 'guest'}_${sessionDate}`)

      if (!isMounted) return

      if (cachedImg) {
        setImageDataUrl(cachedImg)
        setImageFileName(saved?.imageMeta?.name || 'group-photo.jpg')
      } else {
        setImageDataUrl(null)
        setImageFileName(null)
      }

      isSessionLoadedRef.current = true

      if (saved?.placedEmployees && Array.isArray(saved.placedEmployees)) {
        setPlacedEmployeeIds(saved.placedEmployees)
      } else if (saved?.annotations && Array.isArray(saved.annotations)) {
        setPlacedEmployeeIds(saved.annotations.map((a) => a.employeeId))
      } else {
        setPlacedEmployeeIds([])
      }

      if (saved?.annotations && saved.annotations.length > 0 && canvasRef.current) {
        setTimeout(() => {
          if (canvasRef.current && isMounted) {
            canvasRef.current.restoreSnapshot(saved.annotations)
          }
        }, 120)
      }
    }

    loadCurrentSession()
    setActiveSessionDate(userId, sessionDate)

    return () => {
      isMounted = false
    }
  }, [sessionDate, userId])

  // Save current work to session (Fast browser storage + MongoDB background sync)
  const saveCurrentSessionWork = useCallback(() => {
    if (!isSessionLoadedRef.current || !canvasRef.current) return
    setSaveStatus('saving')

    const snapshot = canvasRef.current.getSnapshot()
    const placedIds = snapshot.map((s) => s.employeeId)
    setPlacedEmployeeIds(placedIds)

    const sessionData = {
      date: sessionDate,
      placedEmployees: placedIds,
      annotations: snapshot,
      imageMeta: {
        name: imageFileName || 'group-photo.jpg',
        hasImage: Boolean(imageDataUrl),
      },
    }

    saveSession(userId, sessionDate, sessionData)
    setSessionsList(getAllSessions(userId))

    // Background MongoDB sync
    if (userId) {
      apiSaveSession(sessionDate, sessionData).catch(() => {})
    }

    setTimeout(() => {
      setSaveStatus('saved')
    }, 400)
  }, [userId, sessionDate, imageFileName, imageDataUrl])

  // Record history snapshot for Undo / Redo
  const recordHistory = useCallback(() => {
    if (isUndoingRedoingRef.current || !canvasRef.current) return

    const snapshot = canvasRef.current.getSnapshot()
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1)
      next.push(snapshot)
      return next
    })
    setHistoryIndex((prev) => prev + 1)
    saveCurrentSessionWork()
  }, [historyIndex, saveCurrentSessionWork])

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0 || !canvasRef.current) return
    isUndoingRedoingRef.current = true

    const targetIndex = historyIndex - 1
    const targetSnapshot = history[targetIndex] || []

    canvasRef.current.restoreSnapshot(targetSnapshot)
    setPlacedEmployeeIds(targetSnapshot.map((s) => s.employeeId))
    setHistoryIndex(targetIndex)

    setTimeout(() => {
      isUndoingRedoingRef.current = false
      saveCurrentSessionWork()
    }, 50)
  }, [historyIndex, history, saveCurrentSessionWork])

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !canvasRef.current) return
    isUndoingRedoingRef.current = true

    const targetIndex = historyIndex + 1
    const targetSnapshot = history[targetIndex] || []

    canvasRef.current.restoreSnapshot(targetSnapshot)
    setPlacedEmployeeIds(targetSnapshot.map((s) => s.employeeId))
    setHistoryIndex(targetIndex)

    setTimeout(() => {
      isUndoingRedoingRef.current = false
      saveCurrentSessionWork()
    }, 50)
  }, [historyIndex, history, saveCurrentSessionWork])

  // Global Keyboard Shortcuts (Undo, Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          handleRedo()
        } else {
          e.preventDefault()
          handleUndo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // Handle uploaded image
  const handleUploadImage = async (dataUrl, fileName) => {
    setImageDataUrl(dataUrl)
    setImageFileName(fileName)
    await saveImageToIndexedDB(`img_${userId || 'guest'}_${sessionDate}`, dataUrl)
    showToast('Group photo loaded successfully!', 'success')

    const snapshot = canvasRef.current?.getSnapshot() || []
    const placedIds = snapshot.map((s) => s.employeeId)
    const sessionData = {
      date: sessionDate,
      placedEmployees: placedIds,
      annotations: snapshot,
      imageMeta: {
        name: fileName,
        hasImage: true,
      },
    }
    saveSession(userId, sessionDate, sessionData)
    setSessionsList(getAllSessions(userId))
    if (userId) {
      apiSaveSession(sessionDate, sessionData).catch(() => {})
    }
  }

  // Handle employee click in sidebar (add tag or select existing)
  const handleEmployeeClick = (employee) => {
    if (!imageDataUrl) {
      showToast('Please upload an image first before placing employees.', 'info')
      return
    }

    if (canvasRef.current) {
      canvasRef.current.addOrSelectEmployee(employee)
      recordHistory()
    }
  }

  // Employee master data CRUD wrappers
  const handleAddEmployee = async (empData) => {
    const res = await addEmployee(empData)
    if (res.success) {
      showToast(`Employee "${res.employee.name}" added.`, 'success')
    }
    return res
  }

  const handleUpdateEmployee = async (oldId, empData) => {
    const res = await updateEmployee(oldId, empData)
    if (res.success) {
      showToast(`Employee "${empData.name}" updated.`, 'success')
      if (canvasRef.current) {
        canvasRef.current.updateEmployeeTag(oldId, empData)
        recordHistory()
      }
    }
    return res
  }

  const handleDeleteEmployee = async (id) => {
    await deleteEmployee(id)
    if (canvasRef.current) {
      canvasRef.current.removeEmployeeTag(id)
      recordHistory()
    }
    showToast('Employee deleted from master list.', 'info')
  }

  // Clear all annotations from canvas
  const handleClearAllAnnotations = () => {
    if (canvasRef.current) {
      canvasRef.current.clearAllAnnotations()
      setPlacedEmployeeIds([])
      setSelectedEmployeeId(null)
      recordHistory()
      showToast('All annotations cleared for today.', 'info')
    }
  }

  // Delete selected tag from canvas
  const handleDeleteSelected = () => {
    if (selectedEmployeeId && canvasRef.current) {
      const empName = employees.find((e) => e.id === selectedEmployeeId)?.name
      canvasRef.current.removeEmployeeTag(selectedEmployeeId)
      recordHistory()
      showToast(`Removed annotation for ${empName || 'employee'}.`, 'info')
    } else if (canvasRef.current) {
      canvasRef.current.deleteSelected()
      recordHistory()
    }
  }

  // Start a new daily session
  const handleStartNewSession = () => {
    const today = getTodayDateString()
    setSessionDate(today)
    setActiveSessionDate(userId, today)
    setImageDataUrl(null)
    setImageFileName(null)
    setPlacedEmployeeIds([])
    setSelectedEmployeeId(null)
    setHistory([])
    setHistoryIndex(-1)
    if (canvasRef.current) {
      canvasRef.current.clearAllAnnotations()
    }
    setNewSessionConfirmOpen(false)
    showToast(`Started new session for ${formatDisplayDate(today)}.`, 'success')
  }

  // Switch to a past session
  const handleSwitchSession = (dateStr) => {
    setSessionDate(dateStr)
    setActiveSessionDate(userId, dateStr)
    setShowSessionsDropdown(false)
    showToast(`Loaded session: ${formatDisplayDate(dateStr)}`, 'info')
  }

  // Preview final image
  const handleOpenPreview = () => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current.getFabricCanvas()
    const url = generatePreviewDataUrl(canvas)
    if (url) {
      setPreviewUrl(url)
      setPreviewOpen(true)
    }
  }

  // Export PNG
  const handleExportPNG = () => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current.getFabricCanvas()
    const origW = canvasRef.current.getOriginalWidth()

    const ok = exportCanvasAsPNG(canvas, sessionDate, origW)
    if (ok) {
      showToast('Final annotated image exported!', 'success')
    } else {
      showToast('Failed to export image. Please check image permissions.', 'error')
    }
  }

  const sessionEntries = Object.values(sessionsList).sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
  )

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Navigation / Header */}
      <header className="h-13 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0 z-20">
        {/* Brand & Date */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/30">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-tight text-white uppercase">
                Professional Presence
              </h1>
              <p className="text-[10px] text-slate-400 font-medium leading-none">
                Image Annotator
              </p>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Current Session Date with Popover */}
          <div className="relative">
            <button
              onClick={() => setShowSessionsDropdown((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>{formatDisplayDate(sessionDate)}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {/* Recent Sessions Dropdown */}
            {showSessionsDropdown && (
              <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-2 py-1.5 border-b border-slate-800 flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Recent Sessions
                  </span>
                  <button
                    onClick={() => {
                      setShowSessionsDropdown(false)
                      setNewSessionConfirmOpen(true)
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                  >
                    + New
                  </button>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1">
                  {sessionEntries.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500 text-center">
                      No saved past sessions.
                    </div>
                  ) : (
                    sessionEntries.map((sess) => {
                      const isCurrent = sess.date === sessionDate
                      const placedNum = sess.placedEmployees?.length || 0
                      return (
                        <button
                          key={sess.date}
                          onClick={() => handleSwitchSession(sess.date)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-blue-600/15 text-blue-300 font-medium'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>{formatDisplayDate(sess.date)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {placedNum} placed
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {/* Developer Credit Chip in Header */}
          <button
            onClick={() => setCreditsOpen(true)}
            title="Project Developer: Shaik Musharaf (NW0007365)"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700/70 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-slate-400">Dev:</span>
            <span className="text-blue-400 font-semibold text-[11px]">Shaik Musharaf (NW0007365)</span>
          </button>

          {/* New Session Button */}
          <button
            onClick={() => setNewSessionConfirmOpen(true)}
            title="Start a new daily session"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = (ev) => handleUploadImage(ev.target.result, file.name)
                reader.readAsDataURL(file)
              }
            }}
            className="hidden"
          />

          {/* Upload Image Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload group photo"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs font-medium text-slate-200 transition-colors shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Upload Image</span>
            <span className="sm:hidden">Upload</span>
          </button>

          {/* Export PNG Button */}
          <button
            onClick={handleExportPNG}
            disabled={!imageDataUrl}
            title="Export final annotated image as PNG"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-900/30 disabled:opacity-40 disabled:hover:bg-blue-600 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PNG</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* User Profile Menu */}
          <UserProfileMenu
            user={user}
            onLogout={onLogout}
            syncStatus={syncStatus}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Employee Sidebar */}
        <EmployeePanel
          employees={employees}
          filteredEmployees={filteredEmployees}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placedEmployeeIds={placedEmployeeIds}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={handleEmployeeClick}
          onAddEmployee={handleAddEmployee}
          onUpdateEmployee={handleUpdateEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Center Fabric Canvas */}
        <ImageCanvas
          ref={canvasRef}
          imageDataUrl={imageDataUrl}
          onUploadImage={handleUploadImage}
          onAnnotationsChange={(placedIds) => setPlacedEmployeeIds(placedIds)}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={(id) => setSelectedEmployeeId(id)}
          onSaveState={recordHistory}
        />
      </div>

      {/* Bottom Toolbar */}
      <Toolbar
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onResetZoom={() => canvasRef.current?.resetZoom()}
        onFitImage={() => canvasRef.current?.fitImage()}
        onClearAll={handleClearAllAnnotations}
        onDeleteSelected={handleDeleteSelected}
        selectedEmployeeName={
          selectedEmployeeId && placedEmployeeIds.includes(selectedEmployeeId)
            ? employees.find((e) => e.id === selectedEmployeeId)?.name
            : null
        }
        hasImage={Boolean(imageDataUrl)}
        hasAnnotations={placedEmployeeIds.length > 0}
        onPreviewExport={handleOpenPreview}
        saveStatus={saveStatus}
      />

      {/* Final Image Preview Modal */}
      <PreviewModal
        isOpen={previewOpen}
        previewDataUrl={previewUrl}
        onClose={() => setPreviewOpen(false)}
        onExport={() => {
          setPreviewOpen(false)
          handleExportPNG()
        }}
      />

      {/* New Session Confirmation */}
      <ConfirmationModal
        isOpen={newSessionConfirmOpen}
        title="Start New Daily Session"
        message="Starting a new session will reset the current photo and placed annotations for today. Your employee master list will NOT be deleted."
        confirmText="Start New Session"
        confirmVariant="primary"
        onConfirm={handleStartNewSession}
        onCancel={() => setNewSessionConfirmOpen(false)}
      />

      {/* Snappy Notification Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Developer Credits Modal */}
      <CreditsModal isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </div>
  )
}
