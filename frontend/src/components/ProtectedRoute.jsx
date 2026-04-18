import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, booted } = useAuth();
  const location = useLocation();
  if (!booted || user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="auth-loading">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
