import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatApiErrorDetail, tokenStore } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest, object=user
  const [booted, setBooted] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setBooted(true);
    }
  }, []);

  useEffect(() => {
    // CRITICAL (Emergent Google Auth): If we're returning from the OAuth
    // callback with #session_id=... in the URL, SKIP the /auth/me check.
    // AuthCallback will exchange the session_id, set cookies, then trigger
    // refresh() itself. Running /auth/me first would race and set user=false
    // before the cookie exists.
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setBooted(true);
      return;
    }
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data);
      return { ok: true, user: data };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (email, password, name, referral_code) => {
    try {
      const payload = { email, password, name };
      if (referral_code) payload.referral_code = referral_code;
      const { data } = await api.post("/auth/register", payload);
      setUser(data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore network errors on logout
    }
    tokenStore.clear();
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, booted, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
