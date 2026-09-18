import { useState } from 'react'
import {
  Search,
  Plus,
  CheckCircle2,
  Circle,
  Edit2,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { EmployeeForm } from './EmployeeForm'
import { ConfirmationModal } from './ConfirmationModal'


export function EmployeePanel({
  employees,
  filteredEmployees,
  searchQuery,
  setSearchQuery,
  placedEmployeeIds = [],
  selectedEmployeeId,
  onSelectEmployee,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  isCollapsed,
  onToggleCollapse,
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [deletingEmployee, setDeletingEmployee] = useState(null)

  const placedCount = placedEmployeeIds.length
  const totalCount = employees.length

  const handleOpenAdd = () => {
    setEditingEmployee(null)
    setFormOpen(true)
  }

  const handleOpenEdit = (emp, e) => {
    e.stopPropagation()
    setEditingEmployee(emp)
    setFormOpen(true)
  }

  const handleOpenDelete = (emp, e) => {
    e.stopPropagation()
    setDeletingEmployee(emp)
  }

  const handleSaveForm = (data) => {
    if (data.oldId) {
      return onUpdateEmployee(data.oldId, { id: data.id, name: data.name })
    } else {
      return onAddEmployee({ id: data.id, name: data.name })
    }
  }

  const handleConfirmDelete = () => {
    if (deletingEmployee) {
      onDeleteEmployee(deletingEmployee.id)
      setDeletingEmployee(null)
    }
  }

  if (isCollapsed) {
    return (
      <div className="w-12 border-r border-slate-800 bg-slate-900/90 flex flex-col items-center py-4 shrink-0 transition-all duration-200">
        <button
          onClick={onToggleCollapse}
          title="Expand Employees Panel"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="mt-4 flex flex-col items-center gap-1 text-[10px] text-slate-400 font-medium">
          <Users className="w-4 h-4 text-blue-400" />
          <span>
            {placedCount}/{totalCount}
          </span>
        </div>

        <button
          onClick={handleOpenAdd}
          title="Add Employee"
          className="mt-4 p-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <aside className="w-72 md:w-80 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0 h-full select-none transition-all duration-200">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-200">
            Employees
          </h2>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {placedCount}/{totalCount} placed
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenAdd}
            title="Add Employee"
            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          <button
            onClick={onToggleCollapse}
            title="Collapse Panel"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-900/50">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee or ID..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Employee List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredEmployees.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            {searchQuery ? (
              <p className="text-xs text-slate-400">
                No employees matching &ldquo;{searchQuery}&rdquo;
              </p>
            ) : (
              <div>
                <p className="text-xs text-slate-400 mb-3">No employees added yet.</p>
                <button
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-all shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Employee
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const isPlaced = placedEmployeeIds.includes(emp.id)
            const isSelected = selectedEmployeeId === emp.id

            return (
              <div
                key={emp.id}
                onClick={() => onSelectEmployee(emp)}
                className={`group relative flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10 text-white shadow-xs'
                    : isPlaced
                    ? 'border-emerald-500/30 bg-slate-900 hover:bg-slate-850 hover:border-emerald-500/50'
                    : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 pr-2">
                  <div className="mt-0.5 shrink-0">
                    {isPlaced ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-100 truncate">
                        {emp.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                      <span className="font-mono text-slate-400 font-medium">
                        {emp.id}
                      </span>
                      <span
                        className={`font-medium ${
                          isPlaced ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        • {isPlaced ? 'Placed' : 'Not placed'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit / Delete actions */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleOpenEdit(emp, e)}
                    title="Edit Employee"
                    className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleOpenDelete(emp, e)}
                    title="Delete Employee"
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add / Edit Form Modal */}
      <EmployeeForm
        key={formOpen ? (editingEmployee?.id || 'new-employee') : 'closed'}
        isOpen={formOpen}
        initialData={editingEmployee}
        onSave={handleSaveForm}
        onClose={() => setFormOpen(false)}
      />


      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deletingEmployee)}
        title="Delete Employee"
        message={`Are you sure you want to delete ${deletingEmployee?.name} (${deletingEmployee?.id})? If this employee is placed on the canvas, their tag will also be removed.`}
        confirmText="Delete"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingEmployee(null)}
      />
    </aside>
  )
}
