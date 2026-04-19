import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/format";
import { Receipt, DownloadSimple, CreditCard, SignOut, UserCircle } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export default function TenantDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    month: new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    amount: 0,
    notes: "",
  });
  const [paying, setPaying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [m, r] = await Promise.all([api.get("/tenant/me"), api.get("/tenant/receipts")]);
      setMe(m.data);
      setReceipts(r.data);
      setPayForm((p) => ({ ...p, amount: m.data.tenant?.monthly_rent || 0 }));
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "tenant") {
      navigate("/app");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const doLogout = async () => {
    await logout();
    navigate("/");
  };

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const pay = async () => {
    if (!payForm.amount || payForm.amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast.error("Razorpay SDK failed to load");
        setPaying(false);
        return;
      }
      const { data } = await api.post("/tenant/pay/create-order", {
        month: payForm.month,
        amount: Number(payForm.amount),
        notes: payForm.notes,
      });
      const rzp = new window.Razorpay({
        key: data.razorpay_key_id,
        amount: data.amount,
        currency: data.currency,
        name: "Estima — Rent",
        description: `Rent for ${payForm.month}`,
        order_id: data.order_id,
        prefill: { email: me?.user?.email, name: me?.user?.name },
        theme: { color: "#C85A32" },
        handler: async (resp) => {
          try {
            await api.post("/tenant/pay/verify", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success("Payment verified · receipt generated");
            setPayOpen(false);
            load();
          } catch (e) {
            toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Verification failed");
          }
        },
      });
      rzp.open();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setPaying(false);
    }
  };

  const downloadReceipt = async (r) => {
    try {
      const res = await api.get(`/receipts/${r.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rent-receipt-${r.receipt_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background" data-testid="tenant-dashboard">
      <header className="border-b hairline">
        <div className="max-w-5xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 border hairline flex items-center justify-center">
              <span className="font-serif text-xl leading-none">E</span>
            </div>
            <span className="font-serif text-2xl">Estima · Tenant</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle size={16} weight="duotone" />
              {me?.user?.email}
            </div>
            <button onClick={doLogout} className="btn-ghost px-3 py-2 text-sm inline-flex items-center gap-2" data-testid="tenant-logout">
              <SignOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10">
        <div className="mb-10">
          <div className="eyebrow mb-2">Tenant portal</div>
          <h1 className="font-serif text-5xl">Hello, {me?.user?.name?.split(" ")[0] || "there"}.</h1>
          {me?.tenant && (
            <p className="text-muted-foreground mt-3">
              Renting <span className="text-foreground">{me.tenant.property_name}</span> · ₹{Number(me.tenant.monthly_rent).toLocaleString("en-IN")} per month
            </p>
          )}
        </div>

        {/* Pay rent CTA */}
        <div className="card-flat p-8 mb-10 border-[hsl(var(--secondary))]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="eyebrow text-[hsl(var(--secondary))] mb-1">Pay this month&apos;s rent</div>
              <div className="font-serif text-3xl">{payForm.month}</div>
              <div className="text-muted-foreground text-sm mt-1">Instant receipt on verified payment.</div>
            </div>
            <button
              onClick={() => setPayOpen(true)}
              className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2"
              data-testid="tenant-pay-rent-button"
            >
              <CreditCard size={16} weight="bold" /> Pay rent
            </button>
          </div>
        </div>

        {/* Receipts */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-3xl flex items-center gap-3">
              <Receipt size={22} weight="duotone" className="text-[hsl(var(--secondary))]" /> Rent receipts
            </h2>
            <span className="text-xs text-muted-foreground">{receipts.length} total</span>
          </div>
          {receipts.length === 0 ? (
            <div className="card-flat p-10 text-center text-muted-foreground" data-testid="tenant-receipts-empty">
              No receipts yet. Your first payment will show up here.
            </div>
          ) : (
            <div className="space-y-3">
              {receipts.map((r) => (
                <div key={r.id} className="card-flat p-5 flex items-center justify-between" data-testid={`tenant-receipt-${r.id}`}>
                  <div>
                    <div className="font-serif text-xl">{r.month}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      #{r.receipt_no} · {r.payment_mode} · paid on {r.paid_on}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="num-metric text-2xl">{inr(r.amount)}</div>
                    <button onClick={() => downloadReceipt(r)} className="btn-ghost p-3" title="Download PDF" data-testid={`tenant-receipt-dl-${r.id}`}>
                      <DownloadSimple size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Pay modal */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80" onClick={() => setPayOpen(false)} />
          <div className="relative card-flat w-full max-w-md mx-6 p-8" data-testid="tenant-pay-modal">
            <div className="eyebrow mb-2">Pay rent</div>
            <h3 className="font-serif text-3xl mb-6">Confirm payment</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="eyebrow block mb-1.5">Month</span>
                <input className="input-dark w-full px-3 py-2" value={payForm.month} onChange={(e) => setPayForm({ ...payForm, month: e.target.value })} data-testid="tenant-pay-month" />
              </label>
              <label className="block">
                <span className="eyebrow block mb-1.5">Amount ₹</span>
                <input type="number" className="input-dark w-full px-3 py-2" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} data-testid="tenant-pay-amount" />
              </label>
              <label className="block">
                <span className="eyebrow block mb-1.5">Notes</span>
                <textarea rows={2} className="input-dark w-full px-3 py-2" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={pay} disabled={paying} className="btn-primary px-5 py-2.5 text-sm flex-1" data-testid="tenant-pay-confirm">
                {paying ? "Opening Razorpay…" : `Pay ₹${Number(payForm.amount).toLocaleString("en-IN")}`}
              </button>
              <button onClick={() => setPayOpen(false)} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
