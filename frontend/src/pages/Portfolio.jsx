import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { inr, inrFull } from "../lib/format";
import {
  TrendUp,
  TrendDown,
  House,
  Plus,
  Coins,
  Percent,
  ArrowRight,
  Bank,
} from "@phosphor-icons/react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#C85A32", "#B89B72", "#5E7C60", "#4A5568", "#8B6F47", "#6B4423"];

export default function Portfolio() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/portfolio/summary");
        setSummary(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <div className="max-w-7xl mx-auto px-8 py-10 text-muted-foreground" data-testid="portfolio-loading">
        Loading portfolio…
      </div>
    );

  const empty = !summary || summary.count === 0;

  return (
    <div className="max-w-7xl mx-auto px-8 py-10" data-testid="portfolio-page">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="eyebrow mb-2">Your portfolio</div>
          <h1 className="font-serif text-5xl">Properties you already own.</h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Net worth from real estate, monthly cashflow, and how each asset has appreciated
            since the day you signed.
          </p>
        </div>
        <Link to="/app/properties" className="btn-primary px-5 py-3 inline-flex items-center gap-2 text-sm" data-testid="portfolio-add">
          <Plus size={16} weight="bold" /> Add owned property
        </Link>
      </div>

      {empty ? (
        <div className="card-flat p-12 text-center" data-testid="portfolio-empty">
          <div className="font-serif text-3xl mb-3">Nothing owned yet.</div>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Already have a home or two? Add them with status &quot;Owned&quot; to see your real-estate net worth here.
          </p>
          <Link to="/app/properties" className="btn-primary px-5 py-3 inline-flex items-center gap-2 text-sm">
            <Plus size={16} weight="bold" /> Add property
          </Link>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid md:grid-cols-4 gap-5 mb-10">
            <Tile
              label="Current value"
              value={inr(summary.total_current_value)}
              sub={`across ${summary.count} propert${summary.count === 1 ? "y" : "ies"}`}
              icon={<House size={20} weight="duotone" />}
              testid="tile-value"
            />
            <Tile
              label="Total equity"
              value={inr(summary.total_equity)}
              sub={`loan outstanding: ${inr(summary.total_loan_balance)}`}
              icon={<Bank size={20} weight="duotone" />}
              testid="tile-equity"
            />
            <Tile
              label="Net appreciation"
              value={`${summary.total_appreciation_pct >= 0 ? "+" : ""}${summary.total_appreciation_pct}%`}
              sub={inr(summary.total_appreciation_inr)}
              icon={
                summary.total_appreciation_pct >= 0 ? (
                  <TrendUp size={20} weight="duotone" />
                ) : (
                  <TrendDown size={20} weight="duotone" />
                )
              }
              accent={summary.total_appreciation_pct >= 0 ? "good" : "bad"}
              testid="tile-appreciation"
            />
            <Tile
              label="Monthly cashflow"
              value={inr(summary.net_monthly_cashflow)}
              sub={`rent ${inr(summary.total_monthly_rent)} − EMI ${inr(summary.total_monthly_emi)}`}
              icon={<Coins size={20} weight="duotone" />}
              accent={summary.net_monthly_cashflow >= 0 ? "good" : "bad"}
              testid="tile-cashflow"
            />
          </div>

          {/* Allocation chart */}
          {summary.items.length > 1 && (
            <div className="card-flat p-6 mb-10">
              <div className="eyebrow mb-4">Value allocation</div>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={summary.items}
                      dataKey="current_value"
                      nameKey="name"
                      outerRadius={95}
                      innerRadius={55}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {summary.items.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Owned properties list */}
          <div className="mb-3 eyebrow">Owned properties</div>
          <div className="grid md:grid-cols-2 gap-6">
            {summary.items.map((p) => (
              <div key={p.id} className="card-flat p-6" data-testid={`portfolio-item-${p.id}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="eyebrow">{p.type}</div>
                    <div className="font-serif text-2xl mt-1">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.location}
                      {p.purchase_date ? ` · bought ${new Date(p.purchase_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : ""}
                    </div>
                  </div>
                  <div
                    className={`text-sm inline-flex items-center gap-1 px-2 py-1 border hairline ${
                      p.appreciation_pct >= 0 ? "text-[hsl(var(--secondary))]" : "text-destructive"
                    }`}
                  >
                    {p.appreciation_pct >= 0 ? <TrendUp size={14} /> : <TrendDown size={14} />}
                    {p.appreciation_pct >= 0 ? "+" : ""}
                    {p.appreciation_pct}%
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 border-t hairline pt-5">
                  <Stat label="Current value" value={inr(p.current_value)} />
                  <Stat label="Purchase price" value={inr(p.purchase_price)} />
                  <Stat label="Equity" value={inr(p.equity)} accent="good" />
                  <Stat label="Loan balance" value={inr(p.loan_balance)} />
                </div>

                <div className="grid grid-cols-3 gap-3 border-t hairline mt-5 pt-5 text-xs">
                  <MiniStat label="EMI" value={inr(p.emi)} />
                  <MiniStat
                    label="Rent"
                    value={p.rented ? inr(p.monthly_rent) : "—"}
                    muted={!p.rented}
                  />
                  <MiniStat
                    label="Cashflow"
                    value={inr(p.monthly_cashflow)}
                    accent={p.monthly_cashflow >= 0 ? "good" : "bad"}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Insight strip */}
          <div className="mt-10 card-flat p-6 border-[hsl(var(--secondary))]">
            <div className="flex items-start gap-4">
              <div className="text-[hsl(var(--secondary))] mt-1">
                <Percent size={20} weight="duotone" />
              </div>
              <div className="flex-1">
                <div className="font-serif text-2xl mb-1">
                  {summary.net_monthly_cashflow >= 0
                    ? "Your portfolio is self-funding."
                    : "Your portfolio is a monthly outflow."}
                </div>
                <p className="text-muted-foreground text-sm">
                  Net monthly cashflow of{" "}
                  <span className="text-foreground">{inr(summary.net_monthly_cashflow)}</span>.{" "}
                  {summary.net_monthly_cashflow < 0
                    ? "That's fine if appreciation is outpacing it — which it "
                    : "On top of "}
                  {summary.total_appreciation_pct >= 0 ? "is" : "isn't"}: you&apos;re{" "}
                  <span className="text-foreground">
                    {summary.total_appreciation_pct >= 0 ? "up" : "down"}{" "}
                    {Math.abs(summary.total_appreciation_pct)}%
                  </span>{" "}
                  since purchase.
                </p>
                <Link
                  to="/app/advisor"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-[hsl(var(--secondary))] hover:text-foreground transition"
                  data-testid="portfolio-ask-advisor"
                >
                  Ask the advisor what to do next <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, icon, accent, testid }) {
  const color =
    accent === "good"
      ? "text-[hsl(var(--secondary))]"
      : accent === "bad"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="card-flat p-5" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="eyebrow">{label}</div>
        <div className="text-[hsl(var(--secondary))]">{icon}</div>
      </div>
      <div className={`num-metric text-3xl mt-4 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Stat({ label, value, accent }) {
  const color =
    accent === "good"
      ? "text-[hsl(var(--secondary))]"
      : accent === "bad"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div>
      <div className="eyebrow text-[0.65rem]">{label}</div>
      <div className={`num-metric text-xl mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, accent, muted }) {
  const color = muted
    ? "text-muted-foreground"
    : accent === "good"
      ? "text-[hsl(var(--secondary))]"
      : accent === "bad"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div>
      <div className="eyebrow text-[0.6rem]">{label}</div>
      <div className={`text-sm mt-1 ${color}`}>{value}</div>
    </div>
  );
}
