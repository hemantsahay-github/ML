import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function AuthCallback() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      nav("/login", { replace: true });
      return;
    }
    const session_id = decodeURIComponent(match[1]);
    (async () => {
      try {
        await api.post("/auth/google/session", { session_id });
        await refresh();
        toast.success("Signed in with Google");
        window.history.replaceState(null, "", window.location.pathname);
        nav("/app", { replace: true });
      } catch {
        toast.error("Google sign-in failed. Try again.");
        nav("/login", { replace: true });
      }
    })();
  }, [nav, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="auth-callback">
      Signing you in…
    </div>
  );
}
