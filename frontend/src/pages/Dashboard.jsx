import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { inr } from "../lib/format";
import { logger } from "../lib/logger";
import { toast } from "sonner";
import { ArrowRight, Buildings, Plus, TrendUp, Scales, MapTrifold, Calendar, MapPin, WhatsappLogo, Copy, Trash } from "@phosphor-icons/react";

export default function Dashboard() {
  const { user } = useAuth();
  const [props, setProps] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [watched, setWatched] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [pRes, poRes, wRes] = await Promise.all([
        api.get("/properties"),
        api.get("/portfolio/summary"),
        api.get("/projects/watched").catch((e) => { logger.debug("watched load failed", e); return { data: { projects: [] } }; }),
      ]);
      setProps(pRes.data);
      setPortfolio(poRes.data);
      setWatched(wRes.data.projects || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const candidates = props.filter((p) => (p.status || "evaluating") === "evaluating");
  const totalValue = candidates.reduce((a, p) => a + (p.price || 0), 0);
  const avgPrice = candidates.length ? totalValue / candidates.length : 0;

  return (
    <div className="max-w-7xl mx-auto px-8 py-10" data-testid="dashboard-page">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="eyebrow mb-2">Dashboard</div>
          <h1 className="font-serif text-5xl">
            Welcome back, <span className="italic text-[hsl(var(--secondary))]">{user?.name?.split(" ")[0] || "friend"}</span>.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Here&apos;s where your decision stands today. Add more candidates, re-run
            the math, or ask the advisor.
          </p>
        </div>
        <Link
          to="/app/properties"
          className="btn-primary px-5 py-3 inline-flex items-center gap-2 text-sm"
          data-testid="dashboard-add-property"
        >
          <Plus size={16} weight="bold" /> Add property
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-12">
        <MetricCard
          label="Candidates tracked"
          value={candidates.length}
          icon={<Buildings size={22} weight="duotone" />}
          testid="metric-properties"
        />
        <MetricCard
          label="Avg. ticket size"
          value={inr(avgPrice)}
          icon={<Scales size={22} weight="duotone" />}
          testid="metric-avg-price"
        />
        <MetricCard
          label="Owned portfolio"
          value={inr(portfolio?.total_current_value || 0)}
          icon={<TrendUp size={22} weight="duotone" />}
          testid="metric-portfolio-value"
        />
        <MetricCard
          label="Your equity"
          value={inr(portfolio?.total_equity || 0)}
          icon={<TrendUp size={22} weight="duotone" />}
          testid="metric-portfolio-equity"
        />
      </div>

      {/* Property preview list */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-3xl">Your candidates</h2>
          <Link to="/app/properties" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            Manage all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="text-muted-foreground" data-testid="dashboard-loading">
            Loading…
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {candidates.slice(0, 6).map((p) => (
              <div key={p.id} className="card-flat p-6" data-testid={`dashboard-prop-${p.id}`}>
                <div className="eyebrow">{p.type}</div>
                <div className="font-serif text-2xl mt-2">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.location}</div>
                <div className="mt-5 num-metric text-3xl">{inr(p.price)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {p.area_sqft} sqft · {p.loan_rate}% @ {p.loan_tenure_years}y
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projects you're tracking */}
      {watched.length > 0 && (
        <section className="mt-14" data-testid="dashboard-watched-section">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-serif text-3xl flex items-center gap-3">
                <MapTrifold size={24} weight="duotone" className="text-[hsl(var(--secondary))]" />
                Projects you&apos;re tracking
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Upcoming and under-construction launches on your watchlist.</p>
            </div>
            <Link to="/app/projects" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Browse all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {watched.slice(0, 3).map((p) => (
              <div key={p.id} className="card-flat p-5" data-testid={`dashboard-watched-${p.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="eyebrow">{p.builder}</div>
                    <div className="font-serif text-xl mt-1 truncate">{p.name}</div>
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 shrink-0 ${p.status === "Under construction" ? "bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))]" : "bg-[hsl(var(--muted))] text-muted-foreground"}`}>
                    {p.status}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                  <MapPin size={11} /> {p.area} · {p.city}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Possession</div>
                    <div className="flex items-center gap-1 mt-0.5"><Calendar size={10} /> {p.possession || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Ticket from</div>
                    <div className="num-metric mt-0.5">{p.price_from_inr ? inr(p.price_from_inr) : "—"}</div>
                  </div>
                </div>
                {p.highlight && (
                  <div className="text-xs text-muted-foreground italic border-l-2 border-[hsl(var(--secondary))] pl-3 mt-3 line-clamp-2">
                    {p.highlight}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tools */}
      <section className="mt-16 grid md:grid-cols-2 gap-6">
        <ToolCard
          to="/app/portfolio"
          title="Portfolio"
          body="Track properties you already own: value, equity, cashflow."
          testid="tool-portfolio"
        />
        <ToolCard
          to="/app/compare"
          title="Side-by-side comparison"
          body="Pick 2–4 properties and surface the weighted winner."
          testid="tool-compare"
        />
        <ToolCard
          to="/app/calculators"
          title="Rent · EMI · Invest"
          body="Stress-test against mutual funds, equity, and rent."
          testid="tool-calculators"
        />
        <ToolCard
          to="/app/advisor"
          title="AI advisor"
          body="Ask Claude for a verdict grounded in your numbers."
          testid="tool-advisor"
        />
        <ToolCard
          to="/app/properties"
          title="Property ledger"
          body="Add, edit and score every candidate in one place."
          testid="tool-properties"
        />
      </section>

      <MySharesPanel />
    </div>
  );
}

function MetricCard({ label, value, icon, testid }) {
  return (
    <div className="card-flat p-6" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="eyebrow">{label}</div>
        <div className="text-[hsl(var(--secondary))]">{icon}</div>
      </div>
      <div className="num-metric text-4xl mt-6">{value}</div>
    </div>
  );
}

function ToolCard({ to, title, body, testid }) {
  return (
    <Link to={to} className="card-flat p-6 hover:border-[hsl(var(--secondary))] transition block" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="font-serif text-2xl">{title}</div>
        <ArrowRight size={18} className="text-muted-foreground" />
      </div>
      <div className="text-sm text-muted-foreground mt-2">{body}</div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="card-flat p-12 text-center" data-testid="dashboard-empty">
      <div className="font-serif text-3xl mb-3">No properties yet.</div>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        The decision gets easier the moment you put the first address on paper.
      </p>
      <Link to="/app/properties" className="btn-primary px-5 py-3 inline-flex items-center gap-2 text-sm">
        <Plus size={16} weight="bold" /> Add your first property
      </Link>
    </div>
  );
}


function MySharesPanel() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/shares");
      setShares(data);
    } catch (e) {
      logger.debug("shares load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const publicUrl = (s) => `${window.location.origin}/share/${s.share_id}`;

  const copyLink = async (s) => {
    try {
      await navigator.clipboard?.writeText(publicUrl(s));
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — please open the link manually");
    }
  };

  const whatsappLink = (s) => {
    const msg = s.kind === "snowball"
      ? `Rental snowball plan I modelled on Estima — XIRR ${s.xirr_pct}% on ${s.total_purchases} flats. ${publicUrl(s)}`
      : s.kind === "odcf"
      ? `OD cashflow scenario I modelled on Estima — XIRR ${s.xirr_pct}%. ${publicUrl(s)}`
      : `Property comparison I ran on Estima — winner: ${s.winner}. ${publicUrl(s)}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const del = async (s) => {
    if (!window.confirm(`Delete "${s.title}"? The public link will stop working.`)) return;
    try {
      await api.delete(`/shares/${s.share_id}`);
      setShares(shares.filter((x) => x.share_id !== s.share_id));
      toast.success("Deleted");
    } catch (e) {
      toast.error("Couldn't delete");
    }
  };

  const kindLabel = (k) => ({ snowball: "Snowball", odcf: "OD Cashflow", comparison: "Comparison" }[k] || k);
  const kindTone = (k) => ({
    snowball: "bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))] border-[hsl(var(--secondary))]/30",
    odcf: "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30",
    comparison: "bg-foreground/5 text-foreground border-foreground/20",
  }[k] || "");

  if (loading) return null;
  if (shares.length === 0) return null;

  return (
    <section className="mt-14" data-testid="dashboard-my-shares">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="eyebrow mb-2">My shared reports</div>
          <h2 className="font-serif text-3xl">Every time someone opens one, it's a free lead for you.</h2>
        </div>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b hairline">
            <tr>
              <th className="p-4 font-normal eyebrow">Title</th>
              <th className="p-4 font-normal eyebrow">Kind</th>
              <th className="p-4 font-normal eyebrow">Detail</th>
              <th className="p-4 font-normal eyebrow">Created</th>
              <th className="p-4 font-normal eyebrow text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shares.map((s) => (
              <tr key={s.share_id} className="border-b hairline last:border-0" data-testid={`share-row-${s.share_id}`}>
                <td className="p-4">
                  <Link to={`/share/${s.share_id}`} target="_blank" rel="noreferrer" className="font-serif text-lg hover:text-[hsl(var(--secondary))] transition">
                    {s.title}
                  </Link>
                </td>
                <td className="p-4">
                  <span className={`inline-block px-2 py-0.5 border text-[10px] uppercase tracking-wider ${kindTone(s.kind)}`}>{kindLabel(s.kind)}</span>
                </td>
                <td className="p-4 text-muted-foreground text-xs">
                  {s.kind === "snowball" && `${s.total_purchases} flats · XIRR ${s.xirr_pct}%`}
                  {s.kind === "odcf" && `${s.builder_plan?.toUpperCase()} · XIRR ${s.xirr_pct}%`}
                  {s.kind === "comparison" && `${s.num_properties} properties · winner: ${s.winner || "—"}`}
                </td>
                <td className="p-4 text-muted-foreground text-xs">
                  {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="p-4">
                  <div className="flex gap-1 justify-end">
                    <a
                      href={whatsappLink(s)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 hover:text-[hsl(var(--secondary))] transition"
                      title="Share on WhatsApp"
                      data-testid={`share-whatsapp-${s.share_id}`}
                    >
                      <WhatsappLogo size={16} weight="duotone" />
                    </a>
                    <button
                      onClick={() => copyLink(s)}
                      className="p-2 hover:text-[hsl(var(--secondary))] transition"
                      title="Copy link"
                      data-testid={`share-copy-${s.share_id}`}
                    >
                      <Copy size={16} weight="duotone" />
                    </button>
                    <button
                      onClick={() => del(s)}
                      className="p-2 hover:text-destructive transition"
                      title="Delete"
                      data-testid={`share-delete-${s.share_id}`}
                    >
                      <Trash size={16} weight="duotone" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
