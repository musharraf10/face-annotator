// API client with JWT 14-day token management and network resilience
import { getAuthToken, clearAuthSession } from "./storage";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

async function request(endpoint, options = {}) {
  const token = getAuthToken();

  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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

async function requestBlob(endpoint) {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) clearAuthSession();
      const error = new Error(data.error || `HTTP error ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.blob();
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      const offline = new Error("Backend server is currently offline or unreachable.");
      offline.isOffline = true;
      throw offline;
    }
    throw error;
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

// Administrative provisioning APIs. The backend derives authorization from the JWT.
export async function apiGetAdminBranches() {
  return request("/api/admin/branches");
}

export async function apiGetAdminUnassignedAccounts() {
  return request("/api/admin/unassigned-accounts");
}

export async function apiAdminCreateBranch({ name, code }) {
  return request("/api/admin/branches", {
    method: "POST",
    body: JSON.stringify({ name, code }),
  });
}

export async function apiAdminAssignOperationsAccount(branchId, userId) {
  return request(`/api/admin/branches/${encodeURIComponent(branchId)}/operations-account`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function apiAdminReplaceOperationsAccount(branchId, userId) {
  return request(`/api/admin/branches/${encodeURIComponent(branchId)}/operations-account`, {
    method: "PUT",
    body: JSON.stringify({ userId }),
  });
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

export async function apiUploadEmployeePhoto(id, file) {
  const form = new FormData();
  form.append("photo", file);
  return request(`/api/employees/${encodeURIComponent(id)}/reference-photo`, { method: "POST", body: form });
}

export async function apiGetEmployeePhoto(id) {
  return requestBlob(`/api/employees/${encodeURIComponent(id)}/reference-photo`);
}

export async function apiDeleteEmployeePhoto(id) {
  return request(`/api/employees/${encodeURIComponent(id)}/reference-photo`, { method: "DELETE" });
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
