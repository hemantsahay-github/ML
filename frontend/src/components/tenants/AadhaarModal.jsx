import { useState } from "react";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { ShieldCheck } from "@phosphor-icons/react";

function F({ label, children }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export default function AadhaarModal({ tenant, onClose, onVerified }) {
  const [step, setStep] = useState("initiate");
  const [form, setForm] = useState({
    aadhaar_last_4: "",
    phone: tenant.phone || "",
    name: tenant.name || "",
    otp: "",
  });
  const [txnId, setTxnId] = useState(null);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (form.aadhaar_last_4.length !== 4 || !/^\d{4}$/.test(form.aadhaar_last_4)) {
      toast.error("Aadhaar last-4 must be 4 digits");
      return;
    }
    if (!form.phone || !form.name) {
      toast.error("Phone and name required");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/verify/aadhaar/initiate", {
        subject_type: "tenant",
        subject_id: tenant.id,
        aadhaar_last_4: form.aadhaar_last_4,
        phone: form.phone,
        name: form.name,
      });
      setTxnId(data.txn_id);
      setStep("otp");
      toast.info(data.message);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (form.otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      await api.post("/verify/aadhaar/confirm", { txn_id: txnId, otp: form.otp });
      toast.success(`${tenant.name} — Aadhaar verified ✓`);
      onVerified();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="aadhaar-modal">
      <div className="absolute inset-0 bg-background/80" onClick={onClose} />
      <div className="relative card-flat w-full max-w-md mx-6 p-8">
        <div className="eyebrow mb-2 flex items-center gap-2 text-[hsl(var(--secondary))]">
          <ShieldCheck size={12} weight="fill" /> Aadhaar verification · {tenant.name}
        </div>
        <h3 className="font-serif text-3xl mb-1">{step === "initiate" ? "Verify identity" : "Enter OTP"}</h3>
        <p className="text-xs text-muted-foreground mb-5">Stub mode — no real Aadhaar data stored. Swap to Digio/Karza for production.</p>
        {step === "initiate" ? (
          <div className="space-y-3">
            <F label="Aadhaar last 4 digits *">
              <input
                className="input-dark w-full px-3 py-2 tracking-widest"
                maxLength={4}
                value={form.aadhaar_last_4}
                onChange={(e) => setForm({ ...form, aadhaar_last_4: e.target.value.replace(/\D/g, "") })}
                data-testid="aadhaar-last4"
              />
            </F>
            <F label="Aadhaar-linked phone *">
              <input
                className="input-dark w-full px-3 py-2"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                data-testid="aadhaar-phone"
              />
            </F>
            <F label="Name (as on Aadhaar) *">
              <input
                className="input-dark w-full px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </F>
            <div className="flex gap-3 pt-3">
              <button onClick={start} disabled={loading} className="btn-primary px-5 py-2.5 text-sm flex-1" data-testid="aadhaar-send-otp">
                {loading ? "Sending OTP…" : "Send OTP"}
              </button>
              <button onClick={onClose} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              OTP sent to phone ending {form.phone.slice(-4)}. In stub mode, any 6 digits work.
            </p>
            <F label="6-digit OTP *">
              <input
                className="input-dark w-full px-3 py-2 text-xl tracking-[0.5em] text-center"
                maxLength={6}
                value={form.otp}
                onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, "") })}
                data-testid="aadhaar-otp"
              />
            </F>
            <div className="flex gap-3 pt-3">
              <button onClick={confirm} disabled={loading} className="btn-primary px-5 py-2.5 text-sm flex-1" data-testid="aadhaar-verify">
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button onClick={() => setStep("initiate")} className="btn-ghost px-5 py-2.5 text-sm">Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
