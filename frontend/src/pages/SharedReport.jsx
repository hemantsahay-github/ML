import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { inr, inrFull } from "../lib/format";
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
  LineChart,
  Line,
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

  if (data.kind === "odcf") {
    return <OdcfSharedReport data={data} />;
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


const PLAN_LABELS = {
  rtm: "Ready-to-Move",
  "10_90": "10:90",
  "20_80": "20:80",
  "30_70": "30:70",
  clp: "Construction-Linked (CLP)",
  subvention: "Subvention",
};

function OdcfSharedReport({ data }) {
  const r = data.result || {};
  const inp = data.inputs || {};
  const series = r.monthly_series || [];
  const chart = series.map((s) => ({
    month: s.month,
    "Loan balance": s.loan_balance,
    "OD balance": s.od_balance,
    "Net cashflow": s.net_cashflow,
  }));
  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="share-odcf">
      <header className="border-b hairline">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 border hairline flex items-center justify-center">
              <span className="font-serif text-xl leading-none">E</span>
            </div>
            <span className="font-serif text-2xl tracking-tight">Estima</span>
          </Link>
          <Link to="/register" className="btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5" data-testid="share-odcf-cta">
            Run your own <ArrowRight size={12} weight="bold" />
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="eyebrow mb-3">Overdraft cashflow scenario</div>
        <h1 className="font-serif text-5xl mb-4" data-testid="share-odcf-title">{data.title}</h1>
        <div className="text-muted-foreground text-sm mb-12">
          Prepared by {data.owner_name || "an Estima user"} · {new Date(data.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </div>

        <div className="grid md:grid-cols-4 gap-5 mb-10">
          <OdKpi label="XIRR on down-payment" value={`${r.xirr_pct}%`} big testid="share-odcf-xirr" />
          <OdKpi label="Down payment" value={inr(r.down_payment)} />
          <OdKpi label="Loan" value={inr(r.loan_amount)} />
          <OdKpi label="Post-possession EMI" value={`${inr(r.emi_post_possession)}/mo`} />
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-10">
          <OdKpi label="Min OD for CF-positive" value={inr(r.min_od_balance_for_cf_positive)} />
          <OdKpi label="Total interest saved" value={inr(r.total_interest_saved_via_od)} tone="secondary" />
          <OdKpi label="Avg monthly cashflow" value={`${inr(r.avg_monthly_cashflow_post_possession)}/mo`} tone={r.avg_monthly_cashflow_post_possession >= 0 ? "secondary" : "destructive"} />
        </div>

        <div className="card-flat p-6 mb-10">
          <div className="eyebrow mb-4">Assumptions</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
            <OdRow k="Property price" v={inrFull(inp.property_price)} />
            <OdRow k="Builder plan" v={PLAN_LABELS[inp.builder_plan] || inp.builder_plan} />
            <OdRow k="Possession" v={inp.builder_plan === "rtm" ? "Ready" : `${inp.possession_months} mo`} />
            <OdRow k="Monthly rent" v={`${inrFull(inp.monthly_rent)}/mo`} />
            <OdRow k="Loan rate" v={`${inp.loan_rate}%`} />
            <OdRow k="Loan tenure" v={`${inp.loan_tenure_years} yrs`} />
            <OdRow k="Surplus in OD (day 1)" v={inrFull(inp.surplus_cash_today)} />
            <OdRow k="Monthly OD top-up" v={`${inrFull(inp.monthly_od_topup)}/mo`} />
            <OdRow k="Appreciation" v={`${inp.appreciation_pct}%/yr`} />
          </div>
        </div>

        {chart.length > 0 && (
          <div className="card-flat p-6 mb-10">
            <div className="eyebrow mb-4">Loan balance vs OD balance (every 6 months)</div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip formatter={(v) => inr(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="Loan balance" stroke="#C85A32" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="OD balance" stroke="#B89B72" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {r.narrative?.length > 0 && (
          <div className="card-flat p-8 mb-10">
            <div className="eyebrow mb-4">Narrative</div>
            <ul className="space-y-3" data-testid="share-odcf-narrative">
              {r.narrative.map((n, i) => (
                <li key={`${n.slice(0, 24)}-${i}`} className="flex gap-3 text-sm">
                  <span className="text-[hsl(var(--secondary))]">▸</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-center border-t hairline pt-16">
          <div className="font-serif text-3xl mb-4">Model your own overdraft play.</div>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Estima is free. Run rent-vs-buy, compare flats, and get an AI verdict on your shortlist.
          </p>
          <Link to="/register" className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2" data-testid="share-odcf-footer-cta">
            Start free <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function OdKpi({ label, value, tone, big, testid }) {
  const toneClass = tone === "secondary" ? "text-[hsl(var(--secondary))]" : tone === "destructive" ? "text-destructive" : "text-foreground";
  const sizeClass = big ? "num-metric text-4xl" : "num-metric text-xl";
  return (
    <div className="card-flat p-5" data-testid={testid}>
      <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{label}</div>
      <div className={`${sizeClass} ${toneClass}`}>{value}</div>
    </div>
  );
}

function OdRow({ k, v }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-sm">{v}</div>
    </div>
  );
}
