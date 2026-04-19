import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle } from "@phosphor-icons/react";

export default function WitnessSign() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [form, setForm] = useState({ aadhaar_last_4: "", otp: "" });
  const [step, setStep] = useState("info"); // info | otp

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await api.get(`/public/witness-sign/${token}`);
        setData(res);
        if (res.witness.status === "signed") setSigned(true);
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Invalid witness link");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const sendOtp = () => {
    if (form.aadhaar_last_4.length !== 4) {
      toast.error("Enter Aadhaar last 4 digits");
      return;
    }
    toast.info("OTP sent to your Aadhaar-linked phone (stub: any 6 digits work)");
    setStep("otp");
  };

  const sign = async () => {
    if (form.otp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/public/witness-sign/${token}`, form);
      setSigned(true);
      toast.success("Signed successfully.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Invalid link.</div>;

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full card-flat p-10 text-center">
          <CheckCircle size={48} weight="duotone" className="mx-auto text-[hsl(var(--secondary))] mb-3" />
          <h1 className="font-serif text-3xl mb-2">Thank you.</h1>
          <p className="text-muted-foreground text-sm">Your e-signature has been recorded. The testator has been notified.</p>
        </div>
      </div>
    );
  }

  const w = data.witness;
  const s = data.will_summary;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-lg w-full card-flat p-8" data-testid="witness-sign">
        <div className="eyebrow mb-2 text-[hsl(var(--secondary))] flex items-center gap-2"><ShieldCheck size={12} weight="fill" /> Witness e-sign · Aadhaar-linked</div>
        <h1 className="font-serif text-4xl mb-3">Witness this Will.</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Hi <b className="text-foreground">{w.witness_name}</b>, <b className="text-foreground">{s.testator_name}</b> has named you as a witness on their Last Will and Testament. Please verify your identity via Aadhaar OTP to e-sign.
        </p>
        <div className="grid grid-cols-3 gap-3 text-xs mb-6 p-4 bg-[hsl(var(--muted))]">
          <div><div className="text-muted-foreground">Testator</div><div className="text-foreground font-medium mt-1">{s.testator_name}</div></div>
          <div><div className="text-muted-foreground">Beneficiaries</div><div className="text-foreground font-medium mt-1">{s.beneficiaries_count}</div></div>
          <div><div className="text-muted-foreground">Properties</div><div className="text-foreground font-medium mt-1">{s.properties_count}</div></div>
        </div>
        {step === "info" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="eyebrow block mb-1.5">Your Aadhaar last 4 digits *</span>
              <input className="input-dark w-full px-3 py-2 tracking-widest" maxLength={4} value={form.aadhaar_last_4} onChange={(e) => setForm({ ...form, aadhaar_last_4: e.target.value.replace(/\D/g, "") })} data-testid="witness-last4" />
            </label>
            <button onClick={sendOtp} className="btn-primary w-full py-3 text-sm inline-flex items-center justify-center gap-2" data-testid="witness-send-otp">
              Send OTP to Aadhaar phone
            </button>
            <p className="text-[11px] text-muted-foreground text-center">By continuing, you declare you are not a beneficiary and are at least 18.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="eyebrow block mb-1.5">6-digit OTP *</span>
              <input className="input-dark w-full px-3 py-2 text-xl tracking-[0.5em] text-center" maxLength={6} value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, "") })} data-testid="witness-otp" />
            </label>
            <button onClick={sign} disabled={submitting} className="btn-primary w-full py-3 text-sm" data-testid="witness-sign-btn">
              {submitting ? "Recording signature…" : "Sign"}
            </button>
            <button onClick={() => setStep("info")} className="btn-ghost w-full py-2 text-xs">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
