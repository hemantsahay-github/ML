import { useState } from "react";
import api, { formatApiErrorDetail } from "../../lib/api";
import { logger } from "../../lib/logger";
import { toast } from "sonner";
import { Gavel } from "@phosphor-icons/react";

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function BrowseLawyersModal({ open, onClose, onPaid, onSaveDraft, onSwitchManual }) {
  const [lawyersList, setLawyersList] = useState([]);
  const [lawyersLoading, setLawyersLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [bookNote, setBookNote] = useState("");
  const [bookingId, setBookingId] = useState(null);

  // Lazy-load lawyers when modal opens
  if (open && !loadedOnce && !lawyersLoading) {
    setLawyersLoading(true);
    setLoadedOnce(true);
    api.get("/lawyers")
      .then(({ data }) => setLawyersList(data.lawyers || []))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)))
      .finally(() => setLawyersLoading(false));
  }

  const bookLawyer = async (lawyer) => {
    setBookingId(lawyer.id);
    await onSaveDraft();
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast.error("Razorpay SDK failed to load");
        return;
      }
      const { data } = await api.post("/will/book-lawyer", { lawyer_id: lawyer.id, note: bookNote });
      const rzp = new window.Razorpay({
        key: data.razorpay_key_id,
        amount: data.amount,
        currency: data.currency,
        name: "Estima · Counsel review",
        description: `Will review by ${lawyer.name}`,
        order_id: data.order_id,
        theme: { color: "#C85A32" },
        handler: async (resp) => {
          try {
            await api.post("/will/book-lawyer/verify", {
              token: data.token,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success(`Paid · ${lawyer.name} has been notified.`);
            onPaid?.();
            onClose();
          } catch (e) {
            logger.error("razorpay verify failed", e);
            toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Verification failed");
          }
        },
        modal: { ondismiss: () => setBookingId(null) },
      });
      rzp.open();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setBookingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80" onClick={onClose} />
      <div className="relative card-flat w-full max-w-3xl mx-6 p-8 max-h-[85vh] overflow-y-auto" data-testid="will-browse-modal">
        <div className="eyebrow mb-2 flex items-center gap-2 text-[hsl(var(--secondary))]">
          <Gavel size={14} weight="fill" /> Ask Estima Counsel
        </div>
        <h3 className="font-serif text-3xl mb-2">Pick a verified lawyer.</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Pay the lawyer&apos;s fee securely via Razorpay. They get a secure link to review, endorse and comment on your Will within 30 days. Platform fee is 10%.
        </p>
        <label className="block mb-5">
          <span className="eyebrow block mb-1.5">Private note to the lawyer (optional)</span>
          <textarea
            rows={2}
            className="input-dark w-full px-3 py-2"
            value={bookNote}
            onChange={(e) => setBookNote(e.target.value)}
            placeholder="Anything context-specific they should know…"
            data-testid="will-book-note"
          />
        </label>
        {lawyersLoading ? (
          <div className="text-center py-10 text-muted-foreground" data-testid="will-browse-loading">
            Loading lawyers…
          </div>
        ) : lawyersList.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground" data-testid="will-browse-empty">
            No verified lawyers are available yet. Try again soon — or{" "}
            <button onClick={onSwitchManual} className="underline">
              bring your own lawyer
            </button>
            .
          </div>
        ) : (
          <div className="space-y-3">
            {lawyersList.map((lw) => (
              <div key={lw.id} className="border hairline p-4" data-testid={`will-lawyer-card-${lw.id.slice(0, 8)}`}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="font-serif text-xl">{lw.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {lw.specialization} · {lw.endorsement_count} endorsement{lw.endorsement_count === 1 ? "" : "s"}
                    </div>
                    {lw.bio && <div className="text-xs text-muted-foreground mt-2 max-w-lg">{lw.bio}</div>}
                  </div>
                  <div className="text-right">
                    <div className="num-metric text-2xl">₹{Number(lw.rate_inr).toLocaleString("en-IN")}</div>
                    <div className="text-[10px] text-muted-foreground">per review</div>
                    <button
                      onClick={() => bookLawyer(lw)}
                      disabled={bookingId === lw.id}
                      className="btn-primary px-4 py-2 text-xs mt-2 inline-flex items-center gap-2"
                      data-testid={`will-book-${lw.id.slice(0, 8)}`}
                    >
                      {bookingId === lw.id ? "Opening…" : <>Book · pay ₹{Number(lw.rate_inr).toLocaleString("en-IN")}</>}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} className="btn-ghost px-5 py-2.5 text-sm mt-6">
          Close
        </button>
      </div>
    </div>
  );
}
