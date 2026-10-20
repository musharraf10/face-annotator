import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGetEmployees, apiAddEmployee, apiUpdateEmployee, apiDeleteEmployee, apiUploadEmployeePhoto, apiDeleteEmployeePhoto } from '../utils/api';

export function useEmployees(user) {
  const userId = user?.id || null;
  // Never render a cached roster until the server confirms this account's branch.
  const [roster, setRoster] = useState({ userId: null, employees: [], status: 'syncing' });
  const [searchQuery, setSearchQuery] = useState('');
  const employees = useMemo(() => roster.userId === userId ? roster.employees : [], [roster, userId]);
  const syncStatus = roster.userId === userId ? roster.status : 'syncing';

  useEffect(() => {
    let cancelled = false;
    apiGetEmployees().then((res) => {
      if (cancelled) return;
      const list = Array.isArray(res.employees) ? res.employees : [];
      setRoster({ userId, employees: list, status: 'synced' });
    }).catch((error) => {
      if (cancelled) return;
      setRoster({ userId, employees: [], status: error.status === 403 ? 'unassigned' : 'offline' });
    });
    return () => { cancelled = true; };
  }, [userId]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => emp.name.toLowerCase().includes(q) || emp.id.toLowerCase().includes(q));
  }, [employees, searchQuery]);

  const addEmployee = useCallback(async ({ id, name }) => {
    const cleanId = id.trim().toUpperCase();
    const cleanName = name.trim();
    if (!cleanId || !cleanName) return { success: false, error: 'Employee ID and name are required.' };
    if (employees.some((employee) => employee.id.toLowerCase() === cleanId.toLowerCase())) {
      return { success: false, error: `Employee ID "${cleanId}" already exists.` };
    }
    try {
      const res = await apiAddEmployee({ id: cleanId, name: cleanName });
      const next = [...employees, res.employee];
      setRoster({ userId, employees: next, status: 'synced' });
      return { success: true, employee: res.employee };
    } catch (error) {
      if (error.status === 403) setRoster({ userId, employees: [], status: 'unassigned' });
      return { success: false, error: error.message };
    }
  }, [employees, userId]);

  const updateEmployee = useCallback(async (oldId, { id, name }) => {
    const cleanId = id.trim().toUpperCase();
    const cleanName = name.trim();
    if (!cleanId || !cleanName) return { success: false, error: 'Employee ID and name are required.' };
    if (employees.some((employee) => employee.id.toLowerCase() === cleanId.toLowerCase() && employee.id.toLowerCase() !== oldId.toLowerCase())) {
      return { success: false, error: `Employee ID "${cleanId}" is already in use.` };
    }
    try {
      const res = await apiUpdateEmployee(oldId, { id: cleanId, name: cleanName });
      const next = employees.map((employee) => employee.id === oldId ? res.employee : employee);
      setRoster({ userId, employees: next, status: 'synced' });
      return { success: true };
    } catch (error) {
      if (error.status === 403) setRoster({ userId, employees: [], status: 'unassigned' });
      return { success: false, error: error.message };
    }
  }, [employees, userId]);

  const deleteEmployee = useCallback(async (id) => {
    try {
      await apiDeleteEmployee(id);
      const next = employees.filter((employee) => employee.id !== id.trim().toUpperCase());
      setRoster({ userId, employees: next, status: 'synced' });
      return { success: true };
    } catch (error) {
      if (error.status === 403) setRoster({ userId, employees: [], status: 'unassigned' });
      return { success: false, error: error.message };
    }
  }, [employees, userId]);

  const uploadEmployeePhoto = useCallback(async (id, file) => {
    try {
      const result = await apiUploadEmployeePhoto(id, file);
      setRoster((current) => ({ ...current, employees: current.employees.map((employee) => employee.id === id ? { ...employee, hasReferencePhoto: true } : employee) }));
      return { success: true, cleanupPending: result.cleanupPending };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const deleteEmployeePhoto = useCallback(async (id) => {
    try {
      const result = await apiDeleteEmployeePhoto(id);
      setRoster((current) => ({ ...current, employees: current.employees.map((employee) => employee.id === id ? { ...employee, hasReferencePhoto: false } : employee) }));
      return { success: true, cleanupPending: result.cleanupPending };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  return { employees, filteredEmployees, searchQuery, setSearchQuery, addEmployee, updateEmployee, deleteEmployee, uploadEmployeePhoto, deleteEmployeePhoto, syncStatus };
}
