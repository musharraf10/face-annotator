// Storage utilities for personalized profiles, 14-day auth persistence, fast browser caching, and IndexedDB

const AUTH_TOKEN_KEY = "pp_auth_token_v2";
const AUTH_USER_KEY = "pp_auth_user_v2";
const AUTH_EXPIRES_AT_KEY = "pp_auth_expires_at_v2";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// -------------------------------------------------------------
// 14-Day Authentication Session Persistence
// -------------------------------------------------------------

/**
 * Save authentication token & user profile with 14-day expiry
 */
export function saveAuthSession(token, user, expiresAt) {
  try {
    const expiry = expiresAt || Date.now() + FOURTEEN_DAYS_MS;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_EXPIRES_AT_KEY, String(expiry));
  } catch (err) {
    console.error("Failed to save auth session to localStorage", err);
  }
}

/**
 * Retrieve active auth session if within 14-day validity period
 */
export function getAuthSession() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userRaw = localStorage.getItem(AUTH_USER_KEY);
    const expiresAt = Number(localStorage.getItem(AUTH_EXPIRES_AT_KEY));

    if (!token || !userRaw || !expiresAt) {
      return null;
    }

    // Check if session has expired (>14 days)
    if (Date.now() > expiresAt) {
      console.warn("Session expired after 14 days, clearing session");
      clearAuthSession();
      return null;
    }

    const user = JSON.parse(userRaw);
    return { token, user, expiresAt };
  } catch (err) {
    console.error("Failed to read auth session", err);
    return null;
  }
}

/**
 * Get active auth token if session is valid
 */
export function getAuthToken() {
  const session = getAuthSession();
  return session ? session.token : null;
}

/**
 * Clear authentication session on logout or expiry
 */
export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
  } catch (err) {
    console.error("Failed to clear auth session", err);
  }
}

// -------------------------------------------------------------
// Profile-Scoped Fast Browser Storage (Employees & Sessions)
// -------------------------------------------------------------

function getEmployeesKey(userId) {
  return userId ? `pp_employees_${userId}` : "pp_employees_guest";
}

function getSessionsKey(userId) {
  return userId ? `pp_sessions_${userId}` : "pp_sessions_guest";
}

function getActiveDateKey(userId) {
  return userId ? `pp_active_date_${userId}` : "pp_active_date_guest";
}

/**
 * Fetch employees for a given user profile.
 * Notice: For a new user, this returns an EMPTY array [] so the user adds their own employees!
 */
export function getStoredEmployees(userId) {
  try {
    const key = getEmployeesKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Initially empty for a new profile
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to load employees from browser storage", err);
    return [];
  }
}

/**
 * Save master employee list to fast browser storage
 */
export function saveStoredEmployees(userId, employees) {
  try {
    const key = getEmployeesKey(userId);
    localStorage.setItem(key, JSON.stringify(employees));
  } catch (err) {
    console.error("Failed to save employees to browser storage", err);
  }
}

/**
 * Get active session date (format YYYY-MM-DD)
 */
export function getActiveSessionDate(userId) {
  try {
    const key = getActiveDateKey(userId);
    const saved = localStorage.getItem(key);
    if (saved) return saved;
  } catch (err) {
    console.error(err);
  }
  return getTodayDateString();
}

/**
 * Set active session date
 */
export function setActiveSessionDate(userId, dateStr) {
  try {
    const key = getActiveDateKey(userId);
    localStorage.setItem(key, dateStr);
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
 * Retrieve all sessions overview for active profile
 */
export function getAllSessions(userId) {
  try {
    const key = getSessionsKey(userId);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to read sessions", err);
    return {};
  }
}

/**
 * Save a single session data
 */
export function saveSession(userId, dateStr, sessionData) {
  try {
    const key = getSessionsKey(userId);
    const sessions = getAllSessions(userId);
    sessions[dateStr] = {
      ...sessionData,
      date: dateStr,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch (err) {
    console.error("Failed to save session", err);
  }
}

/**
 * Get single session data
 */
export function getSession(userId, dateStr) {
  const sessions = getAllSessions(userId);
  return sessions[dateStr] || null;
}

/**
 * Delete a session
 */
export function deleteSession(userId, dateStr) {
  try {
    const key = getSessionsKey(userId);
    const sessions = getAllSessions(userId);
    delete sessions[dateStr];
    localStorage.setItem(key, JSON.stringify(sessions));
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
