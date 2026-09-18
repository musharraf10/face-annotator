import { useState, useEffect, useMemo, useCallback } from 'react'
import { getStoredEmployees, saveStoredEmployees } from '../utils/storage'

export function useEmployees() {
  const [employees, setEmployees] = useState(() => getStoredEmployees())
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    saveStoredEmployees(employees)
  }, [employees])

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q)
    )
  }, [employees, searchQuery])

  /**
   * Add a new employee
   * @param {{ id: string, name: string }} empData
   * @returns {{ success: boolean, error?: string }}
   */
  const addEmployee = useCallback(
    ({ id, name }) => {
      const trimmedId = id.trim().toUpperCase()
      const trimmedName = name.trim()

      if (!trimmedName) {
        return { success: false, error: 'Employee name is required.' }
      }
      if (!trimmedId) {
        return { success: false, error: 'Employee ID is required.' }
      }

      const exists = employees.some(
        (e) => e.id.toLowerCase() === trimmedId.toLowerCase()
      )
      if (exists) {
        return {
          success: false,
          error: `Employee ID "${trimmedId}" already exists.`,
        }
      }

      const newEmp = { id: trimmedId, name: trimmedName }
      setEmployees((prev) => [...prev, newEmp])
      return { success: true, employee: newEmp }
    },
    [employees]
  )

  /**
   * Update an existing employee
   * @param {string} oldId
   * @param {{ id: string, name: string }} empData
   * @returns {{ success: boolean, error?: string }}
   */
  const updateEmployee = useCallback(
    (oldId, { id, name }) => {
      const trimmedId = id.trim().toUpperCase()
      const trimmedName = name.trim()

      if (!trimmedName) {
        return { success: false, error: 'Employee name is required.' }
      }
      if (!trimmedId) {
        return { success: false, error: 'Employee ID is required.' }
      }

      // If ID changed, ensure it is not already taken by another employee
      if (trimmedId.toLowerCase() !== oldId.toLowerCase()) {
        const exists = employees.some(
          (e) =>
            e.id.toLowerCase() === trimmedId.toLowerCase() &&
            e.id.toLowerCase() !== oldId.toLowerCase()
        )
        if (exists) {
          return {
            success: false,
            error: `Employee ID "${trimmedId}" is already in use.`,
          }
        }
      }

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === oldId ? { id: trimmedId, name: trimmedName } : e
        )
      )
      return { success: true }
    },
    [employees]
  )

  /**
   * Delete an employee
   * @param {string} id
   */
  const deleteEmployee = useCallback((id) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return {
    employees,
    filteredEmployees,
    searchQuery,
    setSearchQuery,
    addEmployee,
    updateEmployee,
    deleteEmployee,
  }
}
