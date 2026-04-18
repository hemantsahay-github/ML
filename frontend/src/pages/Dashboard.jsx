import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { inr } from "../lib/format";
import { ArrowRight, Buildings, Plus, TrendUp, Scales } from "@phosphor-icons/react";

export default function Dashboard() {
  const { user } = useAuth();
  const [props, setProps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/properties");
        setProps(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalValue = props.reduce((a, p) => a + (p.price || 0), 0);
  const avgPrice = props.length ? totalValue / props.length : 0;

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
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <MetricCard
          label="Properties tracked"
          value={props.length}
          icon={<Buildings size={22} weight="duotone" />}
          testid="metric-properties"
        />
        <MetricCard
          label="Total ticket size"
          value={inr(totalValue)}
          icon={<TrendUp size={22} weight="duotone" />}
          testid="metric-total-value"
        />
        <MetricCard
          label="Avg. price"
          value={inr(avgPrice)}
          icon={<Scales size={22} weight="duotone" />}
          testid="metric-avg-price"
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
        ) : props.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {props.slice(0, 6).map((p) => (
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

      {/* Tools */}
      <section className="mt-16 grid md:grid-cols-2 gap-6">
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
