import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { inr, inrFull } from "../lib/format";
import Disclaimer from "../components/Disclaimer";
import {
  TrendUp,
  TrendDown,
  House,
  Plus,
  Coins,
  Percent,
  ArrowRight,
  Bank,
  Receipt,
} from "@phosphor-icons/react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
} from "recharts";

const COLORS = ["#C85A32", "#B89B72", "#5E7C60", "#4A5568", "#8B6F47", "#6B4423"];

export default function Portfolio() {
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [vsMarkets, setVsMarkets] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, tRes] = await Promise.all([
          api.get("/portfolio/summary"),
          api.get("/portfolio/timeline"),
        ]);
        setSummary(sRes.data);
        setTimeline(tRes.data);
        // vs investments only makes sense when there are dated owned properties
        try {
          const { data } = await api.post("/portfolio/vs-investments", {});
          if (data.series && data.series.length > 0) setVsMarkets(data);
        } catch {}
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

  const empty = !summary || (summary.count === 0 && summary.sold_count === 0);

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
          <div className="grid md:grid-cols-5 gap-5 mb-10">
            <Tile
              label="Net worth"
              value={inr(summary.total_net_worth || summary.total_equity)}
              sub={
                summary.total_realized_gains
                  ? `includes ${inr(summary.total_realized_gains)} realized`
                  : "real-estate only"
              }
              icon={<Bank size={20} weight="duotone" />}
              testid="tile-networth"
            />
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
              label="Realized gains"
              value={inr(summary.total_realized_gains || 0)}
              sub={
                summary.sold_count
                  ? `from ${summary.sold_count} sale${summary.sold_count > 1 ? "s" : ""}`
                  : "no sales yet"
              }
              icon={<Receipt size={20} weight="duotone" />}
              accent={
                summary.total_realized_gains > 0
                  ? "good"
                  : summary.total_realized_gains < 0
                    ? "bad"
                    : undefined
              }
              testid="tile-realized"
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

          {/* Timeline */}
          {timeline?.series?.length > 0 && (
            <div className="card-flat p-6 mb-10" data-testid="portfolio-timeline">
              <div className="flex items-end justify-between mb-5">
                <div>
                  <div className="eyebrow mb-1">Your real-estate story</div>
                  <div className="font-serif text-2xl">
                    Net worth since {timeline.earliest_year}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {timeline.series.length} years · property value + realized cash − loan
                </div>
              </div>
              <div style={{ width: "100%", height: 340 }}>
                <ResponsiveContainer>
                  <AreaChart data={timeline.series}>
                    <defs>
                      <linearGradient id="gNW" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C85A32" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#C85A32" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gEq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#B89B72" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#B89B72" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => inr(v)} />
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="total_value"
                      name="Property value"
                      stroke="#B89B72"
                      fill="url(#gEq)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="net_worth"
                      name="Net worth"
                      stroke="#C85A32"
                      fill="url(#gNW)"
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="loan_balance"
                      name="Loan balance"
                      stroke="#4A5568"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    {summary.total_realized_gains ? (
                      <Line
                        type="stepAfter"
                        dataKey="realized_gains"
                        name="Realized cash"
                        stroke="#5E7C60"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* vs Markets */}
          {vsMarkets?.series?.length > 0 && (
            <div className="card-flat p-6 mb-10" data-testid="portfolio-vs-markets">
              <div className="flex items-end justify-between mb-5">
                <div>
                  <div className="eyebrow mb-1">Opportunity cost</div>
                  <div className="font-serif text-2xl">Your property vs the markets</div>
                </div>
                <div className="text-xs text-muted-foreground max-w-sm text-right">
                  Had you invested the same purchase capital, staggered on each buy date, at historical CAGRs.
                </div>
              </div>
              <div style={{ width: "100%", height: 340 }}>
                <ResponsiveContainer>
                  <AreaChart data={vsMarkets.series}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => inr(v)} />
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="property" name="Property" stroke="#C85A32" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="equity" name={`Equity ${vsMarkets.returns.equity}%`} stroke="#5E7C60" strokeWidth={1.8} dot={false} />
                    <Line type="monotone" dataKey="mutual_funds" name={`MF ${vsMarkets.returns.mutual_funds}%`} stroke="#B89B72" strokeWidth={1.8} dot={false} />
                    <Line type="monotone" dataKey="gold" name={`Gold ${vsMarkets.returns.gold}%`} strokeDasharray="4 4" stroke="#D4A15E" strokeWidth={1.8} dot={false} />
                    <Line type="monotone" dataKey="silver" name={`Silver ${vsMarkets.returns.silver}%`} strokeDasharray="4 4" stroke="#A39C93" strokeWidth={1.8} dot={false} />
                    <Line type="monotone" dataKey="fd" name={`FD ${vsMarkets.returns.fd}%`} strokeDasharray="2 6" stroke="#4A5568" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-5 border-t hairline pt-5">
                <div className="eyebrow mb-3">
                  Final verdict · winner:{" "}
                  <span className={vsMarkets.summary.winner === "Property" ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--secondary))]"}>
                    {vsMarkets.summary.winner}
                  </span>
                </div>
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div className="flex justify-between p-3 border hairline">
                    <span className="text-muted-foreground">Property today</span>
                    <span className="num-metric">{inr(vsMarkets.summary.property_current)}</span>
                  </div>
                  {vsMarkets.summary.comparisons.map((c) => (
                    <div key={c.asset} className="flex justify-between p-3 border hairline">
                      <span className="text-muted-foreground capitalize">{c.asset.replace("_", " ")}</span>
                      <span className={`num-metric ${c.delta_vs_property >= 0 ? "text-[hsl(var(--secondary))]" : "text-destructive"}`}>
                        {inr(c.final)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
            {summary.items.length === 0 ? (
              <div className="card-flat p-6 text-sm text-muted-foreground md:col-span-2" data-testid="owned-empty">
                No owned properties yet. Add one via the Properties page.
              </div>
            ) : (
              summary.items.map((p) => (
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
              ))
            )}
          </div>

          {/* Sold ledger */}
          {summary.sold_items && summary.sold_items.length > 0 && (
            <div className="mt-12">
              <div className="flex items-end justify-between mb-3">
                <div className="eyebrow">Sold ledger</div>
                <div className="text-xs text-muted-foreground">
                  Realized:{" "}
                  <span className={summary.total_realized_gains >= 0 ? "text-[hsl(var(--secondary))]" : "text-destructive"}>
                    {summary.total_realized_gains >= 0 ? "+" : ""}
                    {inr(summary.total_realized_gains)}
                  </span>
                </div>
              </div>
              <div className="card-flat overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b hairline">
                    <tr>
                      {["Property", "Bought", "Sold", "Purchase", "Sale", "Gain", "Return"].map((h) => (
                        <th key={h} className="p-4 font-normal eyebrow">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sold_items.map((s) => (
                      <tr key={s.id} className="border-b hairline last:border-0" data-testid={`sold-row-${s.id}`}>
                        <td className="p-4">
                          <div className="font-serif text-lg">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.type} · {s.location}
                          </div>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {s.purchase_date
                            ? new Date(s.purchase_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {s.sold_date
                            ? new Date(s.sold_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="p-4">{inr(s.purchase_price)}</td>
                        <td className="p-4">{inr(s.sold_price)}</td>
                        <td className={`p-4 num-metric ${s.gain >= 0 ? "text-[hsl(var(--secondary))]" : "text-destructive"}`}>
                          {s.gain >= 0 ? "+" : ""}
                          {inr(s.gain)}
                        </td>
                        <td className={`p-4 num-metric ${s.gain_pct >= 0 ? "text-[hsl(var(--secondary))]" : "text-destructive"}`}>
                          {s.gain_pct >= 0 ? "+" : ""}
                          {s.gain_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
      <Disclaimer />
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
