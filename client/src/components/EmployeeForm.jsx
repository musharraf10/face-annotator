import { useState } from 'react'
import { User, Hash, X } from 'lucide-react'

export function EmployeeForm({
  isOpen,
  initialData, // { id, name } or null for add
  onSave,
  onClose,
}) {
  const [name, setName] = useState(initialData?.name || '')
  const [id, setId] = useState(initialData?.id || '')
  const [error, setError] = useState('')

  const isEdit = Boolean(initialData)

  if (!isOpen) return null


  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    const trimmedId = id.trim().toUpperCase()

    if (!trimmedName) {
      setError('Employee name is required.')
      return
    }
    if (!trimmedId) {
      setError('Employee ID is required.')
      return
    }

    const result = onSave({
      oldId: initialData?.id,
      name: trimmedName,
      id: trimmedId,
    })

    if (result && !result.success) {
      setError(result.error || 'Failed to save employee.')
      return
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-100">
            {isEdit ? 'Edit Employee' : 'Add Employee'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Employee Name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Kumar"
                autoFocus
                className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Employee ID
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Hash className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. EMP1023"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase transition-all"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-md shadow-blue-900/20 transition-all"
            >
              {isEdit ? 'Update Employee' : 'Save Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
