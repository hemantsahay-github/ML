import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Gavel, ArrowRight } from "@phosphor-icons/react";

export default function LawyerRegister() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    bar_council_id: "",
    specialization: "Succession & Wills",
    rate_inr: 2500,
    bio: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.bar_council_id) {
      toast.error("Name, email, password and Bar Council ID are required");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await api.post("/lawyers/register", { ...form, rate_inr: Number(form.rate_inr) });
      await refresh();
      toast.success("Welcome to Estima Counsel · Awaiting admin verification");
      navigate("/lawyer");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" data-testid="lawyer-register-page">
      <div className="w-full max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <div className="h-8 w-8 border hairline flex items-center justify-center">
            <span className="font-serif text-xl leading-none">E</span>
          </div>
          <span className="font-serif text-2xl">Estima · Counsel</span>
        </Link>

        <div className="card-flat p-10">
          <div className="flex items-center gap-3 mb-6">
            <Gavel size={28} weight="duotone" className="text-[hsl(var(--secondary))]" />
            <h1 className="font-serif text-4xl">Join as counsel</h1>
          </div>
          <p className="text-muted-foreground mb-8">
            Review AI-drafted Wills, endorse them, and build a practice on Estima. Set your fee per review — we handle payments, notifications and dispatch. Platform fee: 10% per review.
          </p>

          <form onSubmit={submit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <label className="block">
                <span className="eyebrow block mb-1.5">Full name</span>
                <input className="input-dark w-full px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Adv. Ravi Menon" data-testid="lreg-name" required />
              </label>
              <label className="block">
                <span className="eyebrow block mb-1.5">Bar Council ID</span>
                <input className="input-dark w-full px-3 py-2" value={form.bar_council_id} onChange={(e) => setForm({ ...form, bar_council_id: e.target.value })} placeholder="KAR/5423/2012" data-testid="lreg-bar" required />
              </label>
              <label className="block">
                <span className="eyebrow block mb-1.5">Email</span>
                <input type="email" className="input-dark w-full px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@firm.com" data-testid="lreg-email" required />
              </label>
              <label className="block">
                <span className="eyebrow block mb-1.5">Password</span>
                <input type="password" className="input-dark w-full px-3 py-2" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" data-testid="lreg-password" required />
              </label>
              <label className="block">
                <span className="eyebrow block mb-1.5">Specialization</span>
                <input className="input-dark w-full px-3 py-2" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} data-testid="lreg-spec" />
              </label>
              <label className="block">
                <span className="eyebrow block mb-1.5">Fee per review (₹)</span>
                <input type="number" className="input-dark w-full px-3 py-2" value={form.rate_inr} onChange={(e) => setForm({ ...form, rate_inr: e.target.value })} data-testid="lreg-rate" />
              </label>
            </div>
            <label className="block">
              <span className="eyebrow block mb-1.5">Bio (shown to users)</span>
              <textarea rows={3} className="input-dark w-full px-3 py-2" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Years of practice, notable cases, jurisdiction…" data-testid="lreg-bio" />
            </label>

            <div className="flex items-center justify-between pt-3">
              <div className="text-xs text-muted-foreground">
                By signing up you agree to our <Link to="/disclaimer" className="underline">Disclaimer</Link>. Your account is visible only after Estima verifies your Bar Council ID.
              </div>
              <button type="submit" disabled={busy} className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2" data-testid="lreg-submit">
                {busy ? "Creating account…" : <>Join Estima Counsel <ArrowRight size={14} /></>}
              </button>
            </div>
          </form>
          <div className="mt-8 pt-6 border-t hairline text-sm text-muted-foreground">
            Already a counsel? <Link to="/login" className="text-foreground underline" data-testid="lreg-login-link">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
