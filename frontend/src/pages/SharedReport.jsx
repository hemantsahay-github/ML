import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { inr } from "../lib/format";
import { Trophy, ArrowRight } from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Chart config (module-scope — stable refs)
const CHART_LEFT_MARGIN = { left: 40 };
const SCORE_DOMAIN = [0, 10];
const TOOLTIP_CURSOR = { fill: "hsl(var(--muted))" };
const BAR_RADIUS = [0, 2, 2, 0];

export default function SharedReport() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    try {
      const { data: res } = await axios.get(`${BACKEND_URL}/api/shares/${id}`);
      setData(res);
    } catch (e) {
      setError(e.response?.status === 404 ? "This report doesn't exist or has been removed." : "Couldn't load report.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadReport(); }, [loadReport]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="share-loading">
        Loading report…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" data-testid="share-error">
        <div className="font-serif text-4xl mb-3">Not found.</div>
        <p className="text-muted-foreground mb-8">{error}</p>
        <Link to="/" className="btn-primary px-5 py-3 text-sm">
          Back to Estima
        </Link>
      </div>
    );
  }

  const radarData = ["location", "amenities", "safety", "commute", "resale", "price_value"].map((axis) => {
    const entry = { axis: axis.replace("_", " ") };
    data.results.forEach((r) => {
      entry[r.name] = r.breakdown[axis];
    });
    return entry;
  });

  const CHART_COLORS = ["#C85A32", "#B89B72", "#5E7C60", "#4A5568"];

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="share-page">
      {/* Header */}
      <header className="border-b hairline">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 border hairline flex items-center justify-center">
              <span className="font-serif text-xl leading-none">E</span>
            </div>
            <span className="font-serif text-2xl tracking-tight">Estima</span>
          </Link>
          <Link to="/register" className="btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5" data-testid="share-cta-register">
            Build your own <ArrowRight size={12} weight="bold" />
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="eyebrow mb-3">Shared property report</div>
        <h1 className="font-serif text-5xl mb-4">{data.title}</h1>
        <div className="text-muted-foreground text-sm mb-12">
          Prepared by {data.owner_name || "an Estima user"} · {new Date(data.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </div>

        {/* Winner */}
        {data.winner && (
          <div className="card-flat p-8 border-[hsl(var(--secondary))] mb-10">
            <div className="flex items-center gap-3 text-[hsl(var(--secondary))] mb-3">
              <Trophy size={22} weight="duotone" />
              <div className="eyebrow text-[hsl(var(--secondary))]">Recommended winner</div>
            </div>
            <div className="font-serif text-4xl">{data.winner.name}</div>
            <div className="flex flex-wrap gap-6 mt-4 text-sm text-muted-foreground">
              <div>
                Score <span className="text-foreground num-metric text-lg ml-1">{data.winner.total_score}</span>
              </div>
              <div>
                Price <span className="text-foreground ml-1">{inr(data.winner.price)}</span>
              </div>
              <div>
                ₹/sqft <span className="text-foreground ml-1">{data.winner.price_per_sqft}</span>
              </div>
            </div>
          </div>
        )}

        {/* Bars */}
        <div className="card-flat p-6 mb-10">
          <div className="eyebrow mb-4">Total score</div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.results} layout="vertical" margin={CHART_LEFT_MARGIN}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" domain={SCORE_DOMAIN} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={120} />
                <Tooltip cursor={TOOLTIP_CURSOR} />
                <Bar dataKey="total_score" fill="#C85A32" radius={BAR_RADIUS} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar */}
        <div className="card-flat p-6 mb-10">
          <div className="eyebrow mb-4">Breakdown radar</div>
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="axis" stroke="hsl(var(--muted-foreground))" />
                <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" domain={SCORE_DOMAIN} />
                {data.results.map((r, i) => (
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
        <div className="card-flat overflow-x-auto mb-16">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b hairline">
              <tr>
                {["Rank", "Property", "Total", "Loc", "Amen", "Safe", "Comm", "Resale", "Price/Val"].map((h) => (
                  <th key={h} className="p-4 font-normal eyebrow">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.results.map((r, i) => (
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

        {/* CTA */}
        <div className="text-center border-t hairline pt-16">
          <div className="font-serif text-3xl mb-4">Want to model your own?</div>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Estima is free. Compare your own shortlist, run rent-vs-buy, and get an AI verdict.
          </p>
          <Link to="/register" className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2" data-testid="share-footer-cta">
            Start free <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </div>
    </div>
  );
}
