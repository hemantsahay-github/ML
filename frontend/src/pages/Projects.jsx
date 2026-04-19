import { useEffect, useMemo, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/format";
import Disclaimer from "../components/Disclaimer";
import {
  MapPin,
  Buildings,
  Calendar,
  Plus,
  X,
  ArrowRight,
  CheckSquareOffset,
} from "@phosphor-icons/react";

const blankSubmit = {
  city: "Bengaluru",
  area: "",
  name: "",
  builder: "",
  status: "Upcoming",
  possession: "",
  config: "",
  price_from_inr: 0,
  price_per_sqft: 0,
  highlight: "",
  rera_id: "",
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subForm, setSubForm] = useState(blankSubmit);

  const load = async () => {
    setLoading(true);
    try {
      const params = [];
      if (city) params.push(`city=${encodeURIComponent(city)}`);
      if (area) params.push(`area=${encodeURIComponent(area)}`);
      if (status) params.push(`status=${encodeURIComponent(status)}`);
      const { data } = await api.get(`/builder-projects${params.length ? `?${params.join("&")}` : ""}`);
      setProjects(data.projects);
      setCities(data.cities);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, area, status]);

  const statuses = useMemo(() => {
    const s = new Set(projects.map((p) => p.status));
    return Array.from(s);
  }, [projects]);

  const submitCommunity = async (e) => {
    e.preventDefault();
    try {
      await api.post("/builder-projects/community", {
        ...subForm,
        price_from_inr: Number(subForm.price_from_inr || 0),
        price_per_sqft: Number(subForm.price_per_sqft || 0),
      });
      toast.success("Thanks! Community project submitted.");
      setSubmitting(false);
      setSubForm(blankSubmit);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10" data-testid="projects-page">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="eyebrow mb-2">Upcoming projects</div>
          <h1 className="font-serif text-5xl">What&apos;s breaking ground.</h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Curated under-construction and upcoming residential projects across
            tier-1 cities. Filter by city or area — add the ones you&apos;re tracking.
          </p>
        </div>
        <button
          onClick={() => setSubmitting(true)}
          className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2"
          data-testid="submit-project-button"
        >
          <Plus size={16} weight="bold" /> Submit a project
        </button>
      </div>

      {/* Filters */}
      <div className="card-flat p-4 flex flex-wrap gap-3 mb-6" data-testid="project-filters">
        <select
          className="input-dark px-3 py-2 text-sm"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          data-testid="projects-city-filter"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Area / locality…"
          className="input-dark px-3 py-2 text-sm flex-1 min-w-[180px]"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          data-testid="projects-area-filter"
        />
        <select
          className="input-dark px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-testid="projects-status-filter"
        >
          <option value="">Any status</option>
          {["Upcoming", "Under construction", ...statuses.filter((s) => !["Upcoming", "Under construction"].includes(s))].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(city || area || status) && (
          <button
            onClick={() => { setCity(""); setArea(""); setStatus(""); }}
            className="btn-ghost px-3 py-2 text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="card-flat p-12 text-center" data-testid="projects-empty">
          <Buildings size={40} weight="duotone" className="mx-auto text-[hsl(var(--secondary))] mb-3" />
          <div className="font-serif text-3xl mb-3">No projects match.</div>
          <p className="text-muted-foreground">Try removing a filter — or submit one you&apos;re tracking.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="projects-grid">
          {projects.map((p) => (
            <div key={p.id} className="card-flat p-6 flex flex-col" data-testid={`project-${p.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="eyebrow">{p.builder}</div>
                  <div className="font-serif text-2xl mt-1 leading-tight">{p.name}</div>
                </div>
                <div className={`text-xs px-2 py-1 ${p.status === "Under construction" ? "bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))]" : "bg-[hsl(var(--muted))] text-muted-foreground"}`}>
                  {p.status}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                <MapPin size={12} /> {p.area} · {p.city}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div>
                  <div className="text-muted-foreground">Possession</div>
                  <div className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                    <Calendar size={11} /> {p.possession || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Config</div>
                  <div className="font-medium text-foreground mt-0.5">{p.config || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Ticket from</div>
                  <div className="num-metric text-foreground mt-0.5">{p.price_from_inr ? inr(p.price_from_inr) : "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Per sqft</div>
                  <div className="num-metric text-foreground mt-0.5">{p.price_per_sqft ? `₹${Number(p.price_per_sqft).toLocaleString("en-IN")}` : "—"}</div>
                </div>
              </div>
              {p.highlight && (
                <div className="text-xs text-muted-foreground italic border-l-2 border-[hsl(var(--secondary))] pl-3 mb-4">
                  {p.highlight}
                </div>
              )}
              {p.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {p.amenities.slice(0, 3).map((a) => (
                    <span key={a} className="text-[10px] px-2 py-0.5 bg-[hsl(var(--muted))] text-muted-foreground">{a}</span>
                  ))}
                </div>
              )}
              <div className="mt-auto pt-3 border-t hairline flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground truncate max-w-[60%]" title={p.rera_id}>
                  {p.rera_id ? (<><CheckSquareOffset size={10} className="inline mr-1" />RERA: {p.rera_id}</>) : "RERA pending"}
                </span>
                {p.submitted_by && <span className="text-[hsl(var(--secondary))]">· community</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit modal */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-background/70" onClick={() => setSubmitting(false)} />
          <div className="relative w-full max-w-xl bg-card border-l hairline overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b hairline sticky top-0 bg-card z-10">
              <div className="font-serif text-2xl">Submit a project</div>
              <button onClick={() => setSubmitting(false)} className="btn-ghost p-2">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={submitCommunity} className="p-6 space-y-4" data-testid="project-submit-form">
              <F label="Project name *"><input className="input-dark w-full px-3 py-2" required value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} data-testid="project-name" /></F>
              <F label="Builder *"><input className="input-dark w-full px-3 py-2" required value={subForm.builder} onChange={(e) => setSubForm({ ...subForm, builder: e.target.value })} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="City *">
                  <select className="input-dark w-full px-3 py-2" value={subForm.city} onChange={(e) => setSubForm({ ...subForm, city: e.target.value })}>
                    {cities.concat(["Other"]).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Area / locality *"><input className="input-dark w-full px-3 py-2" required value={subForm.area} onChange={(e) => setSubForm({ ...subForm, area: e.target.value })} /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Status">
                  <select className="input-dark w-full px-3 py-2" value={subForm.status} onChange={(e) => setSubForm({ ...subForm, status: e.target.value })}>
                    <option>Upcoming</option>
                    <option>Under construction</option>
                    <option>Ready to move</option>
                  </select>
                </F>
                <F label="Possession (YYYY-MM)"><input className="input-dark w-full px-3 py-2" placeholder="2027-06" value={subForm.possession} onChange={(e) => setSubForm({ ...subForm, possession: e.target.value })} /></F>
              </div>
              <F label="Config (e.g. 2/3 BHK)"><input className="input-dark w-full px-3 py-2" value={subForm.config} onChange={(e) => setSubForm({ ...subForm, config: e.target.value })} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Ticket size from (₹)"><input type="number" className="input-dark w-full px-3 py-2" value={subForm.price_from_inr} onChange={(e) => setSubForm({ ...subForm, price_from_inr: e.target.value })} /></F>
                <F label="Price per sqft (₹)"><input type="number" className="input-dark w-full px-3 py-2" value={subForm.price_per_sqft} onChange={(e) => setSubForm({ ...subForm, price_per_sqft: e.target.value })} /></F>
              </div>
              <F label="Highlight (one-liner)"><textarea rows={2} className="input-dark w-full px-3 py-2" value={subForm.highlight} onChange={(e) => setSubForm({ ...subForm, highlight: e.target.value })} /></F>
              <F label="RERA ID (optional)"><input className="input-dark w-full px-3 py-2" value={subForm.rera_id} onChange={(e) => setSubForm({ ...subForm, rera_id: e.target.value })} /></F>
              <div className="flex gap-3 pt-3">
                <button type="submit" className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2" data-testid="project-submit-save">
                  Submit <ArrowRight size={14} />
                </button>
                <button type="button" onClick={() => setSubmitting(false)} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}

function F({ label, children }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
