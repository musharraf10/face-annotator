// Storage utilities for employee master data, daily sessions, and image caching

const EMPLOYEES_KEY = "pp_employees_v1";
const SESSIONS_KEY = "pp_sessions_v1";
const ACTIVE_SESSION_DATE_KEY = "pp_active_session_date_v1";

const DEFAULT_EMPLOYEES = [
  { id: "NW0007365", name: "Shaik Musharaf" },
  { id: "NW2000308", name: "Neeraj Kumar" },
  { id: "NW2000357", name: "Karthikeya" },
  { id: "NW0004014", name: "Krishna Prasanna" },
  { id: "NW0004567", name: "Kagithala Pranathi" },
  { id: "NW2000636", name: "Pavan Kumar" },
  { id: "NW0004569", name: "Uday Raju" },
  { id: "NW0004703", name: "Bommu Chakravarthi" },
  { id: "NW0007450", name: "Shaik Muskaan" },
];

/**
 * Fetch all master employees
 */
export function getStoredEmployees() {
  try {
    const raw = localStorage.getItem(EMPLOYEES_KEY);
    if (!raw) {
      // Initialize with default employees
      localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(DEFAULT_EMPLOYEES));
      return DEFAULT_EMPLOYEES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_EMPLOYEES;
  } catch (err) {
    console.error("Failed to load employees from localStorage", err);
    return DEFAULT_EMPLOYEES;
  }
}

/**
 * Save master employee list
 */
export function saveStoredEmployees(employees) {
  try {
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  } catch (err) {
    console.error("Failed to save employees to localStorage", err);
  }
}

/**
 * Get active session date (format YYYY-MM-DD)
 */
export function getActiveSessionDate() {
  try {
    const saved = localStorage.getItem(ACTIVE_SESSION_DATE_KEY);
    if (saved) return saved;
  } catch (err) {
    console.error(err);
  }
  return getTodayDateString();
}

/**
 * Set active session date
 */
export function setActiveSessionDate(dateStr) {
  try {
    localStorage.setItem(ACTIVE_SESSION_DATE_KEY, dateStr);
  } catch (err) {
    console.error(err);
  }
}

/**
 * Today's date string YYYY-MM-DD
 */
export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format date string to display format (e.g. 18 September 2026)
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Retrieve all sessions overview
 */
export function getAllSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to read sessions", err);
    return {};
  }
}

/**
 * Save a single session data
 */
export function saveSession(dateStr, sessionData) {
  try {
    const sessions = getAllSessions();
    sessions[dateStr] = {
      ...sessionData,
      date: dateStr,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error("Failed to save session", err);
  }
}

/**
 * Get single session data
 */
export function getSession(dateStr) {
  const sessions = getAllSessions();
  return sessions[dateStr] || null;
}

/**
 * Delete a session
 */
export function deleteSession(dateStr) {
  try {
    const sessions = getAllSessions();
    delete sessions[dateStr];
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error("Failed to delete session", err);
  }
}

// -------------------------------------------------------------
// IndexedDB for large image persistence (avoids 5MB quota errors)
// -------------------------------------------------------------
const DB_NAME = "pp_presence_annotator_db";
const STORE_NAME = "session_images";

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveImageToIndexedDB(key, dataUrl) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(dataUrl, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB save failed, image will stay in-memory", err);
    return false;
  }
}

export async function getImageFromIndexedDB(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB read failed", err);
    return null;
  }
}

export async function clearImageFromIndexedDB(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB delete failed", err);
    return false;
  }
}
