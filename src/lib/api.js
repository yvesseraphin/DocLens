const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/bmp",
  "application/pdf",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const auth = {
  getToken: () => localStorage.getItem("dl_token"),
  setToken: (token) => localStorage.setItem("dl_token", token),
  clearToken: () => localStorage.removeItem("dl_token"),

  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem("dl_user") || "null");
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem("dl_user", JSON.stringify(user)),
  clearUser: () => localStorage.removeItem("dl_user"),

  isLoggedIn: () => !!localStorage.getItem("dl_token"),

  logout: () => {
    localStorage.removeItem("dl_token");
    localStorage.removeItem("dl_user");
    localStorage.removeItem("dl_refresh_token");
    sessionStorage.removeItem("dl_case_data");
  },
};

function validateDocumentFile(file) {
  if (!file || !DOCUMENT_TYPES.has(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, BMP, and PDF files are supported.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Files must be 10 MB or smaller.");
  }
}

async function request(path, options = {}) {
  const token = auth.getToken();
  const headers = { ...options.headers };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.detail || data?.message || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return data;
}

export async function register(body) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function login(body) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  auth.setToken(data.access_token);
  auth.setUser(data.user);
  return data;
}

export async function forgotPassword(email) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(body) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMe() {
  return request("/auth/me");
}

export async function listCases() {
  return request("/cases");
}

export async function createCase(body) {
  return request("/cases", { method: "POST", body: JSON.stringify(body) });
}

export async function getCase(id) {
  return request(`/cases/${id}`);
}

export async function deleteCase(id) {
  return request(`/cases/${id}`, { method: "DELETE" });
}

export async function uploadCaseFiles(
  caseId,
  questionedFile,
  referenceFiles = [],
) {
  validateDocumentFile(questionedFile);
  referenceFiles.forEach(validateDocumentFile);

  const form = new FormData();
  form.append("questioned", questionedFile);
  referenceFiles.forEach((f) => form.append("references", f));
  return request(`/cases/${caseId}/upload`, { method: "POST", body: form });
}

export async function analyzeCase(caseId, questionedFile, referenceFiles = []) {
  validateDocumentFile(questionedFile);
  referenceFiles.forEach(validateDocumentFile);

  const form = new FormData();
  form.append("case_id", caseId);
  form.append("questioned", questionedFile);
  referenceFiles.forEach((f) => form.append("references", f));
  return request("/analyze", { method: "POST", body: form });
}

export async function healthCheck() {
  return request("/health");
}
