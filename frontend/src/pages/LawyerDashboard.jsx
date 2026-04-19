import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/format";
import { Gavel, SignOut, UserCircle, CurrencyInr, Sparkle, ClipboardText, CheckCircle, ShieldCheck } from "@phosphor-icons/react";

export default function LawyerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState(0);
  const [bio, setBio] = useState("");
  const [spec, setSpec] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, r] = await Promise.all([api.get("/lawyers/me"), api.get("/lawyers/me/reviews")]);
      setMe(m.data);
      setReviews(r.data.reviews || []);
      setRate(m.data.profile.rate_inr);
      setBio(m.data.profile.bio || "");
      setSpec(m.data.profile.specialization || "");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "lawyer") {
      navigate("/app");
      return;
    }
    load();
  }, [user, load, navigate]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.post("/lawyers/me", { rate_inr: Number(rate), bio, specialization: spec });
      toast.success("Profile updated");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    await logout();
    navigate("/");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="lawyer-dash-loading">Loading…</div>;

  const p = me?.profile || {};
  const pending = reviews.filter((r) => r.status === "pending");
  const completed = reviews.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-background" data-testid="lawyer-dashboard">
      <header className="border-b hairline">
        <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 border hairline flex items-center justify-center">
              <span className="font-serif text-xl leading-none">E</span>
            </div>
            <span className="font-serif text-2xl">Estima · Counsel</span>
            {p.verified ? (
              <span className="ml-3 inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))] uppercase tracking-wider border hairline">
                <ShieldCheck size={10} weight="bold" /> Verified
              </span>
            ) : (
              <span className="ml-3 inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-yellow-500/10 text-yellow-500 uppercase tracking-wider border hairline">
                Pending verification
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle size={16} weight="duotone" />
              {me?.user?.email}
            </div>
            <button onClick={doLogout} className="btn-ghost px-3 py-2 text-sm inline-flex items-center gap-2" data-testid="lawyer-logout">
              <SignOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-10">
        <div className="mb-10">
          <div className="eyebrow mb-2">Counsel portal</div>
          <h1 className="font-serif text-5xl">Good day, {me?.user?.name?.split(" ")[1] || me?.user?.name || "Counsel"}.</h1>
          <p className="text-muted-foreground mt-3">Review drafted Wills, endorse them, and track your earnings. {!p.verified && "An Estima admin needs to verify your profile before users can book you."}</p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <Stat label="Pending reviews" value={pending.length} icon={<ClipboardText size={18} weight="duotone" />} />
          <Stat label="Completed" value={completed.length} icon={<CheckCircle size={18} weight="duotone" />} />
          <Stat label="Endorsements" value={p.endorsement_count || 0} icon={<Sparkle size={18} weight="duotone" />} />
          <Stat label="Earnings" value={inr(p.earnings_inr || 0)} icon={<CurrencyInr size={18} weight="duotone" />} />
        </div>

        {/* Profile */}
        <section className="card-flat p-8 mb-10" data-testid="lawyer-profile-section">
          <h2 className="font-serif text-3xl mb-6 flex items-center gap-3">
            <Gavel size={22} weight="duotone" className="text-[hsl(var(--secondary))]" /> Your profile
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <label className="block">
              <span className="eyebrow block mb-1.5">Fee per review (₹)</span>
              <input type="number" className="input-dark w-full px-3 py-2" value={rate} onChange={(e) => setRate(e.target.value)} data-testid="lawyer-rate-input" />
              <span className="text-[11px] text-muted-foreground mt-1 block">Platform fee is 10% · you keep ₹{Math.max(0, Math.floor(Number(rate || 0) * 0.9)).toLocaleString("en-IN")} per review.</span>
            </label>
            <label className="block">
              <span className="eyebrow block mb-1.5">Specialization</span>
              <input className="input-dark w-full px-3 py-2" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Succession & Wills · Family Law" data-testid="lawyer-spec-input" />
            </label>
            <label className="block md:col-span-2">
              <span className="eyebrow block mb-1.5">Bio (shown to users)</span>
              <textarea rows={3} className="input-dark w-full px-3 py-2" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Years of practice, notable cases, jurisdiction…" data-testid="lawyer-bio-input" />
            </label>
            <div>
              <span className="eyebrow block mb-1.5">Bar Council ID</span>
              <div className="text-sm">{p.bar_council_id || "—"}</div>
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving} className="btn-primary px-5 py-2.5 text-sm mt-6" data-testid="lawyer-save-profile">
            {saving ? "Saving…" : "Save profile"}
          </button>
        </section>

        {/* Pending */}
        <section className="mb-10">
          <h2 className="font-serif text-3xl mb-6 flex items-center gap-3">
            <ClipboardText size={22} weight="duotone" className="text-[hsl(var(--secondary))]" /> Pending reviews
          </h2>
          {pending.length === 0 ? (
            <div className="card-flat p-10 text-center text-muted-foreground" data-testid="lawyer-no-pending">
              No Wills awaiting your review. Once users book you, requests appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((r) => (
                <ReviewRow key={r.token} r={r} />
              ))}
            </div>
          )}
        </section>

        {/* Completed */}
        {completed.length > 0 && (
          <section>
            <h2 className="font-serif text-3xl mb-6 flex items-center gap-3">
              <CheckCircle size={22} weight="duotone" className="text-[hsl(var(--secondary))]" /> Completed
            </h2>
            <div className="space-y-3">
              {completed.map((r) => (
                <ReviewRow key={r.token} r={r} completed />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="card-flat p-5" data-testid={`lawyer-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="text-xs text-muted-foreground inline-flex items-center gap-2 mb-2">
        {icon} {label}
      </div>
      <div className="num-metric text-3xl">{value}</div>
    </div>
  );
}

function ReviewRow({ r, completed = false }) {
  const open = () => window.open(`/lawyer-review/${r.token}`, "_blank", "noopener");
  const statusClass = completed
    ? r.status === "rejected"
      ? "text-destructive"
      : "text-[hsl(var(--secondary))]"
    : "text-yellow-500";
  return (
    <div className="card-flat p-5" data-testid={`lawyer-review-row-${r.token.slice(0, 8)}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-serif text-xl">{r.testator_name || r.testator_email || "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Booked {r.created_at?.slice(0, 10)} · Fee ₹{Number(r.fee_inr || 0).toLocaleString("en-IN")} {r.paid ? "· Paid" : "· Awaiting payment"}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-xs uppercase tracking-wider ${statusClass}`}>{r.status}</span>
          <button onClick={open} className="btn-ghost px-4 py-2 text-sm" data-testid={`lawyer-review-open-${r.token.slice(0, 8)}`}>
            {completed ? "View" : "Review"}
          </button>
        </div>
      </div>
      {r.note && <div className="text-xs text-muted-foreground mt-3">Client note: {r.note}</div>}
      {r.review_comments && completed && <div className="text-sm mt-3 p-3 border hairline bg-[hsl(var(--muted))]">{r.review_comments}</div>}
    </div>
  );
}
