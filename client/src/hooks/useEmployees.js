import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getStoredEmployees, saveStoredEmployees } from '../utils/storage';
import {
  apiGetEmployees,
  apiAddEmployee,
  apiUpdateEmployee,
  apiDeleteEmployee,
  apiSyncEmployees,
} from '../utils/api';

export function useEmployees(user) {
  const userId = user?.id || null;

  // Immediately initialize state from fast browser storage (0ms UI lag)
  const [employees, setEmployees] = useState(() => getStoredEmployees(userId));
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'offline'
  const isInitialMount = useRef(true);

  // When user changes (e.g. login/switch profile), reload from browser storage
  useEffect(() => {
    const local = getStoredEmployees(userId);
    setEmployees(local);
  }, [userId]);

  // Synchronize state back into fast browser storage whenever employees change
  useEffect(() => {
    saveStoredEmployees(userId, employees);
  }, [userId, employees]);

  // Fetch from MongoDB backend on mount/login and synchronize with local storage
  useEffect(() => {
    let isCancelled = false;

    async function syncWithBackend() {
      if (!userId) return;

      try {
        setSyncStatus('syncing');
        const res = await apiGetEmployees();

        if (isCancelled) return;

        if (res.success && Array.isArray(res.employees)) {
          const serverList = res.employees;
          const localList = getStoredEmployees(userId);

          // If server has data, make it authoritative and update local
          if (serverList.length > 0) {
            setEmployees(serverList);
            saveStoredEmployees(userId, serverList);
          } else if (localList.length > 0) {
            // If local has items but server is empty, sync local items up to MongoDB
            try {
              await apiSyncEmployees(localList);
            } catch (err) {
              console.warn('Sync to MongoDB pending:', err);
            }
          }
          setSyncStatus('synced');
        }
      } catch (err) {
        if (!isCancelled) {
          // If server is offline, continue using fast local browser storage
          setSyncStatus('offline');
        }
      }
    }

    syncWithBackend();

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  /**
   * Add a new employee
   * Instant local update + asynchronous MongoDB sync
   */
  const addEmployee = useCallback(
    async ({ id, name }) => {
      const trimmedId = id.trim().toUpperCase();
      const trimmedName = name.trim();

      if (!trimmedName) {
        return { success: false, error: 'Employee name is required.' };
      }
      if (!trimmedId) {
        return { success: false, error: 'Employee ID is required.' };
      }

      const exists = employees.some(
        (e) => e.id.toLowerCase() === trimmedId.toLowerCase()
      );
      if (exists) {
        return {
          success: false,
          error: `Employee ID "${trimmedId}" already exists.`,
        };
      }

      const newEmp = { id: trimmedId, name: trimmedName };

      // 1. Instant local update for fast responsiveness
      setEmployees((prev) => [...prev, newEmp]);

      // 2. Async background sync to MongoDB
      if (userId) {
        try {
          await apiAddEmployee(newEmp);
          setSyncStatus('synced');
        } catch (err) {
          console.warn('MongoDB sync deferred (saved locally):', err);
          setSyncStatus('offline');
        }
      }

      return { success: true, employee: newEmp };
    },
    [employees, userId]
  );

  /**
   * Update an existing employee
   * Instant local update + asynchronous MongoDB sync
   */
  const updateEmployee = useCallback(
    async (oldId, { id, name }) => {
      const trimmedId = id.trim().toUpperCase();
      const trimmedName = name.trim();

      if (!trimmedName) {
        return { success: false, error: 'Employee name is required.' };
      }
      if (!trimmedId) {
        return { success: false, error: 'Employee ID is required.' };
      }

      if (trimmedId.toLowerCase() !== oldId.toLowerCase()) {
        const exists = employees.some(
          (e) =>
            e.id.toLowerCase() === trimmedId.toLowerCase() &&
            e.id.toLowerCase() !== oldId.toLowerCase()
        );
        if (exists) {
          return {
            success: false,
            error: `Employee ID "${trimmedId}" is already in use.`,
          };
        }
      }

      const updated = { id: trimmedId, name: trimmedName };

      // 1. Instant local update
      setEmployees((prev) =>
        prev.map((e) => (e.id === oldId ? updated : e))
      );

      // 2. Async background sync to MongoDB
      if (userId) {
        try {
          await apiUpdateEmployee(oldId, updated);
          setSyncStatus('synced');
        } catch (err) {
          console.warn('MongoDB sync deferred (saved locally):', err);
          setSyncStatus('offline');
        }
      }

      return { success: true };
    },
    [employees, userId]
  );

  /**
   * Delete an employee
   * Instant local update + asynchronous MongoDB sync
   */
  const deleteEmployee = useCallback(
    async (id) => {
      const targetId = id.trim().toUpperCase();

      // 1. Instant local update
      setEmployees((prev) => prev.filter((e) => e.id !== targetId));

      // 2. Async background sync to MongoDB
      if (userId) {
        try {
          await apiDeleteEmployee(targetId);
          setSyncStatus('synced');
        } catch (err) {
          console.warn('MongoDB sync deferred (saved locally):', err);
          setSyncStatus('offline');
        }
      }
    },
    [userId]
  );

  return {
    employees,
    filteredEmployees,
    searchQuery,
    setSearchQuery,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    syncStatus,
  };
}
