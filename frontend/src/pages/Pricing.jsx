import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { loadRazorpay } from "../lib/razorpay";
import { toast } from "sonner";
import { Check, Sparkle, ArrowLeft, Crown } from "@phosphor-icons/react";
import { inrFull } from "../lib/format";

export default function Pricing() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [plans, setPlans] = useState(null);
  const [paying, setPaying] = useState(null);

  useEffect(() => {
    api
      .get("/billing/plans")
      .then(({ data }) => setPlans(data))
      .catch(() => toast.error("Couldn't load plans."));
  }, []);

  const checkout = async (planId) => {
    if (!user) {
      toast("Sign in first to upgrade.");
      nav("/login?next=/pricing");
      return;
    }
    setPaying(planId);
    try {
      const Razorpay = await loadRazorpay();
      const { data: order } = await api.post("/billing/create-order", { plan_id: planId });
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Estima · Pro",
        description: order.plan_label,
        order_id: order.order_id,
        prefill: { name: order.customer.name, email: order.customer.email },
        theme: { color: "#C85A32" },
        handler: async (resp) => {
          try {
            await api.post("/billing/verify-payment", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success("Welcome to Pro. Unlocked.");
            await refresh();
            nav("/app");
          } catch (e) {
            toast.error(formatApiErrorDetail(e.response?.data?.detail));
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(null);
            toast("Checkout closed.");
          },
        },
      };
      new Razorpay(options).open();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setPaying(null);
    }
  };

  if (!plans)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="pricing-loading">
        Loading plans…
      </div>
    );

  return (
    <div className="min-h-screen bg-background" data-testid="pricing-page">
      <header className="border-b hairline">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 border hairline flex items-center justify-center">
              <span className="font-serif text-xl leading-none">E</span>
            </div>
            <span className="font-serif text-2xl tracking-tight">Estima</span>
          </Link>
          <Link to={user ? "/app" : "/"} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="pricing-back">
            <ArrowLeft size={14} /> {user ? "Back to app" : "Back home"}
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="eyebrow mb-3">Pricing</div>
          <h1 className="font-serif text-5xl md:text-6xl mb-5">Start free. Stay if it earns its keep.</h1>
          <p className="text-muted-foreground text-lg">
            Every new account gets{" "}
            <span className="text-[hsl(var(--secondary))]">{plans.trial_days} days of Pro, free</span>.
            Cancel anytime before. Test-mode Razorpay card: 4111 1111 1111 1111 · any future expiry · any CVV.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.plans.map((p) => {
            const isPopular = p.id === "yearly";
            return (
              <div
                key={p.id}
                className={`card-flat p-8 flex flex-col ${
                  isPopular ? "border-[hsl(var(--secondary))]" : ""
                }`}
                data-testid={`plan-card-${p.id}`}
              >
                {isPopular && (
                  <div className="eyebrow text-[hsl(var(--secondary))] mb-2 inline-flex items-center gap-1">
                    <Crown size={12} weight="duotone" /> Most popular
                  </div>
                )}
                <div className="font-serif text-3xl mb-2">{p.label}</div>
                {p.savings && <div className="text-xs text-[hsl(var(--secondary))] mb-4">{p.savings}</div>}
                <div className="num-metric text-5xl mb-1">
                  {p.id === "free" ? "₹0" : inrFull(p.amount_inr)}
                </div>
                <div className="text-xs text-muted-foreground mb-8">
                  {p.id === "free"
                    ? "forever"
                    : p.id === "monthly"
                      ? "per month"
                      : "per year · billed once"}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check size={16} weight="bold" className="text-[hsl(var(--secondary))] mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {p.id === "free" ? (
                  <Link
                    to={user ? "/app" : "/register"}
                    className="btn-ghost text-sm py-3 text-center"
                    data-testid="plan-free-cta"
                  >
                    {user ? "Current plan" : "Start free"}
                  </Link>
                ) : user?.is_pro && user?.plan_status === "active" ? (
                  <div className="btn-ghost text-sm py-3 text-center text-[hsl(var(--secondary))]" data-testid={`plan-${p.id}-active`}>
                    <Sparkle size={14} weight="duotone" className="inline -mt-0.5 mr-1" />
                    Already on Pro
                  </div>
                ) : (
                  <button
                    onClick={() => checkout(p.id)}
                    disabled={!!paying}
                    className="btn-primary text-sm py-3 disabled:opacity-60"
                    data-testid={`plan-${p.id}-cta`}
                  >
                    {paying === p.id ? "Opening checkout…" : "Upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center text-xs text-muted-foreground">
          Payments are handled by Razorpay. You will receive a receipt by email. Cancel anytime; your Pro features remain until the current period ends.
        </div>
      </div>
    </div>
  );
}
