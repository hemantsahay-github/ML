import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { SignIn } from "@phosphor-icons/react";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user) nav(from, { replace: true });
  }, [user, from, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Welcome back.");
    nav(from, { replace: true });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div
        className="hidden lg:block relative"
        style={{
          backgroundImage: `url(https://images.unsplash.com/photo-1564343128896-3ffbcf9439e5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjBsdXh1cnklMjB2aWxsYSUyMGV4dGVyaW9yJTIwdHdpbGlnaHR8ZW58MHx8fHwxNzc2NTQyMTgyfDA&ixlib=rb-4.1.0&q=85)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-background/40" />
        <div className="absolute bottom-10 left-10 right-10">
          <div className="eyebrow text-foreground/80 mb-3">Estima</div>
          <div className="font-serif text-4xl leading-tight text-foreground max-w-md">
            The quietest room in your property search.
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 lg:p-16">
        <form onSubmit={submit} className="w-full max-w-md" data-testid="login-form">
          <Link to="/" className="eyebrow hover:text-foreground transition">
            ← Back to Estima
          </Link>
          <h1 className="font-serif text-4xl md:text-5xl mt-6 mb-2">Sign in.</h1>
          <p className="text-muted-foreground mb-10">Pick up where your decision left off.</p>

          <label className="block mb-5">
            <span className="eyebrow block mb-2">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-dark w-full px-4 py-3"
              placeholder="you@domain.com"
              data-testid="login-email-input"
            />
          </label>
          <label className="block mb-6">
            <span className="eyebrow block mb-2">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-dark w-full px-4 py-3"
              placeholder="••••••••"
              data-testid="login-password-input"
            />
          </label>

          {err && (
            <div className="text-sm text-destructive mb-4" data-testid="login-error">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid="login-submit-button"
          >
            <SignIn size={16} weight="bold" />
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="mt-8 text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/register" className="text-foreground underline underline-offset-4 hover:text-[hsl(var(--secondary))]" data-testid="login-to-register">
              Create one
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
