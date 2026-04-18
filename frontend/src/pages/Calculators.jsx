import { useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr, inrFull } from "../lib/format";
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
];

export default function Calculators() {
  const [tab, setTab] = useState("emi");
  return (
    <div className="max-w-7xl mx-auto px-8 py-10" data-testid="calculators-page">
      <div className="mb-8">
        <div className="eyebrow mb-2">Calculators</div>
        <h1 className="font-serif text-5xl">The brutal math.</h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          EMI schedules, rent-vs-buy breakevens, and real estate vs mutual funds vs equity —
          with every assumption editable.
        </p>
      </div>

      <div className="border-b hairline mb-8">
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
