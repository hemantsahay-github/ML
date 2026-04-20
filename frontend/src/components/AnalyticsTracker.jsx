import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "../lib/api";

const SESSION_KEY = "estima_analytics_session";

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random()}`);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/**
 * Anonymous page-view + time-on-page tracker. Fires one event per route-change.
 * No PII beyond an ephemeral session_id (sessionStorage, cleared on tab-close).
 */
export default function AnalyticsTracker() {
  const location = useLocation();
  const startedAtRef = useRef(Date.now());
  const prevRouteRef = useRef(null);

  useEffect(() => {
    const now = Date.now();
    const prev = prevRouteRef.current;
    if (prev) {
      const elapsed = now - startedAtRef.current;
      // fire event for the route we just LEFT
      api.post("/analytics/track", {
        route: prev,
        session_id: getSessionId(),
        time_on_page_ms: Math.min(elapsed, 30 * 60 * 1000),
        user_agent: navigator.userAgent,
      }).catch(() => {});
    }
    prevRouteRef.current = location.pathname;
    startedAtRef.current = now;
  }, [location.pathname]);

  // Also fire on tab-close / beforeunload
  useEffect(() => {
    const onUnload = () => {
      const elapsed = Date.now() - startedAtRef.current;
      try {
        navigator.sendBeacon?.(
          `${process.env.REACT_APP_BACKEND_URL}/api/analytics/track`,
          new Blob([JSON.stringify({
            route: location.pathname,
            session_id: getSessionId(),
            time_on_page_ms: elapsed,
            user_agent: navigator.userAgent,
          })], { type: "application/json" })
        );
      } catch {
        // ignore
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [location.pathname]);

  return null;
}
