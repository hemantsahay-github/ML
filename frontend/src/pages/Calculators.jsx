import { useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr, inrFull } from "../lib/format";
import Disclaimer from "../components/Disclaimer";
import { X } from "@phosphor-icons/react";
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
  { id: "wealth", label: "Why buy (wealth)" },
  { id: "car", label: "Car vs Property" },
  { id: "emi", label: "EMI" },
  { id: "rentbuy", label: "Rent vs Buy" },
  { id: "invest", label: "Property vs MF vs Equity" },
  { id: "cashflow", label: "Cashflow-positive finder" },
  { id: "rentcf", label: "Rent-for-cashflow" },
  { id: "resale", label: "Resale estimator" },
  { id: "optimizer", label: "Loan Leverage Optimizer" },
  { id: "builder", label: "Builder plan" },
  { id: "uc", label: "UC expected value" },
  { id: "rtmuc", label: "RTM vs UC breakeven" },
  { id: "prepay", label: "Prepay vs Invest" },
  { id: "odcf", label: "OD → Cashflow-positive" },
  { id: "xirr", label: "XIRR" },
];

export default function Calculators() {
  const [tab, setTab] = useState("wealth");
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

      {tab === "wealth" && <WealthNarrative />}
      {tab === "car" && <CarVsProperty />}
      {tab === "emi" && <EmiCalc />}
      {tab === "rentbuy" && <RentBuyCalc />}
      {tab === "invest" && <InvestCalc />}
      {tab === "cashflow" && <CashflowPositiveCalc />}
      {tab === "rentcf" && <RentForCashflow />}
      {tab === "resale" && <ResaleEstimator />}
      {tab === "optimizer" && <LoanOptimizer />}
      {tab === "builder" && <BuilderPlan />}
      {tab === "uc" && <UCProjection />}
      {tab === "rtmuc" && <RtmVsUcBreakeven />}
      {tab === "prepay" && <PrepaymentAnalysis />}
      {tab === "odcf" && <OdCashflow />}
      {tab === "xirr" && <XirrCalc />}

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
    min_rent_monthly: 20000,
    current_rent_monthly: 32000,
    misc_expenses_inr: 150000,
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
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Min rent ₹/mo" value={form.min_rent_monthly} onChange={(v) => setForm({ ...form, min_rent_monthly: v })} />
          <NumberField label="Current rent ₹/mo" value={form.current_rent_monthly} onChange={(v) => setForm({ ...form, current_rent_monthly: v })} />
        </div>
        <NumberField label="Misc / renovation (₹ total)" value={form.misc_expenses_inr} onChange={(v) => setForm({ ...form, misc_expenses_inr: v })} />
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
              <Metric label="XIRR (true IRR)" value={`${res.xirr_pct ?? res.implied_annual_return_pct}%`} />
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-3">Cost breakdown during hold</div>
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <LabRow label="Total carrying cost" v={inr(res.total_carrying_cost)} />
                <LabRow label="Avg rent used (₹/mo)" v={inr(res.average_rent_used)} />
                <LabRow label="Total rental income" v={inr(res.total_rental_income)} accent="good" />
              </div>
              <div className="grid md:grid-cols-2 gap-3 text-sm mt-3">
                <LabRow label="Misc / renovation spend" v={inr(res.misc_expenses)} accent={res.misc_expenses > 0 ? "bad" : undefined} />
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
    under_construction: false,
    possession_months: 36,
    disbursement_schedule: "clp",
    subvention_by_builder: false,
    appreciation_pct: 7,
    rental_yield_pct: 3,
    analysis_years: 10,
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
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Appreciation % p.a." value={form.appreciation_pct} step="0.1" onChange={(v) => setForm({ ...form, appreciation_pct: v })} />
          <NumberField label="Horizon (yrs)" value={form.analysis_years} onChange={(v) => setForm({ ...form, analysis_years: v })} />
        </div>
        <NumberField label="Maint / month (₹)" value={form.maintenance_monthly} onChange={(v) => setForm({ ...form, maintenance_monthly: v })} />
        <NumberField label="Tax / year (₹)" value={form.property_tax_yearly} onChange={(v) => setForm({ ...form, property_tax_yearly: v })} />

        <div className="pt-2 mt-2 border-t hairline space-y-2">
          <label className="flex items-center gap-2 text-sm pt-2">
            <input
              type="checkbox"
              checked={form.under_construction}
              onChange={(e) => setForm({ ...form, under_construction: e.target.checked })}
              className="accent-[hsl(var(--primary))]"
              data-testid="optimizer-uc-toggle"
            />
            Under-construction property
          </label>
          {form.under_construction && (
            <div className="space-y-2">
              <NumberField label="Months till possession" value={form.possession_months} onChange={(v) => setForm({ ...form, possession_months: v })} />
              <label className="block">
                <span className="eyebrow block mb-1.5">Disbursement schedule</span>
                <select
                  className="input-dark w-full px-3 py-2"
                  value={form.disbursement_schedule}
                  onChange={(e) => setForm({ ...form, disbursement_schedule: e.target.value })}
                  data-testid="optimizer-uc-schedule"
                >
                  <option value="clp">CLP (construction-linked)</option>
                  <option value="linear">Linear ramp</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.subvention_by_builder}
                  onChange={(e) => setForm({ ...form, subvention_by_builder: e.target.checked })}
                  className="accent-[hsl(var(--primary))]"
                  data-testid="optimizer-subvention"
                />
                Subvention scheme (builder pays pre-EMI)
              </label>
            </div>
          )}
        </div>

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
            {res.best_leverage_xirr && (
              <div className="card-flat p-6 border-[hsl(var(--secondary))]">
                <div className="eyebrow text-[hsl(var(--secondary))] mb-1">Best 10-yr leverage XIRR</div>
                <div className="font-serif text-4xl">{res.best_leverage_xirr.leverage_xirr_pct}% at {res.best_leverage_xirr.down_payment_pct}% DP</div>
                <div className="text-sm text-muted-foreground mt-1">Net equity at year {res.analysis_years}: {inr(res.best_leverage_xirr.net_equity_at_horizon)} · CAGR {res.best_leverage_xirr.leverage_cagr_pct}%</div>
              </div>
            )}
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
              <div className="p-4 eyebrow border-b hairline flex items-center justify-between">
                <span>Down-payment sweep · {res.analysis_years}-yr leverage</span>
                {res.under_construction && (
                  <span className="text-xs text-muted-foreground normal-case">
                    UC · {res.possession_months} months · {res.disbursement_schedule}{res.subvention_by_builder ? " · subvention" : ""}
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b hairline">
                  <tr>
                    {["DP %", "DP", "Loan", "EMI", "Cashflow / mo", "CoC return", "Leverage XIRR", "CAGR"].map((h) => (
                      <th key={h} className="p-3 font-normal eyebrow">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.grid.map((g) => (
                    <tr
                      key={`dp-${g.down_payment_pct}`}
                      className={`border-b hairline last:border-0 ${
                        res.best_leverage_xirr && g.down_payment_pct === res.best_leverage_xirr.down_payment_pct
                          ? "bg-[hsl(var(--secondary))]/5"
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
                      <td className={`p-3 num-metric ${g.leverage_xirr_pct >= 10 ? "text-[hsl(var(--secondary))]" : ""}`}>{g.leverage_xirr_pct}%</td>
                      <td className="p-3 text-xs">{g.leverage_cagr_pct}%</td>
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
                    <tr key={`p-${r.price}-${i}`} className="border-b hairline last:border-0" data-testid={`cashflow-row-${i}`}>
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

/* ---------------------- Wealth Narrative — why buy long-term ---------------------- */
function WealthNarrative() {
  const [form, setForm] = useState({
    property_price: 10000000,
    down_payment_pct: 20,
    loan_rate: 8.5,
    loan_tenure_years: 20,
    appreciation_pct: 7,
    city_tier: "tier1",
    monthly_rent_today: 30000,
    rent_increase_pct: 8,
    alt_return_pct: 12,
    horizon_years: 25,
    pass_to_generation: true,
    legacy_bonus_pct: 15,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/wealth-narrative", form);
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
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="DP %" value={form.down_payment_pct} onChange={(v) => setForm({ ...form, down_payment_pct: v })} />
          <NumberField label="Loan %" value={form.loan_rate} step="0.1" onChange={(v) => setForm({ ...form, loan_rate: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Tenure" value={form.loan_tenure_years} onChange={(v) => setForm({ ...form, loan_tenure_years: v })} />
          <NumberField label="Appreciation %" value={form.appreciation_pct} step="0.1" onChange={(v) => setForm({ ...form, appreciation_pct: v })} />
        </div>
        <label className="block">
          <span className="eyebrow block mb-1.5">City tier</span>
          <select
            className="input-dark w-full px-3 py-2"
            value={form.city_tier}
            onChange={(e) => setForm({ ...form, city_tier: e.target.value })}
            data-testid="wealth-tier"
          >
            <option value="tier1">Tier 1 (BLR/MUM/NCR/HYD/PUN/CHN) — +15%</option>
            <option value="tier2">Tier 2</option>
            <option value="tier3">Tier 3 — -15%</option>
          </select>
        </label>
        <NumberField label="Monthly rent today (₹)" value={form.monthly_rent_today} onChange={(v) => setForm({ ...form, monthly_rent_today: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Rent ↑ %" value={form.rent_increase_pct} step="0.1" onChange={(v) => setForm({ ...form, rent_increase_pct: v })} />
          <NumberField label="Alt return %" value={form.alt_return_pct} step="0.1" onChange={(v) => setForm({ ...form, alt_return_pct: v })} />
        </div>
        <NumberField label="Horizon (years)" value={form.horizon_years} onChange={(v) => setForm({ ...form, horizon_years: v })} />
        <label className="flex items-center gap-2 text-sm pt-2">
          <input
            type="checkbox"
            checked={form.pass_to_generation}
            onChange={(e) => setForm({ ...form, pass_to_generation: e.target.checked })}
            className="accent-[hsl(var(--primary))]"
            data-testid="wealth-gen"
          />
          Pass to next generation (+legacy bonus)
        </label>
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="wealth-run-button">
          {loading ? "Running…" : "Show the case for buying"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            Owning property is a <span className="text-foreground">long-game</span>. Watch what happens to your net worth vs renting-and-investing across a 20-30 year horizon — including tier-1 appreciation, EMI ending after tenure, ever-rising rent, and the tax-free generational transfer that only real estate gets in India.
          </div>
        ) : (
          <div className="space-y-6" data-testid="wealth-result">
            <div className={`card-flat p-8 ${res.winner === "Buy" ? "border-[hsl(var(--secondary))]" : "border-destructive"}`}>
              <div className="eyebrow mb-2">Winner over {form.horizon_years} years</div>
              <div className="font-serif text-5xl">{res.winner === "Buy" ? "Buy wins." : "Renting wins."}</div>
              <div className="text-sm text-muted-foreground mt-3">Delta: {inrFull(res.delta)} {res.crossover_year ? `· crossover year ${res.crossover_year}` : ""}</div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <Metric label="Buy final wealth" value={inrFull(res.final_buy_wealth)} />
              <Metric label="Rent-invest final" value={inrFull(res.final_rent_wealth)} />
              <Metric label="Tier premium applied" value={`+${res.tier_premium_applied_pct}%`} />
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-4">Net worth trajectory</div>
              <div style={{ width: "100%", height: 340 }}>
                <ResponsiveContainer>
                  <LineChart data={res.series}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => inr(v)} />
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                    <Line type="monotone" name="Buy (net worth)" dataKey="buy_net_worth" stroke="#C85A32" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" name="Rent (invested)" dataKey="rent_net_worth" stroke="#4A5568" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" name="Property value" dataKey="property_value" stroke="#B89B72" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-3">Why the math favours buying</div>
              <ul className="space-y-3 text-sm leading-relaxed">
                {res.narratives.map((n, i) => (
                  <li key={`wealth-${n.slice(0, 24)}-${i}`} className="flex gap-3" data-testid={`wealth-narrative-${i}`}>
                    <span className="text-[hsl(var(--secondary))]">▪</span>
                    <span className="text-muted-foreground">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- Rent-for-cashflow (owned property) ---------------------- */
function RentForCashflow() {
  const [form, setForm] = useState({
    current_value: 8000000,
    outstanding_loan: 4500000,
    current_emi: 39200,
    current_rent: 25000,
    rent_increase_pct: 8,
    maintenance_monthly: 3000,
    property_tax_yearly: 12000,
    target_years_to_positive: 3,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/rent-for-cashflow", form);
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
        <NumberField label="Current property value (₹)" value={form.current_value} onChange={(v) => setForm({ ...form, current_value: v })} />
        <NumberField label="Outstanding loan (₹)" value={form.outstanding_loan} onChange={(v) => setForm({ ...form, outstanding_loan: v })} />
        <NumberField label="Current EMI (₹)" value={form.current_emi} onChange={(v) => setForm({ ...form, current_emi: v })} />
        <NumberField label="Current rent (₹/mo, 0 if vacant)" value={form.current_rent} onChange={(v) => setForm({ ...form, current_rent: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Maint / month" value={form.maintenance_monthly} onChange={(v) => setForm({ ...form, maintenance_monthly: v })} />
          <NumberField label="Tax / year" value={form.property_tax_yearly} onChange={(v) => setForm({ ...form, property_tax_yearly: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Rent ↑ % p.a." value={form.rent_increase_pct} step="0.1" onChange={(v) => setForm({ ...form, rent_increase_pct: v })} />
          <NumberField label="Target years" value={form.target_years_to_positive} onChange={(v) => setForm({ ...form, target_years_to_positive: v })} />
        </div>
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="rentcf-run-button">
          {loading ? "Crunching…" : "Find the rent"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            Got an owned rental that&apos;s bleeding money? This tells you the rent you need to charge <span className="text-foreground">today</span> (or in N years, given rent inflation) to make your EMI + costs self-sustaining.
          </div>
        ) : (
          <div className="space-y-6" data-testid="rentcf-result">
            <div className="grid md:grid-cols-3 gap-4">
              <Metric label="Rent required today" value={inrFull(res.required_rent_today)} />
              <Metric label={`Rent needed by year ${res.target_years}`} value={inrFull(res.required_rent_at_target_year)} />
              <Metric label="Monthly gap" value={res.gap_monthly > 0 ? `+${inr(res.gap_monthly)}` : "None"} />
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-2">Verdict</div>
              <div className="font-serif text-2xl" data-testid="rentcf-verdict">{res.verdict}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Today&apos;s gross yield: {res.gross_yield_today_pct}% · required yield: {res.required_gross_yield_pct}%
              </div>
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-4">Cashflow trajectory at current rent + market increase</div>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={res.trajectory}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => inr(v)} />
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                    <Line type="monotone" name="Monthly cashflow" dataKey="monthly_cashflow" stroke="#C85A32" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" name="Rent" dataKey="rent" stroke="#B89B72" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {res.year_cashflow_turns_positive && (
                <div className="text-sm text-[hsl(var(--secondary))] mt-3">
                  ✓ Turns cashflow-positive in year {res.year_cashflow_turns_positive}.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- Prepayment vs Invest ---------------------- */
function PrepaymentAnalysis() {
  const [form, setForm] = useState({
    outstanding_loan: 4500000,
    loan_rate: 8.5,
    remaining_tenure_years: 15,
    current_emi: 39200,
    surplus_amount: 1000000,
    alt_invest_return_pct: 12,
    rental_income_monthly: 28000,
    maintenance_monthly: 3000,
    property_tax_yearly: 12000,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/prepayment-analysis", form);
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
        <NumberField label="Outstanding loan (₹)" value={form.outstanding_loan} onChange={(v) => setForm({ ...form, outstanding_loan: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Loan %" value={form.loan_rate} step="0.1" onChange={(v) => setForm({ ...form, loan_rate: v })} />
          <NumberField label="Tenure left" value={form.remaining_tenure_years} step="0.5" onChange={(v) => setForm({ ...form, remaining_tenure_years: v })} />
        </div>
        <NumberField label="Current EMI (₹)" value={form.current_emi} onChange={(v) => setForm({ ...form, current_emi: v })} />
        <NumberField label="Surplus / lumpsum (₹)" value={form.surplus_amount} onChange={(v) => setForm({ ...form, surplus_amount: v })} />
        <NumberField label="Alt invest return %" value={form.alt_invest_return_pct} step="0.1" onChange={(v) => setForm({ ...form, alt_invest_return_pct: v })} />
        <div className="pt-2 border-t hairline">
          <div className="eyebrow mb-2 pt-2">Owned rental (optional)</div>
          <NumberField label="Rental income ₹/mo" value={form.rental_income_monthly} onChange={(v) => setForm({ ...form, rental_income_monthly: v })} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Maint / month" value={form.maintenance_monthly} onChange={(v) => setForm({ ...form, maintenance_monthly: v })} />
            <NumberField label="Tax / year" value={form.property_tax_yearly} onChange={(v) => setForm({ ...form, property_tax_yearly: v })} />
          </div>
        </div>
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="prepay-run-button">
          {loading ? "Crunching…" : "Run analysis"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            Got a lumpsum and a loan? Should you prepay, fully close, or invest it in MF at 12%? Estima runs all four playbooks — including the hybrid of part-prepay + invest monthly EMI savings — and surfaces the winner for your math.
          </div>
        ) : (
          <div className="space-y-6" data-testid="prepay-result">
            <div className="card-flat p-8 border-[hsl(var(--secondary))]">
              <div className="eyebrow text-[hsl(var(--secondary))] mb-2">Recommended</div>
              <div className="font-serif text-4xl">{res.winner_name}</div>
              <div className="text-sm text-muted-foreground mt-2">
                Current monthly cashflow on this property: <span className={res.current_monthly_cashflow >= 0 ? "text-[hsl(var(--secondary))]" : "text-destructive"}>{inr(res.current_monthly_cashflow)}</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {res.scenarios.map((s) => (
                <div
                  key={s.id}
                  className={`card-flat p-6 ${s.id === res.winner ? "border-[hsl(var(--secondary))]" : ""}`}
                  data-testid={`prepay-scenario-${s.id}`}
                >
                  <div className="font-serif text-2xl mb-1">{s.name}</div>
                  <div className="text-xs text-muted-foreground mb-4">{s.best_for}</div>
                  <div className="space-y-1 text-sm">
                    {s.new_emi !== undefined && <Row label="New EMI" v={inr(s.new_emi)} />}
                    {s.principal_after !== undefined && <Row label="Principal after" v={inr(s.principal_after)} />}
                    {s.interest_saved !== undefined && <Row label="Interest saved" v={inr(s.interest_saved)} accent="good" />}
                    {s.final_alt_value !== undefined && <Row label="Alt final value" v={inr(s.final_alt_value)} accent="good" />}
                    {s.leftover_cash_invested_final !== undefined && s.leftover_cash_invested_final > 0 && <Row label="Leftover invested" v={inr(s.leftover_cash_invested_final)} accent="good" />}
                    {s.final_fv_of_emi_savings !== undefined && <Row label="FV of EMI savings" v={inr(s.final_fv_of_emi_savings)} accent="good" />}
                    {s.total_benefit !== undefined && <Row label="Total benefit" v={inr(s.total_benefit)} accent="good" />}
                    {s.monthly_cashflow_delta !== undefined && <Row label="Cashflow delta" v={(s.monthly_cashflow_delta >= 0 ? "+" : "") + inr(s.monthly_cashflow_delta)} accent={s.monthly_cashflow_delta > 0 ? "good" : undefined} />}
                    {s.effective_roi_pct !== undefined && <Row label="Effective ROI" v={`${s.effective_roi_pct}%`} />}
                    {s.feasible === false && <Row label="Feasible" v="No — surplus < loan" accent="bad" />}
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

/* ---------------------- Car vs Property ---------------------- */
function CarVsProperty() {
  const [form, setForm] = useState({
    car_price: 1500000,
    car_dp: 300000,
    car_loan_rate: 10.5,
    car_loan_tenure_years: 5,
    car_depreciation_pct: 15,
    car_running_cost_monthly: 12000,
    car_replace_years: 8,
    property_price: 8000000,
    property_dp: 1600000,
    property_loan_rate: 8.5,
    property_loan_tenure_years: 20,
    appreciation_pct: 7,
    monthly_rent: 22000,
    rent_increase_pct: 7,
    years: 10,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/car-vs-property", form);
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-8">
      <div className="card-flat p-6 space-y-1 max-h-[80vh] overflow-y-auto">
        <div className="eyebrow pb-2 border-b hairline">Car</div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <NumberField label="Car price" value={form.car_price} onChange={(v) => setForm({ ...form, car_price: v })} />
          <NumberField label="DP on car" value={form.car_dp} onChange={(v) => setForm({ ...form, car_dp: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Car loan %" value={form.car_loan_rate} step="0.1" onChange={(v) => setForm({ ...form, car_loan_rate: v })} />
          <NumberField label="Tenure" value={form.car_loan_tenure_years} onChange={(v) => setForm({ ...form, car_loan_tenure_years: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Deprec % p.a." value={form.car_depreciation_pct} step="0.5" onChange={(v) => setForm({ ...form, car_depreciation_pct: v })} />
          <NumberField label="Replace yrs" value={form.car_replace_years} onChange={(v) => setForm({ ...form, car_replace_years: v })} />
        </div>
        <NumberField label="Running cost ₹/mo" value={form.car_running_cost_monthly} onChange={(v) => setForm({ ...form, car_running_cost_monthly: v })} />

        <div className="eyebrow pt-4 pb-2 border-t hairline mt-4">Property</div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <NumberField label="Property price" value={form.property_price} onChange={(v) => setForm({ ...form, property_price: v })} />
          <NumberField label="DP on property" value={form.property_dp} onChange={(v) => setForm({ ...form, property_dp: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Prop loan %" value={form.property_loan_rate} step="0.1" onChange={(v) => setForm({ ...form, property_loan_rate: v })} />
          <NumberField label="Tenure" value={form.property_loan_tenure_years} onChange={(v) => setForm({ ...form, property_loan_tenure_years: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Appreciation %" value={form.appreciation_pct} step="0.1" onChange={(v) => setForm({ ...form, appreciation_pct: v })} />
          <NumberField label="Rent ↑ %" value={form.rent_increase_pct} step="0.1" onChange={(v) => setForm({ ...form, rent_increase_pct: v })} />
        </div>
        <NumberField label="Monthly rent ₹" value={form.monthly_rent} onChange={(v) => setForm({ ...form, monthly_rent: v })} />
        <NumberField label="Horizon (years)" value={form.years} onChange={(v) => setForm({ ...form, years: v })} />
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="car-run-button">
          {loading ? "Running…" : "Show the gap"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            Model the full finance picture: car DP + loan + running costs + replacement vs property DP + loan + rent. Real XIRR for both legs.
          </div>
        ) : (
          <div className="space-y-6" data-testid="car-result">
            <div className={`card-flat p-8 ${res.winner === "Property" ? "border-[hsl(var(--secondary))]" : "border-destructive"}`}>
              <div className="eyebrow mb-2">After {form.years} years</div>
              <div className="font-serif text-5xl">{res.winner} wins.</div>
              <div className="text-sm text-muted-foreground mt-3">Net worth gap: {inrFull(Math.abs(res.delta))}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="card-flat p-6">
                <div className="eyebrow mb-3">Car</div>
                <div className="space-y-1 text-sm">
                  <Row label="EMI" v={inr(res.car_emi)} />
                  <Row label="Loan amount" v={inr(res.car_loan)} />
                  <Row label="Final net worth" v={inr(res.final_car_net_worth)} />
                  <Row label="XIRR (annualized)" v={`${res.car_xirr_pct}%`} accent={res.car_xirr_pct < 0 ? "bad" : undefined} />
                </div>
              </div>
              <div className="card-flat p-6 border-[hsl(var(--secondary))]">
                <div className="eyebrow mb-3">Property</div>
                <div className="space-y-1 text-sm">
                  <Row label="EMI" v={inr(res.property_emi)} />
                  <Row label="Loan amount" v={inr(res.property_loan)} />
                  <Row label="Final value" v={inr(res.final_property_value)} />
                  <Row label="Final net worth" v={inr(res.final_property_net_worth)} accent="good" />
                  <Row label="XIRR (annualized)" v={`${res.property_xirr_pct}%`} accent="good" />
                </div>
              </div>
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-4">Net-worth trajectory</div>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={res.series}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => inr(v)} />
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                    <Line type="monotone" name="Property net worth" dataKey="property_net_worth" stroke="#C85A32" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" name="Car net worth" dataKey="car_net_worth" stroke="#4A5568" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-3">Why property wins here</div>
              <ul className="space-y-2 text-sm leading-relaxed">
                {res.narrative.map((n, i) => (
                  <li key={`car-${n.slice(0, 24)}-${i}`} className="flex gap-3" data-testid={`car-narrative-${i}`}>
                    <span className="text-[hsl(var(--secondary))]">▪</span>
                    <span className="text-muted-foreground">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- UC Projection ---------------------- */
function UCProjection() {
  const [form, setForm] = useState({
    purchase_price: 8000000,
    down_payment_pct: 20,
    loan_rate: 8.5,
    loan_tenure_years: 20,
    possession_months: 36,
    area_price_inflation_pct: 7,
    construction_cost_inflation_pct: 6,
    post_possession_boost_pct: 5,
    disbursement_schedule: "clp",
    pre_emi_by_builder: false,
    builder_pre_emi_cap_months: 0,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/uc-projection", form);
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
        <NumberField label="Purchase price today (₹)" value={form.purchase_price} onChange={(v) => setForm({ ...form, purchase_price: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="DP %" value={form.down_payment_pct} onChange={(v) => setForm({ ...form, down_payment_pct: v })} />
          <NumberField label="Loan %" value={form.loan_rate} step="0.1" onChange={(v) => setForm({ ...form, loan_rate: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Possession (months)" value={form.possession_months} onChange={(v) => setForm({ ...form, possession_months: v })} />
          <NumberField label="Tenure (years)" value={form.loan_tenure_years} onChange={(v) => setForm({ ...form, loan_tenure_years: v })} />
        </div>
        <NumberField label="Area price inflation % p.a." value={form.area_price_inflation_pct} step="0.1" onChange={(v) => setForm({ ...form, area_price_inflation_pct: v })} />
        <NumberField label="Construction cost inflation %" value={form.construction_cost_inflation_pct} step="0.1" onChange={(v) => setForm({ ...form, construction_cost_inflation_pct: v })} />
        <NumberField label="Post-possession boost %" value={form.post_possession_boost_pct} step="0.5" onChange={(v) => setForm({ ...form, post_possession_boost_pct: v })} />
        <label className="block">
          <span className="eyebrow block mb-1.5">Disbursement schedule</span>
          <select className="input-dark w-full px-3 py-2" value={form.disbursement_schedule} onChange={(e) => setForm({ ...form, disbursement_schedule: e.target.value })}>
            <option value="clp">CLP (construction-linked)</option>
            <option value="linear">Linear ramp</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm pt-3 border-t hairline mt-3">
          <input
            type="checkbox"
            checked={form.pre_emi_by_builder}
            onChange={(e) => setForm({ ...form, pre_emi_by_builder: e.target.checked })}
            className="accent-[hsl(var(--primary))]"
            data-testid="uc-subvention"
          />
          Pre-EMI borne by builder (subvention)
        </label>
        {form.pre_emi_by_builder && (
          <NumberField label="Builder covers till (months, 0 = possession)" value={form.builder_pre_emi_cap_months} onChange={(v) => setForm({ ...form, builder_pre_emi_cap_months: v })} />
        )}
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="uc-run-button">
          {loading ? "Projecting…" : "Project possession value"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            Bought under-construction? Model what the flat will actually be worth on possession day — net of pre-EMI bleed, cost escalations, and the ready-to-move premium. The real acquisition cost is almost always higher than the brochure price.
          </div>
        ) : (
          <div className="space-y-6" data-testid="uc-result">
            <div className="grid md:grid-cols-3 gap-4">
              <Metric label="Expected possession value" value={inrFull(res.expected_possession_value)} />
              <Metric label="Effective acquisition cost" value={inrFull(res.effective_acquisition_cost)} />
              <Metric label="Paper profit at possession" value={inrFull(res.projected_profit_at_possession)} />
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              <Metric label="Pre-EMI (you pay)" value={inr(res.pre_emi_by_buyer_total)} />
              <Metric label="Builder covers" value={inr(res.pre_emi_by_builder_total)} />
              <Metric label="True XIRR" value={`${res.xirr_pct}%`} />
              <Metric label="Annualized ROI on DP" value={`${res.annualized_roi_on_dp_pct}%`} />
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-4">Month-by-month disbursement</div>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={res.disbursement_schedule}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => inr(v)} />
                    <Tooltip formatter={(v) => inrFull(v)} />
                    <Legend />
                    <Area type="monotone" name="Disbursed (cumul.)" dataKey="disbursed" stroke="#C85A32" fill="#C85A32" fillOpacity={0.15} />
                    <Area type="monotone" name="Pre-EMI ₹/mo" dataKey="pre_emi_monthly" stroke="#B89B72" fill="#B89B72" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-3">What this means</div>
              <ul className="space-y-2 text-sm leading-relaxed">
                {res.narrative.map((n, i) => (
                  <li key={`uc-${n.slice(0, 24)}-${i}`} className="flex gap-3" data-testid={`uc-narrative-${i}`}>
                    <span className="text-[hsl(var(--secondary))]">▪</span>
                    <span className="text-muted-foreground">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- RTM vs UC Breakeven ---------------------- */
function RtmVsUcBreakeven() {
  const [form, setForm] = useState({
    rtm_price: 9500000,
    uc_price: 8500000,
    possession_months: 36,
    loan_rate: 8.5,
    loan_tenure_years: 20,
    monthly_rent_rtm: 32000,
    expected_rent_at_possession_uc: 38000,
    area_appreciation_pct: 7,
    maintenance_monthly: 3000,
    property_tax_yearly: 15000,
    uc_pre_emi_by_builder: false,
    uc_builder_pre_emi_cap_months: 0,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/breakeven-rtm-uc", form);
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
        <div className="eyebrow pb-1">Ready-to-move (RTM)</div>
        <NumberField label="RTM price (₹)" value={form.rtm_price} onChange={(v) => setForm({ ...form, rtm_price: v })} />
        <NumberField label="RTM rent ₹/mo (today)" value={form.monthly_rent_rtm} onChange={(v) => setForm({ ...form, monthly_rent_rtm: v })} />
        <div className="eyebrow pt-3 pb-1 border-t hairline mt-3">Under-construction (UC)</div>
        <NumberField label="UC price (₹)" value={form.uc_price} onChange={(v) => setForm({ ...form, uc_price: v })} />
        <NumberField label="Rent at possession ₹/mo" value={form.expected_rent_at_possession_uc} onChange={(v) => setForm({ ...form, expected_rent_at_possession_uc: v })} />
        <NumberField label="Possession months" value={form.possession_months} onChange={(v) => setForm({ ...form, possession_months: v })} />
        <label className="flex items-center gap-2 text-sm pt-1">
          <input
            type="checkbox"
            checked={form.uc_pre_emi_by_builder}
            onChange={(e) => setForm({ ...form, uc_pre_emi_by_builder: e.target.checked })}
            className="accent-[hsl(var(--primary))]"
            data-testid="rtmuc-subvention"
          />
          UC pre-EMI by builder (subvention)
        </label>
        {form.uc_pre_emi_by_builder && (
          <NumberField label="Builder covers till (mo, 0=possession)" value={form.uc_builder_pre_emi_cap_months} onChange={(v) => setForm({ ...form, uc_builder_pre_emi_cap_months: v })} />
        )}
        <div className="eyebrow pt-3 pb-1 border-t hairline mt-3">Common</div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Loan %" value={form.loan_rate} step="0.1" onChange={(v) => setForm({ ...form, loan_rate: v })} />
          <NumberField label="Tenure" value={form.loan_tenure_years} onChange={(v) => setForm({ ...form, loan_tenure_years: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Maint / mo" value={form.maintenance_monthly} onChange={(v) => setForm({ ...form, maintenance_monthly: v })} />
          <NumberField label="Appreciation %" value={form.area_appreciation_pct} step="0.1" onChange={(v) => setForm({ ...form, area_appreciation_pct: v })} />
        </div>
        <NumberField label="Property tax / year" value={form.property_tax_yearly} onChange={(v) => setForm({ ...form, property_tax_yearly: v })} />
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-3" data-testid="rtmuc-run-button">
          {loading ? "Finding breakeven…" : "Find breakeven DP"}
        </button>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            For each option, Estima finds the minimum down-payment such that rent exactly covers EMI + costs. Compare how much you&apos;d pay now vs how much per month over 5 years — so you can decide per-month loan and deposit.
          </div>
        ) : (
          <div className="space-y-6" data-testid="rtmuc-result">
            {res.winner && (
              <div className={`card-flat p-8 border-[hsl(var(--secondary))]`}>
                <div className="eyebrow mb-2">Net winner over 5 years</div>
                <div className="font-serif text-5xl">{res.winner === "UC" ? "Under-construction" : "Ready-to-move"} wins.</div>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="card-flat p-6" data-testid="rtmuc-rtm-card">
                <div className="eyebrow mb-3">Ready-to-move</div>
                {res.rtm.feasible ? (
                  <div className="space-y-2 text-sm">
                    <Row label="Breakeven DP" v={`${res.rtm.dp_pct}% · ${inr(res.rtm.dp_amount)}`} />
                    <Row label="Loan" v={inr(res.rtm.loan)} />
                    <Row label="EMI" v={inr(res.rtm.emi)} />
                    <Row label="Cashflow" v={`+${inr(res.rtm.cashflow)}`} accent="good" />
                    <Row label="Value at 5y" v={inr(res.rtm.value_at_5y_horizon)} />
                    <Row label="Appreciation gain" v={inr(res.rtm.appreciation_gain)} accent="good" />
                    <Row label="5y carrying cost" v={inr(res.rtm["5y_carrying_cost"] || 0)} accent={(res.rtm["5y_carrying_cost"] || 0) > 0 ? "bad" : "good"} />
                    {res.rtm.xirr_5y_pct !== undefined && <Row label="5-yr XIRR" v={`${res.rtm.xirr_5y_pct}%`} accent="good" />}
                  </div>
                ) : (
                  <div className="text-sm text-destructive">Not feasible — rent too low vs EMI+costs.</div>
                )}
              </div>
              <div className="card-flat p-6" data-testid="rtmuc-uc-card">
                <div className="eyebrow mb-3">Under-construction</div>
                {res.uc.feasible ? (
                  <div className="space-y-2 text-sm">
                    <Row label="Breakeven DP" v={`${res.uc.dp_pct}% · ${inr(res.uc.dp_amount)}`} />
                    <Row label="Loan" v={inr(res.uc.loan)} />
                    <Row label="EMI" v={inr(res.uc.emi)} />
                    <Row label="Cashflow (post-possession)" v={`+${inr(res.uc.cashflow)}`} accent="good" />
                    <Row label="Value at possession" v={inr(res.uc.value_at_possession)} />
                    <Row label="Appreciation gain" v={inr(res.uc.appreciation_gain_at_possession)} accent="good" />
                    <Row label="5y carry incl. pre-EMI" v={inr(res.uc["5y_carrying_cost_incl_pre_emi"] || 0)} accent={(res.uc["5y_carrying_cost_incl_pre_emi"] || 0) > 0 ? "bad" : "good"} />
                    <Row label="Possession in" v={`${res.uc.possession_months} months`} />
                    {res.uc.xirr_5y_pct !== undefined && <Row label="5-yr XIRR" v={`${res.uc.xirr_5y_pct}%`} accent="good" />}
                    {res.uc.pre_emi_by_builder && <Row label="Subvention" v="Yes — builder pays pre-EMI" accent="good" />}
                  </div>
                ) : (
                  <div className="text-sm text-destructive">Not feasible — expected rent too low.</div>
                )}
              </div>
            </div>
            <div className="card-flat p-6">
              <div className="eyebrow mb-3">Bottom line</div>
              <ul className="space-y-2 text-sm leading-relaxed">
                {res.narrative.map((n, i) => (
                  <li key={`rtmuc-${n.slice(0, 24)}-${i}`} className="flex gap-3" data-testid={`rtmuc-narrative-${i}`}>
                    <span className="text-[hsl(var(--secondary))]">▪</span>
                    <span className="text-muted-foreground">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- XIRR ---------------------- */
function mkFlowKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}-${Math.random()}`;

/* ------------------ OD → Cashflow-Positive ------------------ */
const BUILDER_PLANS = [
  { id: "rtm", label: "Ready-to-Move" },
  { id: "10_90", label: "10:90" },
  { id: "20_80", label: "20:80" },
  { id: "30_70", label: "30:70" },
  { id: "clp", label: "CLP (construction-linked)" },
  { id: "subvention", label: "Subvention (builder pays pre-EMI)" },
];

function OdCashflow() {
  const [form, setForm] = useState({
    property_price: 8500000,
    monthly_rent: 38000,
    maintenance_monthly: 3500,
    property_tax_yearly: 12000,
    loan_rate: 8.5,
    loan_tenure_years: 20,
    down_payment_pct: 20,
    builder_plan: "20_80",
    possession_months: 24,
    surplus_cash_today: 1500000,
    monthly_od_topup: 30000,
    appreciation_pct: 7,
    analysis_years: 10,
  });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);

  const calc = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/od-cashflow", form);
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const up = (k, v) => setForm({ ...form, [k]: v });
  const showUC = form.builder_plan !== "rtm";

  return (
    <div className="grid lg:grid-cols-2 gap-8" data-testid="od-cashflow-calc">
      <div className="card-flat p-8">
        <div className="eyebrow mb-2">Overdraft-leveraged cashflow</div>
        <h2 className="font-serif text-3xl mb-2">Rental property that pays itself.</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Park surplus cash in an SBI Maxgain / HDFC Home Saver / Kotak Smart overdraft. Interest offsets daily → effective EMI drops → rent covers it. Works on RTM and under-construction plans.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <NumF label="Property price (₹)" value={form.property_price} onChange={(v) => up("property_price", v)} tid="odcf-price" />
          <NumF label="Expected rent/mo (₹)" value={form.monthly_rent} onChange={(v) => up("monthly_rent", v)} tid="odcf-rent" />
          <NumF label="Down payment %" value={form.down_payment_pct} onChange={(v) => up("down_payment_pct", v)} tid="odcf-dp" />
          <NumF label="Loan rate %" value={form.loan_rate} onChange={(v) => up("loan_rate", v)} tid="odcf-rate" />
          <NumF label="Loan tenure (yrs)" value={form.loan_tenure_years} onChange={(v) => up("loan_tenure_years", v)} tid="odcf-tenor" />
          <NumF label="Maintenance/mo (₹)" value={form.maintenance_monthly} onChange={(v) => up("maintenance_monthly", v)} tid="odcf-maint" />
          <NumF label="Property tax/yr (₹)" value={form.property_tax_yearly} onChange={(v) => up("property_tax_yearly", v)} tid="odcf-tax" />
          <NumF label="Surplus parked in OD today (₹)" value={form.surplus_cash_today} onChange={(v) => up("surplus_cash_today", v)} tid="odcf-surplus" />
          <NumF label="Monthly top-up to OD (₹)" value={form.monthly_od_topup} onChange={(v) => up("monthly_od_topup", v)} tid="odcf-topup" />
          <NumF label="Appreciation % p.a." value={form.appreciation_pct} onChange={(v) => up("appreciation_pct", v)} tid="odcf-appr" />
          <NumF label="Analysis horizon (yrs)" value={form.analysis_years} onChange={(v) => up("analysis_years", v)} tid="odcf-horizon" />
          <label className="block col-span-2">
            <span className="eyebrow block mb-1.5">Builder plan</span>
            <select className="input-dark w-full px-3 py-2" value={form.builder_plan} onChange={(e) => up("builder_plan", e.target.value)} data-testid="odcf-plan">
              {BUILDER_PLANS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          {showUC && (
            <NumF label="Possession in (months)" value={form.possession_months} onChange={(v) => up("possession_months", v)} tid="odcf-possession" />
          )}
        </div>

        <button onClick={calc} disabled={loading} className="btn-primary px-6 py-3 text-sm mt-6" data-testid="odcf-calculate">
          {loading ? "Crunching…" : "Calculate"}
        </button>
      </div>

      <div className="space-y-6">
        {!res ? (
          <div className="card-flat p-10 text-center text-muted-foreground" data-testid="odcf-empty">
            Enter your numbers → see the exact OD balance + top-ups needed to keep this rental always cashflow-positive.
          </div>
        ) : (
          <>
            <div className="card-flat p-6" data-testid="odcf-result">
              <div className="eyebrow mb-2">XIRR on down-payment</div>
              <div className="num-metric text-5xl" data-testid="odcf-xirr">{res.xirr_pct}%</div>
              <div className="text-sm text-muted-foreground mt-2">Over {form.analysis_years} years — includes interest saved via OD, net cashflow, and property exit value.</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Down payment" value={`₹${Number(res.down_payment).toLocaleString("en-IN")}`} />
              <Kpi label="Loan" value={`₹${Number(res.loan_amount).toLocaleString("en-IN")}`} />
              <Kpi label="Post-possession EMI" value={`₹${Number(res.emi_post_possession).toLocaleString("en-IN")}`} />
              <Kpi label="Min OD for CF-positive" value={`₹${Number(res.min_od_balance_for_cf_positive).toLocaleString("en-IN")}`} testid="odcf-min-od" />
              <Kpi label="Total interest saved" value={`₹${Number(res.total_interest_saved_via_od).toLocaleString("en-IN")}`} tone="secondary" />
              <Kpi label="Avg monthly CF (post-possession)" value={`₹${Number(res.avg_monthly_cashflow_post_possession).toLocaleString("en-IN")}`} tone={res.avg_monthly_cashflow_post_possession >= 0 ? "secondary" : "destructive"} />
            </div>

            <div className="card-flat p-6">
              <div className="eyebrow mb-3">Narrative</div>
              <ul className="space-y-2.5" data-testid="odcf-narrative">
                {res.narrative.map((n, i) => (
                  <li key={`${n.slice(0, 24)}-${i}`} className="flex gap-3 text-sm">
                    <span className="text-[hsl(var(--secondary))]">▸</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>

            {res.monthly_series?.length > 0 && (
              <div className="card-flat p-6">
                <div className="eyebrow mb-3">Monthly trajectory (every 6 months)</div>
                <table className="w-full text-xs" data-testid="odcf-series">
                  <thead>
                    <tr className="border-b hairline text-muted-foreground uppercase text-[9px] tracking-wider">
                      <th className="text-left py-2">Month</th>
                      <th className="text-right py-2">Loan bal</th>
                      <th className="text-right py-2">OD bal</th>
                      <th className="text-right py-2">Int saved</th>
                      <th className="text-right py-2">Rent</th>
                      <th className="text-right py-2">EMI eff.</th>
                      <th className="text-right py-2">Net CF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.monthly_series.map((r) => (
                      <tr key={r.month} className={`border-b hairline last:border-0 ${r.is_construction ? "opacity-60" : ""}`}>
                        <td className="py-1.5">{r.month}{r.is_construction ? " 🏗" : ""}</td>
                        <td className="py-1.5 text-right">₹{Number(r.loan_balance).toLocaleString("en-IN")}</td>
                        <td className="py-1.5 text-right">₹{Number(r.od_balance).toLocaleString("en-IN")}</td>
                        <td className="py-1.5 text-right text-[hsl(var(--secondary))]">₹{Number(r.interest_saved).toFixed(0)}</td>
                        <td className="py-1.5 text-right">₹{Number(r.rent).toLocaleString("en-IN")}</td>
                        <td className="py-1.5 text-right">₹{Number(r.emi_effective).toLocaleString("en-IN")}</td>
                        <td className={`py-1.5 text-right ${r.net_cashflow >= 0 ? "text-[hsl(var(--secondary))]" : "text-destructive"}`}>
                          ₹{Number(r.net_cashflow).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NumF({ label, value, onChange, tid }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">{label}</span>
      <input
        type="number"
        className="input-dark w-full px-3 py-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        data-testid={tid}
      />
    </label>
  );
}

function Kpi({ label, value, tone, testid }) {
  const toneClass = tone === "secondary" ? "text-[hsl(var(--secondary))]" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="card-flat p-4" data-testid={testid}>
      <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{label}</div>
      <div className={`num-metric text-lg ${toneClass}`}>{value}</div>
    </div>
  );
}


}

function XirrCalc() {
  const [rows, setRows] = useState([
    { _k: mkFlowKey(), date: "2020-06-01", amount: -2000000 },
    { _k: mkFlowKey(), date: "2022-06-01", amount: 180000 },
    { _k: mkFlowKey(), date: "2024-06-01", amount: 200000 },
    { _k: mkFlowKey(), date: new Date().toISOString().slice(0, 10), amount: 3500000 },
  ]);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const add = () => setRows([...rows, { _k: mkFlowKey(), date: new Date().toISOString().slice(0, 10), amount: 0 }]);
  const del = (i) => setRows(rows.filter((_, j) => j !== i));
  const update = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/calc/xirr", { cashflows: rows.map((r) => ({ date: r.date, amount: Number(r.amount) })) });
      setRes(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-[500px_1fr] gap-8">
      <div className="card-flat p-6">
        <div className="eyebrow mb-3">Cashflows (outflow = negative)</div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r._k} className="flex gap-2 items-center" data-testid={`xirr-row-${i}`}>
              <input type="date" className="input-dark px-2 py-1.5 text-sm flex-1" value={r.date} onChange={(e) => update(i, "date", e.target.value)} />
              <input type="number" className="input-dark px-2 py-1.5 text-sm flex-1" value={r.amount} onChange={(e) => update(i, "amount", e.target.value)} />
              <button onClick={() => del(i)} className="btn-ghost p-1.5" title="Remove"><X size={12} /></button>
            </div>
          ))}
        </div>
        <button onClick={add} className="btn-ghost text-xs mt-3 px-3 py-2" data-testid="xirr-add">+ Add cashflow</button>
        <button onClick={run} disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-4" data-testid="xirr-run-button">
          {loading ? "Computing…" : "Compute XIRR"}
        </button>
        <p className="text-xs text-muted-foreground mt-4">
          XIRR is the annualized return that makes the net-present-value of irregular cashflows equal zero. The correct way to measure real-estate IRR (rent + resale + misc spends over time).
        </p>
      </div>
      <div>
        {!res ? (
          <div className="card-flat p-8 text-muted-foreground">
            Enter your real-estate cashflows: down payment + EMIs + rent received + final sale. The XIRR is your true annualized return — directly comparable to equity/MF CAGR.
          </div>
        ) : (
          <div className="space-y-6" data-testid="xirr-result">
            <div className="card-flat p-8 border-[hsl(var(--secondary))]">
              <div className="eyebrow mb-2">Your XIRR</div>
              <div className="num-metric text-6xl text-[hsl(var(--secondary))]">{res.xirr_pct}%</div>
              <div className="text-sm text-muted-foreground mt-3">Across {res.n_flows} cashflows. Compare against Nifty ~13%, MF ~11%, FD ~7%.</div>
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
