import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const TOKEN_KEY = "estima_access_token";
const REFRESH_KEY = "estima_refresh_token";

// Token storage — used as a fallback when 3rd-party cookies are blocked
// by the browser (Chrome tracking protection, Safari ITP, incognito mode).
// HttpOnly cookies are still set on every auth response and take precedence
// when the browser allows them.
export const tokenStore = {
  get access() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  get refresh() {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set({ access_token, refresh_token }) {
    try {
      if (access_token) localStorage.setItem(TOKEN_KEY, access_token);
      if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
    } catch {
      // ignore (quota/privacy-mode)
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // ignore
    }
  },
};

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Attach Authorization header from localStorage if present. Backend also
// accepts cookies — whichever arrives first (header) wins.
api.interceptors.request.use((config) => {
  const tok = tokenStore.access;
  if (tok && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${tok}`;
  }
  return config;
});

// Auto-capture tokens returned in auth response bodies.
api.interceptors.response.use((resp) => {
  const d = resp?.data;
  if (d && typeof d === "object" && (d.access_token || d.refresh_token)) {
    tokenStore.set({
      access_token: d.access_token,
      refresh_token: d.refresh_token,
    });
  }
  return resp;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
