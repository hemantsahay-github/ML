import { useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr, inrFull } from "../lib/format";
import Disclaimer from "../components/Disclaimer";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

const tabs = [
  { id: "emi", label: "EMI" },
  { id: "rentbuy", label: "Rent vs Buy" },
  { id: "invest", label: "Property vs MF vs Equity" },
  { id: "cashflow", label: "Cashflow-positive finder" },
  { id: "resale", label: "Resale estimator" },
  { id: "optimizer", label: "Loan optimizer" },
  { id: "builder", label: "Builder plan" },
];

export default function Calculators() {
  const [tab, setTab] = useState("emi");
  return (
    <div className="max-w-7xl mx-auto px-8 py-10" data-testid="calculators-page">
      <div className="mb-8">
        <div className="eyebrow mb-2">Calculators</div>
        <h1 className="font-serif text-5xl">The brutal math.</h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          EMI, rent-vs-buy, property vs markets, cashflow-positive finder, resale
          estimator and a loan optimizer. Every assumption is editable.
        </p>
      </div>

      <div className="border-b hairline mb-8 flex flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
            className={`px-5 py-3 text-sm -mb-px border-b-2 transition ${
              tab === t.id
                ? "border-[hsl(var(--primary))] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "emi" && <EmiCalc />}
      {tab === "rentbuy" && <RentBuyCalc />}
      {tab === "invest" && <InvestCalc />}
      {tab === "cashflow" && <CashflowPositiveCalc />}
      {tab === "resale" && <ResaleEstimator />}
      {tab === "optimizer" && <LoanOptimizer />}
      {tab === "builder" && <BuilderPlan />}

      <Disclaimer />
    </div>
  );
}

/* --------------------- Builder payment plan --------------------- */
function BuilderPlan() {
  const [form, setForm] = useState({
    property_price: 9000000,
    possession_months: 36,
    loan_rate: 8.5,
    loan_tenure_years: 20,
    opportunity_return: 11,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/builder-plan", form);
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-8">
      <div className="card-flat p-6 space-y-2">
        <NumberField label="Property price (₹)" value={form.property_price} onChange={(v) => setForm({ ...form, property_price: v })} />
        <NumberField label="Months to possession" value={form.possession_months} onChange={(v) => setForm({ ...form, possession_months: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Loan %" value={form.loan_rate} step="0.1" onChange={(v) => setForm({ ...form, loan_rate: v })} />
          <NumberField label="Tenure" value={form.loan_tenure_years} onChange={(v) => setForm({ ...form, loan_tenure_years: v })} />
        </div>
        <NumberField label="Opportunity return % (MF)" value={form.opportunity_return} step="0.1" onChange={(v) => setForm({ ...form, opportunity_return: v })} />
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="builder-run-button">
          {loading ? "Computing…" : "Compare plans"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            Builders pitch four flavours of payment plans: <span className="text-foreground">CLP</span> (construction-linked), <span className="text-foreground">10:90</span>, <span className="text-foreground">20:80</span>, and <span className="text-foreground">subvention</span> (pre-EMI paid by builder). Estima computes the effective total cost of each including pre-EMI and the opportunity cost of idle cash, and declares the winner.
          </div>
        ) : (
          <div className="space-y-6" data-testid="builder-result">
            <div className="card-flat p-8 border-[hsl(var(--secondary))]">
              <div className="eyebrow text-[hsl(var(--secondary))] mb-2">Best plan for you</div>
              <div className="font-serif text-4xl">{res.winner_name}</div>
              <div className="text-sm text-muted-foreground mt-2">Savings vs worst plan: {inr(res.savings_vs_worst)}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {res.plans.map((p) => (
                <div
                  key={p.id}
                  className={`card-flat p-6 ${p.id === res.winner ? "border-[hsl(var(--secondary))]" : ""}`}
                  data-testid={`builder-plan-${p.id}`}
                >
                  <div className="font-serif text-2xl mb-1">{p.name}</div>
                  <div className="text-xs text-muted-foreground mb-4">{p.description}</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Row label="Down payment" v={inr(p.down_payment)} />
                    <Row label="Loan" v={inr(p.loan_amount)} />
                    <Row label="Pre-EMI (builder)" v={inr(p.pre_emi_total - p.pre_emi_by_buyer)} accent="good" />
                    <Row label="Pre-EMI (buyer)" v={inr(p.pre_emi_by_buyer)} accent={p.pre_emi_by_buyer > 0 ? "bad" : undefined} />
                    <Row label="EMI post-possession" v={inr(p.monthly_emi_after_possession)} />
                    <Row label="Opp. cost (idle cash)" v={inr(p.opportunity_cost_during_build)} />
                  </div>
                  <div className="mt-4 pt-4 border-t hairline flex justify-between items-center">
                    <span className="eyebrow">Effective total cost</span>
                    <span className={`num-metric text-xl ${p.id === res.winner ? "text-[hsl(var(--secondary))]" : ""}`}>{inr(p.effective_total_cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, v, accent }) {
  const c = accent === "good" ? "text-[hsl(var(--secondary))]" : accent === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num-metric ${c}`}>{v}</span>
    </div>
  );
}

/* --------------------- Resale estimator --------------------- */
function ResaleEstimator() {
  const [form, setForm] = useState({
    purchase_price: 7500000,
    current_value: 9500000,
    outstanding_loan: 4800000,
    years_held: 4,
    appreciation_pct: 6,
    maintenance_monthly: 3500,
    property_tax_yearly: 15000,
    rental_income_monthly: 28000,
    broker_fee_pct: 1,
    ltcg_pct: 20,
    target_profit_inr: 500000,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/resale-estimate", form);
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-8">
      <div className="card-flat p-6 space-y-2">
        <NumberField label="Purchase price (₹)" value={form.purchase_price} onChange={(v) => setForm({ ...form, purchase_price: v })} />
        <NumberField label="Current value (₹) — optional" value={form.current_value} onChange={(v) => setForm({ ...form, current_value: v })} />
        <NumberField label="Outstanding loan (₹)" value={form.outstanding_loan} onChange={(v) => setForm({ ...form, outstanding_loan: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Years held" value={form.years_held} step="0.5" onChange={(v) => setForm({ ...form, years_held: v })} />
          <NumberField label="Appr. % p.a." value={form.appreciation_pct} step="0.1" onChange={(v) => setForm({ ...form, appreciation_pct: v })} />
        </div>
        <NumberField label="Maint / month (₹)" value={form.maintenance_monthly} onChange={(v) => setForm({ ...form, maintenance_monthly: v })} />
        <NumberField label="Tax / year (₹)" value={form.property_tax_yearly} onChange={(v) => setForm({ ...form, property_tax_yearly: v })} />
        <NumberField label="Rental income ₹/mo" value={form.rental_income_monthly} onChange={(v) => setForm({ ...form, rental_income_monthly: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Broker fee %" value={form.broker_fee_pct} step="0.1" onChange={(v) => setForm({ ...form, broker_fee_pct: v })} />
          <NumberField label="LTCG %" value={form.ltcg_pct} step="0.5" onChange={(v) => setForm({ ...form, ltcg_pct: v })} />
        </div>
        <NumberField label="Target profit (₹)" value={form.target_profit_inr} onChange={(v) => setForm({ ...form, target_profit_inr: v })} />
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="resale-run-button">
          {loading ? "Computing…" : "Estimate resale"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            Tell Estima what you paid, the loan still outstanding, and the carrying costs. We&apos;ll compute the sale price at which you exit <span className="text-foreground">whole</span>, and the price that nets you your target profit — after broker fees and LTCG.
          </div>
        ) : (
          <div className="space-y-6" data-testid="resale-result">
            <div className="grid md:grid-cols-2 gap-4">
              <Metric label="Breakeven sale price" value={inrFull(res.breakeven_sale_price)} />
              <Metric label={`For target profit`} value={inrFull(res.target_profit_sale_price)} accent="good" />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <Metric label="Projected sale (at appr.)" value={inr(res.projected_sale_price)} />
              <Metric label="Projected net in hand" value={inr(res.projected_net_in_hand)} />
              <Metric label="Implied CAGR" value={`${res.implied_annual_return_pct}%`} />
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-3">Cost breakdown during hold</div>
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <LabRow label="Total carrying cost" v={inr(res.total_carrying_cost)} />
                <LabRow label="Total rental income" v={inr(res.total_rental_income)} accent="good" />
                <LabRow label="Net carrying cost" v={inr(res.net_carrying_cost)} accent={res.net_carrying_cost > 0 ? "bad" : "good"} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------- Loan optimizer --------------------- */
function LoanOptimizer() {
  const [form, setForm] = useState({
    property_price: 8000000,
    monthly_rent: 32000,
    loan_rate: 8.5,
    loan_tenure_years: 20,
    maintenance_monthly: 3500,
    property_tax_yearly: 12000,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/loan-optimizer", form);
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-8">
      <div className="card-flat p-6 space-y-2">
        <NumberField label="Property price (₹)" value={form.property_price} onChange={(v) => setForm({ ...form, property_price: v })} />
        <NumberField label="Monthly rent (₹)" value={form.monthly_rent} onChange={(v) => setForm({ ...form, monthly_rent: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Loan %" value={form.loan_rate} step="0.1" onChange={(v) => setForm({ ...form, loan_rate: v })} />
          <NumberField label="Tenure" value={form.loan_tenure_years} onChange={(v) => setForm({ ...form, loan_tenure_years: v })} />
        </div>
        <NumberField label="Maint / month (₹)" value={form.maintenance_monthly} onChange={(v) => setForm({ ...form, maintenance_monthly: v })} />
        <NumberField label="Tax / year (₹)" value={form.property_tax_yearly} onChange={(v) => setForm({ ...form, property_tax_yearly: v })} />
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="optimizer-run-button">
          {loading ? "Crunching…" : "Find sweet spot"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            Sweep every down-payment % from 5 to 100. Estima surfaces the cashflow-neutral breakeven, the maximum-cashflow setup, and the best cash-on-cash return for your capital.
          </div>
        ) : (
          <div className="space-y-6" data-testid="optimizer-result">
            <div className="grid md:grid-cols-3 gap-4">
              <Highlight
                label="Cashflow-neutral"
                value={res.cashflow_neutral_min_dp_pct ? `${res.cashflow_neutral_min_dp_pct}% down` : "Not within range"}
                sub={res.cashflow_neutral ? `DP ${inr(res.cashflow_neutral.down_payment)} · EMI ${inr(res.cashflow_neutral.emi)}` : ""}
                accent="primary"
              />
              <Highlight
                label="Max monthly cashflow"
                value={inr(res.max_cashflow.monthly_cashflow)}
                sub={`at ${res.max_cashflow.down_payment_pct}% down`}
                accent="good"
              />
              {res.best_cash_on_cash_return && (
                <Highlight
                  label="Best cash-on-cash"
                  value={`${res.best_cash_on_cash_return.cash_on_cash_return_pct}%`}
                  sub={`at ${res.best_cash_on_cash_return.down_payment_pct}% down`}
                  accent="good"
                />
              )}
            </div>
            <div className="card-flat overflow-x-auto">
              <div className="p-4 eyebrow border-b hairline">Down-payment sweep</div>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b hairline">
                  <tr>
                    {["DP %", "DP", "Loan", "EMI", "Cashflow / mo", "CoC return"].map((h) => (
                      <th key={h} className="p-3 font-normal eyebrow">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.grid.map((g, i) => (
                    <tr
                      key={i}
                      className={`border-b hairline last:border-0 ${
                        res.cashflow_neutral && g.down_payment_pct === res.cashflow_neutral.down_payment_pct
                          ? "bg-[hsl(var(--muted))]"
                          : ""
                      }`}
                      data-testid={`optimizer-row-${g.down_payment_pct}`}
                    >
                      <td className="p-3 num-metric">{g.down_payment_pct}%</td>
                      <td className="p-3 text-xs">{inr(g.down_payment)}</td>
                      <td className="p-3 text-xs">{inr(g.loan)}</td>
                      <td className="p-3 text-xs">{inr(g.emi)}</td>
                      <td className={`p-3 num-metric ${g.monthly_cashflow >= 0 ? "text-[hsl(var(--secondary))]" : "text-destructive"}`}>
                        {g.monthly_cashflow >= 0 ? "+" : ""}
                        {inr(g.monthly_cashflow)}
                      </td>
                      <td className="p-3 text-xs">{g.cash_on_cash_return_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Highlight({ label, value, sub, accent }) {
  const color =
    accent === "primary"
      ? "text-[hsl(var(--primary))]"
      : accent === "good"
        ? "text-[hsl(var(--secondary))]"
        : "text-foreground";
  return (
    <div className="card-flat p-5">
      <div className="eyebrow mb-2">{label}</div>
      <div className={`num-metric text-2xl ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function LabRow({ label, v, accent }) {
  const color = accent === "good" ? "text-[hsl(var(--secondary))]" : accent === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex justify-between p-3 border hairline">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num-metric ${color}`}>{v}</span>
    </div>
  );
}

function CashflowPositiveCalc() {
  const [form, setForm] = useState({
    monthly_rent: 45000,
    loan_rate: 8.5,
    loan_tenure_years: 20,
    maintenance_monthly: 3500,
    property_tax_yearly: 15000,
    down_payment_pct: 20,
    target_cashflow_monthly: 0,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/cashflow-positive", form);
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-8">
      <div className="card-flat p-6 space-y-2">
        <NumberField label="Expected monthly rent (₹)" value={form.monthly_rent} onChange={(v) => setForm({ ...form, monthly_rent: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Loan %" value={form.loan_rate} step="0.1" onChange={(v) => setForm({ ...form, loan_rate: v })} />
          <NumberField label="Tenure" value={form.loan_tenure_years} onChange={(v) => setForm({ ...form, loan_tenure_years: v })} />
        </div>
        <NumberField label="Maint / month (₹)" value={form.maintenance_monthly} onChange={(v) => setForm({ ...form, maintenance_monthly: v })} />
        <NumberField label="Property tax / year (₹)" value={form.property_tax_yearly} onChange={(v) => setForm({ ...form, property_tax_yearly: v })} />
        <NumberField label="Down payment %" value={form.down_payment_pct} step="0.5" onChange={(v) => setForm({ ...form, down_payment_pct: v })} />
        <NumberField label="Target cashflow ₹/mo" value={form.target_cashflow_monthly} onChange={(v) => setForm({ ...form, target_cashflow_monthly: v })} />
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="cashflow-run-button">
          {loading ? "Crunching…" : "Find the max price"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            A cashflow-positive rental is one where the <span className="text-foreground">rent exceeds EMI + maintenance + taxes</span>. Tell Estima the rent you can realistically charge and the max affordable ticket size — at the loan terms — is computed instantly.
          </div>
        ) : !res.feasible ? (
          <div className="card-flat p-8 border-destructive" data-testid="cashflow-infeasible">
            <div className="font-serif text-3xl mb-3 text-destructive">Not feasible.</div>
            <p className="text-muted-foreground">{res.reason}</p>
          </div>
        ) : (
          <div className="space-y-6" data-testid="cashflow-result">
            <div className="card-flat p-8 border-[hsl(var(--secondary))]" data-testid="cashflow-max-price">
              <div className="eyebrow text-[hsl(var(--secondary))] mb-2">Maximum cashflow-positive price</div>
              <div className="num-metric text-5xl mb-3">{inrFull(res.max_price)}</div>
              <div className="text-sm text-muted-foreground">
                At this price the rent of{" "}
                <span className="text-foreground">{inrFull(form.monthly_rent)}</span> exactly covers EMI + costs.
                Below this, every rupee is surplus.
              </div>
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              <Metric label="Loan amount" value={inr(res.max_loan)} />
              <Metric label="Down payment" value={inr(res.down_payment)} />
              <Metric label="Monthly EMI" value={inrFull(res.emi)} />
              <Metric label="Gross yield" value={`${res.gross_yield_pct}%`} />
            </div>
            <div className="card-flat overflow-x-auto">
              <div className="p-4 eyebrow border-b hairline">If you pay less…</div>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b hairline">
                  <tr>
                    {["Price", "Loan", "Down", "EMI", "Cashflow / month", "Gross yield"].map((h) => (
                      <th key={h} className="p-4 font-normal eyebrow">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.breakdown.map((r, i) => (
                    <tr key={i} className="border-b hairline last:border-0" data-testid={`cashflow-row-${i}`}>
                      <td className="p-4">{inr(r.price)}</td>
                      <td className="p-4">{inr(r.loan)}</td>
                      <td className="p-4">{inr(r.down_payment)}</td>
                      <td className="p-4">{inr(r.emi)}</td>
                      <td className={`p-4 num-metric ${r.cashflow >= 0 ? "text-[hsl(var(--secondary))]" : "text-destructive"}`}>
                        {r.cashflow >= 0 ? "+" : ""}
                        {inr(r.cashflow)}
                      </td>
                      <td className="p-4">{r.gross_yield_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- EMI ---------------------------- */
function EmiCalc() {
  const [form, setForm] = useState({ principal: 5000000, annual_rate: 8.5, tenure_years: 20 });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/emi", form);
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-8">
      <div className="card-flat p-6">
        <NumberField label="Loan principal (₹)" value={form.principal} onChange={(v) => setForm({ ...form, principal: v })} />
        <NumberField label="Annual rate (%)" value={form.annual_rate} step="0.1" onChange={(v) => setForm({ ...form, annual_rate: v })} />
        <NumberField label="Tenure (years)" value={form.tenure_years} onChange={(v) => setForm({ ...form, tenure_years: v })} />
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-2" data-testid="emi-run-button">
          {loading ? "Calculating…" : "Calculate"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">Enter values and hit calculate.</div>
        ) : (
          <div className="space-y-6" data-testid="emi-result">
            <div className="grid md:grid-cols-3 gap-4">
              <Metric label="Monthly EMI" value={inrFull(res.emi)} />
              <Metric label="Total interest" value={inr(res.total_interest)} />
              <Metric label="Total payment" value={inr(res.total_payment)} />
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-4">Yearly amortization</div>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <AreaChart data={res.schedule}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C85A32" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#C85A32" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#B89B72" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#B89B72" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => inr(v)} />
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="principal_paid" stackId="1" stroke="#C85A32" fill="url(#g1)" />
                    <Area type="monotone" dataKey="interest_paid" stackId="1" stroke="#B89B72" fill="url(#g2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- Rent vs Buy ---------------------- */
function RentBuyCalc() {
  const [form, setForm] = useState({
    property_price: 8000000,
    down_payment: 2000000,
    loan_rate: 8.5,
    loan_tenure_years: 20,
    appreciation: 6,
    monthly_rent: 28000,
    rent_increase: 7,
    invest_return: 12,
    years: 15,
    maintenance_monthly: 3500,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/rent-vs-buy", form);
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-8">
      <div className="card-flat p-6 space-y-2">
        <NumberField label="Property price (₹)" value={form.property_price} onChange={(v) => setForm({ ...form, property_price: v })} />
        <NumberField label="Down payment (₹)" value={form.down_payment} onChange={(v) => setForm({ ...form, down_payment: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Loan %" value={form.loan_rate} step="0.1" onChange={(v) => setForm({ ...form, loan_rate: v })} />
          <NumberField label="Tenure" value={form.loan_tenure_years} onChange={(v) => setForm({ ...form, loan_tenure_years: v })} />
        </div>
        <NumberField label="Monthly rent (₹)" value={form.monthly_rent} onChange={(v) => setForm({ ...form, monthly_rent: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Rent ↑ %" value={form.rent_increase} step="0.1" onChange={(v) => setForm({ ...form, rent_increase: v })} />
          <NumberField label="Appreciation %" value={form.appreciation} step="0.1" onChange={(v) => setForm({ ...form, appreciation: v })} />
        </div>
        <NumberField label="Alt. invest return %" value={form.invest_return} step="0.1" onChange={(v) => setForm({ ...form, invest_return: v })} />
        <NumberField label="Horizon (years)" value={form.years} onChange={(v) => setForm({ ...form, years: v })} />
        <NumberField label="Maint / month (₹)" value={form.maintenance_monthly} onChange={(v) => setForm({ ...form, maintenance_monthly: v })} />
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="rentbuy-run-button">
          {loading ? "Calculating…" : "Run analysis"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">Provide assumptions and run.</div>
        ) : (
          <div className="space-y-6" data-testid="rentbuy-result">
            <div className="grid md:grid-cols-3 gap-4">
              <Metric label="EMI" value={inrFull(res.emi)} />
              <Metric label="Loan amount" value={inr(res.loan_amount)} />
              <Metric label="Breakeven" value={res.breakeven_year ? `Year ${res.breakeven_year}` : "Beyond horizon"} />
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-4">Net worth — buy vs rent</div>
              <div style={{ width: "100%", height: 340 }}>
                <ResponsiveContainer>
                  <LineChart data={res.series}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => inr(v)} />
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                    <Line type="monotone" name="Buy (equity)" dataKey="buy_net_worth" stroke="#C85A32" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" name="Rent (invested)" dataKey="rent_net_worth" stroke="#4A5568" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- Investment ---------------------- */
function InvestCalc() {
  const [form, setForm] = useState({
    property_price: 8000000,
    down_payment: 2000000,
    loan_rate: 8.5,
    loan_tenure_years: 20,
    appreciation: 6,
    rental_yield: 3,
    mf_return: 12,
    equity_return: 15,
    years: 15,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/investment-compare", form);
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-8">
      <div className="card-flat p-6 space-y-2">
        <NumberField label="Property price (₹)" value={form.property_price} onChange={(v) => setForm({ ...form, property_price: v })} />
        <NumberField label="Down payment (₹)" value={form.down_payment} onChange={(v) => setForm({ ...form, down_payment: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Loan %" value={form.loan_rate} step="0.1" onChange={(v) => setForm({ ...form, loan_rate: v })} />
          <NumberField label="Tenure" value={form.loan_tenure_years} onChange={(v) => setForm({ ...form, loan_tenure_years: v })} />
        </div>
        <NumberField label="Appreciation %" value={form.appreciation} step="0.1" onChange={(v) => setForm({ ...form, appreciation: v })} />
        <NumberField label="Rental yield %" value={form.rental_yield} step="0.1" onChange={(v) => setForm({ ...form, rental_yield: v })} />
        <NumberField label="MF return %" value={form.mf_return} step="0.1" onChange={(v) => setForm({ ...form, mf_return: v })} />
        <NumberField label="Equity return %" value={form.equity_return} step="0.1" onChange={(v) => setForm({ ...form, equity_return: v })} />
        <NumberField label="Horizon (years)" value={form.years} onChange={(v) => setForm({ ...form, years: v })} />
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="invest-run-button">
          {loading ? "Calculating…" : "Run comparison"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">Enter assumptions and run.</div>
        ) : (
          <div className="space-y-6" data-testid="invest-result">
            <div className="card-flat p-6 border-[hsl(var(--secondary))]">
              <div className="eyebrow text-[hsl(var(--secondary))] mb-2">Winner over {form.years} years</div>
              <div className="font-serif text-4xl">{res.summary.winner}</div>
              <div className="mt-2 text-muted-foreground">{inrFull(res.summary.winner_value)}</div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <Metric label="Property" value={inr(res.summary.property_final)} />
              <Metric label="Mutual Funds" value={inr(res.summary.mutual_funds_final)} />
              <Metric label="Equity" value={inr(res.summary.equity_final)} />
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-4">Growth trajectory</div>
              <div style={{ width: "100%", height: 340 }}>
                <ResponsiveContainer>
                  <LineChart data={res.series}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => inr(v)} />
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                    <Line type="monotone" name="Property" dataKey="property" stroke="#C85A32" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" name="Mutual Funds" dataKey="mutual_funds" stroke="#B89B72" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" name="Equity" dataKey="equity" stroke="#5E7C60" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- atoms ---------------------- */
function NumberField({ label, value, onChange, step }) {
  return (
    <label className="block mb-3">
      <span className="eyebrow block mb-1.5">{label}</span>
      <input
        type="number"
        step={step || "1"}
        className="input-dark w-full px-3 py-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-testid={`calc-input-${label.replace(/[^a-z]/gi, "-").toLowerCase()}`}
      />
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="card-flat p-5">
      <div className="eyebrow">{label}</div>
      <div className="num-metric text-3xl mt-2">{value}</div>
    </div>
  );
}
