// API client with JWT 14-day token management and network resilience
import { getAuthToken, clearAuthSession } from "./storage";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

async function request(endpoint, options = {}) {
  const token = getAuthToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        // Token expired or invalid
        clearAuthSession();
      }
      const error = new Error(data.error || `HTTP error ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    // If network error / server offline
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      const offlineErr = new Error(
        "Backend server is currently offline or unreachable.",
      );
      offlineErr.isOffline = true;
      throw offlineErr;
    }
    throw err;
  }
}

// ------------------------------------
// Auth APIs
// ------------------------------------
export async function apiRegister({ name, email, password }) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function apiLogin({ email, password }) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiGetMe() {
  return request("/api/auth/me");
}

// ------------------------------------
// Employee APIs (Scoped to User Profile)
// ------------------------------------
export async function apiGetEmployees() {
  return request("/api/employees");
}

export async function apiAddEmployee({ id, name }) {
  return request("/api/employees", {
    method: "POST",
    body: JSON.stringify({ id, name }),
  });
}

export async function apiUpdateEmployee(oldId, { id, name }) {
  return request(`/api/employees/${encodeURIComponent(oldId)}`, {
    method: "PUT",
    body: JSON.stringify({ id, name }),
  });
}

export async function apiDeleteEmployee(id) {
  return request(`/api/employees/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function apiSyncEmployees(employees) {
  return request("/api/employees/sync", {
    method: "POST",
    body: JSON.stringify({ employees }),
  });
}

// ------------------------------------
// Sessions APIs
// ------------------------------------
export async function apiGetSessions() {
  return request("/api/sessions");
}

export async function apiSaveSession(date, sessionData) {
  return request(`/api/sessions/${encodeURIComponent(date)}`, {
    method: "POST",
    body: JSON.stringify(sessionData),
  });
}

export async function apiCheckHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
