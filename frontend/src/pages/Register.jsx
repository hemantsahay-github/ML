import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { UserPlus } from "@phosphor-icons/react";

export default function Register() {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user) nav("/app", { replace: true });
  }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const res = await register(email.trim().toLowerCase(), password, name.trim());
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Account ready. Let's model a property.");
    nav("/app", { replace: true });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8 lg:p-16 order-2 lg:order-1">
        <form onSubmit={submit} className="w-full max-w-md" data-testid="register-form">
          <Link to="/" className="eyebrow hover:text-foreground transition">
            ← Back to Estima
          </Link>
          <h1 className="font-serif text-4xl md:text-5xl mt-6 mb-2">Create account.</h1>
          <p className="text-muted-foreground mb-10">Two minutes to a clearer decision.</p>

          <label className="block mb-5">
            <span className="eyebrow block mb-2">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input-dark w-full px-4 py-3"
              placeholder="Anika Mehta"
              data-testid="register-name-input"
            />
          </label>
          <label className="block mb-5">
            <span className="eyebrow block mb-2">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-dark w-full px-4 py-3"
              placeholder="you@domain.com"
              data-testid="register-email-input"
            />
          </label>
          <label className="block mb-6">
            <span className="eyebrow block mb-2">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input-dark w-full px-4 py-3"
              placeholder="at least 6 characters"
              data-testid="register-password-input"
            />
          </label>

          {err && (
            <div className="text-sm text-destructive mb-4" data-testid="register-error">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid="register-submit-button"
          >
            <UserPlus size={16} weight="bold" />
            {loading ? "Creating…" : "Create account"}
          </button>

          <div className="mt-8 text-sm text-muted-foreground">
            Already have one?{" "}
            <Link to="/login" className="text-foreground underline underline-offset-4 hover:text-[hsl(var(--secondary))]" data-testid="register-to-login">
              Sign in
            </Link>
          </div>
        </form>
      </div>
      <div
        className="hidden lg:block relative order-1 lg:order-2"
        style={{
          backgroundImage: `url(https://images.unsplash.com/photo-1757780993465-7f1923296763?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhcGFydG1lbnQlMjBidWlsZGluZyUyMGV4dGVyaW9yJTIwdHdpbGlnaHR8ZW58MHx8fHwxNzc2NTQyMTgyfDA&ixlib=rb-4.1.0&q=85)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-background/40" />
        <div className="absolute bottom-10 left-10 right-10">
          <div className="eyebrow text-foreground/80 mb-3">Estima · Pro</div>
          <div className="font-serif text-4xl leading-tight text-foreground max-w-md">
            Model the home. Before the home models you.
          </div>
        </div>
      </div>
    </div>
  );
}
