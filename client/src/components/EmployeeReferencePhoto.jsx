import { useEffect, useState } from 'react'
import { ImagePlus, Eye, Trash2, X, Check, LoaderCircle } from 'lucide-react'
import { apiGetEmployeePhoto } from '../utils/api'

export function EmployeeReferencePhoto({ employeeId, hasPhoto, legacyProvider = false, onUpload, onDelete }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isViewing, setIsViewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!previewUrl || !previewUrl.startsWith('blob:')) return undefined
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const chooseFile = (event) => {
    event.stopPropagation()
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (!chosen) return
    if (chosen.size > 10 * 1024 * 1024) {
      setError('Photo must be no larger than 10 MB.')
      return
    }
    setError('')
    setMessage('')
    setIsViewing(false)
    setFile(chosen)
    setPreviewUrl(URL.createObjectURL(chosen))
  }

  const cancelPreview = (event) => {
    event.stopPropagation()
    setFile(null)
    setPreviewUrl('')
  }

  const savePhoto = async (event) => {
    event.stopPropagation()
    if (!file || busy) return
    setBusy(true)
    setError('')
    setMessage('')
    const result = await onUpload(employeeId, file)
    setBusy(false)
    if (!result.success) return setError(result.error || 'Photo upload failed.')
    setFile(null)
    setPreviewUrl('')
    setMessage(result.cleanupPending ? 'Photo saved; old file cleanup will retry on the next photo action.' : 'Reference photo saved.')
  }

  const viewPhoto = async (event) => {
    event.stopPropagation()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const blob = await apiGetEmployeePhoto(employeeId)
      setPreviewUrl(URL.createObjectURL(blob))
      setIsViewing(true)
      setFile(null)
    } catch (err) {
      setError(err.message || 'Photo could not be loaded.')
    } finally {
      setBusy(false)
    }
  }

  const deletePhoto = async (event) => {
    event.stopPropagation()
    if (busy) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    const result = await onDelete(employeeId)
    setBusy(false)
    if (!result.success) return setError(result.error || 'Photo could not be deleted.')
    setPreviewUrl('')
    setIsViewing(false)
    setFile(null)
    setConfirmDelete(false)
    setMessage(result.cleanupPending ? 'Photo removed; private storage cleanup will retry on the next photo action.' : 'Reference photo deleted.')
  }

  const closeViewer = (event) => {
    event.stopPropagation()
    setPreviewUrl('')
    setIsViewing(false)
  }

  return (
    <div className="mt-2" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5">
        {legacyProvider ? <span className="text-[10px] text-amber-300">Legacy S3 photo · migration required</span> : hasPhoto ? <span className="text-[10px] text-emerald-300">Reference photo registered</span> : <span className="text-[10px] text-amber-300">No reference photo</span>}
        {hasPhoto && !legacyProvider && <button type="button" onClick={viewPhoto} disabled={busy} className="inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-1 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"><Eye size={12} /> View</button>}
        {!legacyProvider && !file && <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-700 px-1.5 py-1 text-[10px] text-slate-300 hover:bg-slate-800">
          <ImagePlus size={12} /> {hasPhoto ? 'Replace' : 'Add photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={chooseFile} disabled={busy} />
        </label>}
        {hasPhoto && !legacyProvider && !file && <button type="button" onClick={deletePhoto} disabled={busy} title={confirmDelete ? 'Confirm photo deletion' : 'Delete reference photo'} className="rounded border border-slate-700 p-1 text-slate-400 hover:border-rose-800 hover:text-rose-300 disabled:opacity-50">{confirmDelete ? <span className="px-1 text-[10px] text-rose-300">Confirm delete?</span> : <Trash2 size={12} />}</button>}
        {confirmDelete && <button type="button" onClick={(event) => { event.stopPropagation(); setConfirmDelete(false) }} className="rounded border border-slate-700 px-1.5 py-1 text-[10px] text-slate-300">Cancel</button>}
        {busy && <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><LoaderCircle size={12} className="animate-spin" /> Working…</span>}
      </div>
      {legacyProvider && <p className="mt-1 text-[10px] text-slate-500">The previous storage is not connected. This photo is preserved until its migration is reviewed.</p>}
      {file && <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 p-2">
        <img src={previewUrl} alt="Selected employee reference preview" className="h-12 w-12 rounded object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] text-slate-300">{file.name}</p>
          <p className="text-[10px] text-slate-500">Preview before saving · server limit 5 MB by default</p>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={savePhoto} disabled={busy} className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[10px] text-white disabled:opacity-50"><Check size={11} /> Save photo</button>
            <button type="button" onClick={cancelPreview} disabled={busy} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300"><X size={11} /> Cancel</button>
          </div>
        </div>
      </div>}
      {isViewing && previewUrl && <div className="mt-2 flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-950/80 p-2">
        <img src={previewUrl} alt="Saved employee reference photo" className="max-h-40 max-w-full rounded object-contain" />
        <button type="button" onClick={closeViewer} aria-label="Close photo preview" className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={14} /></button>
      </div>}
      {error && <p role="alert" className="mt-1 text-[10px] text-rose-300">{error}</p>}
      {message && <p role="status" className="mt-1 text-[10px] text-slate-400">{message}</p>}
    </div>
  )
}
