import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { Trophy, Scales, FileCsv, FilePdf, Share } from "@phosphor-icons/react";

const defaultWeights = {
  location: 0.25,
  amenities: 0.15,
  safety: 0.15,
  commute: 0.15,
  resale: 0.15,
  price_value: 0.15,
};

export default function Compare() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [weights, setWeights] = useState(defaultWeights);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/properties");
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setResult(null);
  };

  const runScore = async () => {
    if (selected.length < 2) {
      toast.error("Select at least two properties.");
      return;
    }
    setScoring(true);
    try {
      const { data } = await api.post("/compare/score", { property_ids: selected, weights });
      setResult(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setScoring(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = async () => {
    try {
      const res = await api.post(
        "/compare/export/csv",
        { property_ids: selected, weights },
        { responseType: "blob" }
      );
      downloadBlob(res.data, "estima-comparison.csv");
      toast.success("CSV downloaded");
    } catch (e) {
      if (e.response?.status === 402) {
        toast.error("Pro plan required", {
          description: "Upgrade to export CSV/PDF.",
          action: { label: "See plans", onClick: () => (window.location.href = "/pricing") },
        });
      } else {
        toast.error("Export failed");
      }
    }
  };

  const exportPdf = async () => {
    try {
      const res = await api.post(
        "/compare/export/pdf",
        { property_ids: selected, weights },
        { responseType: "blob" }
      );
      downloadBlob(res.data, "estima-comparison.pdf");
      toast.success("PDF downloaded");
    } catch (e) {
      if (e.response?.status === 402) {
        toast.error("Pro plan required", {
          description: "Upgrade to export CSV/PDF.",
          action: { label: "See plans", onClick: () => (window.location.href = "/pricing") },
        });
      } else {
        toast.error("Export failed");
      }
    }
  };

  const createShare = async () => {
    try {
      const { data } = await api.post("/shares", { property_ids: selected, weights });
      const link = `${window.location.origin}/share/${data.share_id}`;
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Share link copied to clipboard", { description: link });
      } catch {
        toast.success("Share link created", { description: link });
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const radarData = result
    ? ["location", "amenities", "safety", "commute", "resale", "price_value"].map((axis) => {
        const entry = { axis: axis.replace("_", " ") };
        result.results.forEach((r) => {
          entry[r.name] = r.breakdown[axis];
        });
        return entry;
      })
    : [];

  const CHART_COLORS = ["#C85A32", "#B89B72", "#5E7C60", "#4A5568"];

  return (
    <div className="max-w-7xl mx-auto px-8 py-10" data-testid="compare-page">
      <div className="mb-8">
        <div className="eyebrow mb-2">Compare</div>
        <h1 className="font-serif text-5xl">Side by side.</h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          Pick 2–4 properties, dial the weights that matter to you, and Estima surfaces a
          weighted winner with a clean breakdown.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length < 2 ? (
        <div className="card-flat p-12 text-center">
          <div className="font-serif text-3xl mb-3">You need at least two properties.</div>
          <p className="text-muted-foreground">Head to the Properties page to add more candidates.</p>
        </div>
      ) : (
        <>
          <section className="mb-8">
            <div className="eyebrow mb-3">Select candidates</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  data-testid={`select-prop-${p.id}`}
                  className={`card-flat p-5 text-left transition ${
                    selected.includes(p.id)
                      ? "border-[hsl(var(--primary))]"
                      : "hover:border-[hsl(var(--secondary))]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="eyebrow">{p.type}</div>
                      <div className="font-serif text-xl mt-1">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.location}</div>
                    </div>
                    <div className={`h-5 w-5 border ${selected.includes(p.id) ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))]" : "hairline"}`} />
                  </div>
                  <div className="num-metric text-2xl mt-3">{inr(p.price)}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="mb-8 card-flat p-6">
            <div className="eyebrow mb-4">Weights (total: {(Object.values(weights).reduce((a, b) => a + b, 0) * 100).toFixed(0)}%)</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {Object.entries(weights).map(([k, v]) => (
                <label key={k} className="block">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span className="capitalize">{k.replace("_", " ")}</span>
                    <span>{(v * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.05"
                    value={v}
                    onChange={(e) => setWeights({ ...weights, [k]: parseFloat(e.target.value) })}
                    className="w-full accent-[hsl(var(--primary))]"
                    data-testid={`weight-${k}`}
                  />
                </label>
              ))}
            </div>
          </section>

          <button
            onClick={runScore}
            disabled={scoring || selected.length < 2}
            className="btn-primary px-6 py-3 inline-flex items-center gap-2 disabled:opacity-50"
            data-testid="run-score-button"
          >
            <Scales size={16} weight="bold" />
            {scoring ? "Scoring…" : "Score & compare"}
          </button>

          {result && (
            <section className="mt-12 space-y-10" data-testid="compare-results">
              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <button onClick={exportCsv} className="btn-ghost px-4 py-2 text-sm inline-flex items-center gap-2" data-testid="export-csv-button">
                  <FileCsv size={16} weight="duotone" /> Export CSV
                </button>
                <button onClick={exportPdf} className="btn-ghost px-4 py-2 text-sm inline-flex items-center gap-2" data-testid="export-pdf-button">
                  <FilePdf size={16} weight="duotone" /> Export PDF
                </button>
                <button onClick={createShare} className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2" data-testid="share-report-button">
                  <Share size={16} weight="bold" /> Share link
                </button>
              </div>

              {/* Winner */}
              <div className="card-flat p-8 border-[hsl(var(--secondary))]">
                <div className="flex items-center gap-3 text-[hsl(var(--secondary))] mb-4">
                  <Trophy size={22} weight="duotone" />
                  <div className="eyebrow text-[hsl(var(--secondary))]">Winner</div>
                </div>
                <div className="font-serif text-4xl">{result.winner.name}</div>
                <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
                  <div>
                    Score <span className="text-foreground num-metric text-lg ml-1">{result.winner.total_score}</span>
                  </div>
                  <div>
                    Price <span className="text-foreground ml-1">{inr(result.winner.price)}</span>
                  </div>
                  <div>
                    ₹/sqft <span className="text-foreground ml-1">{result.winner.price_per_sqft}</span>
                  </div>
                </div>
              </div>

              {/* Ranking bars */}
              <div className="card-flat p-6">
                <div className="eyebrow mb-4">Total score</div>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={result.results} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" domain={[0, 10]} />
                      <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={120} />
                      <Tooltip cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar dataKey="total_score" fill="#C85A32" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Radar */}
              <div className="card-flat p-6">
                <div className="eyebrow mb-4">Breakdown radar</div>
                <div style={{ width: "100%", height: 360 }}>
                  <ResponsiveContainer>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="axis" stroke="hsl(var(--muted-foreground))" />
                      <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" domain={[0, 10]} />
                      {result.results.map((r, i) => (
                        <Radar
                          key={r.id}
                          name={r.name}
                          dataKey={r.name}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          fillOpacity={0.2}
                        />
                      ))}
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table */}
              <div className="card-flat overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b hairline">
                    <tr>
                      {["Rank", "Property", "Total", "Loc", "Amen", "Safe", "Comm", "Resale", "Price/Val"].map((h) => (
                        <th key={h} className="p-4 font-normal eyebrow">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={r.id} className="border-b hairline last:border-0">
                        <td className="p-4 num-metric text-xl">{i + 1}</td>
                        <td className="p-4">
                          <div className="font-serif text-lg">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{inr(r.price)}</div>
                        </td>
                        <td className="p-4 num-metric text-xl text-[hsl(var(--primary))]">{r.total_score}</td>
                        <td className="p-4">{r.breakdown.location}</td>
                        <td className="p-4">{r.breakdown.amenities}</td>
                        <td className="p-4">{r.breakdown.safety}</td>
                        <td className="p-4">{r.breakdown.commute}</td>
                        <td className="p-4">{r.breakdown.resale}</td>
                        <td className="p-4">{r.breakdown.price_value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
