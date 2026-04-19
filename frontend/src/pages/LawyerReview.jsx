import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle, XCircle, Buildings } from "@phosphor-icons/react";

export default function LawyerReview() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await api.get(`/public/will-review/${token}`);
        setData(res);
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Invalid review link");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async (status) => {
    setSubmitting(true);
    try {
      await api.post(`/public/will-review/${token}/submit`, { status, comments });
      setDone(status);
      toast.success(`Marked as ${status}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="lawyer-review-loading">Loading Will…</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="lawyer-review-invalid">Invalid or expired review link.</div>;
  const { review, will } = data;

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full card-flat p-10 text-center">
          {done === "reviewed" ? <CheckCircle size={48} weight="duotone" className="mx-auto text-[hsl(var(--secondary))] mb-3" /> : <XCircle size={48} weight="duotone" className="mx-auto text-destructive mb-3" />}
          <h1 className="font-serif text-3xl mb-2">Thank you.</h1>
          <p className="text-muted-foreground text-sm">The testator has been notified. You may close this tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b hairline">
        <div className="max-w-4xl mx-auto px-8 py-5 flex items-center gap-3">
          <div className="h-8 w-8 border hairline flex items-center justify-center">
            <span className="font-serif text-xl leading-none">E</span>
          </div>
          <span className="font-serif text-2xl">Estima · Lawyer Review</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-8 py-10" data-testid="lawyer-review">
        <div className="mb-8">
          <div className="eyebrow mb-2 text-[hsl(var(--secondary))]">For {review.lawyer_name}</div>
          <h1 className="font-serif text-5xl">Last Will and Testament</h1>
          <p className="text-muted-foreground mt-3">Testator: <b className="text-foreground">{will.testator_name || "—"}</b> · reviewed by you as legal counsel.</p>
        </div>

        <section className="card-flat p-6 mb-6">
          <div className="eyebrow mb-3">Testator details</div>
          <Row label="Name" v={will.testator_name || "—"} />
          <Row label="PAN" v={will.testator_pan || "—"} />
          <Row label="Address" v={will.testator_address || "—"} />
          <Row label="Executor" v={`${will.executor_name || "—"}${will.executor_relation ? ` (${will.executor_relation})` : ""}`} />
          {will.preamble_notes && (
            <div className="mt-4 pt-4 border-t hairline">
              <div className="eyebrow mb-2">Preamble notes</div>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{will.preamble_notes}</p>
            </div>
          )}
        </section>

        <section className="card-flat p-6 mb-6">
          <div className="eyebrow mb-3">Beneficiaries</div>
          <div className="space-y-2 text-sm">
            {will.beneficiaries?.length ? will.beneficiaries.map((b, i) => (
              <div key={b.email || b.name || `bene-${i}`} className="flex justify-between pb-2 border-b hairline last:border-0">
                <span>{b.name}</span>
                <span className="text-muted-foreground">{b.relation} {b.email && `· ${b.email}`}</span>
              </div>
            )) : <div className="text-muted-foreground">None listed.</div>}
          </div>
        </section>

        <section className="card-flat p-6 mb-6">
          <div className="eyebrow mb-3 flex items-center gap-2"><Buildings size={12} /> Property distribution</div>
          <div className="space-y-3 text-sm">
            {will.allocations?.length ? will.allocations.map((a, i) => (
              <div key={a.property_id || `alloc-${i}`} className="border hairline p-3">
                <div className="text-xs text-muted-foreground mb-1">Property {i + 1} · id: {a.property_id.slice(0, 8)}…</div>
                {a.splits?.map((s) => (
                  <div key={`${a.property_id}-${s.beneficiary_index}`} className="flex justify-between">
                    <span>{will.beneficiaries?.[s.beneficiary_index]?.name || `Beneficiary ${s.beneficiary_index + 1}`}</span>
                    <span className="num-metric">{s.percentage}%</span>
                  </div>
                ))}
              </div>
            )) : <div className="text-muted-foreground">None allocated.</div>}
          </div>
        </section>

        <section className="card-flat p-6 mb-6">
          <div className="eyebrow mb-3">Witnesses</div>
          <div className="text-sm space-y-1">
            <div>1. {will.witness_1 || "—"}</div>
            <div>2. {will.witness_2 || "—"}</div>
          </div>
        </section>

        <section className="card-flat p-6 mb-6">
          <div className="eyebrow mb-3">Your review</div>
          <textarea
            rows={4}
            className="input-dark w-full px-3 py-2 mb-4"
            placeholder="Enter your comments, suggested revisions, or approval note…"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            data-testid="lawyer-comments"
          />
          <div className="flex gap-3">
            <button onClick={() => submit("reviewed")} disabled={submitting} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2" data-testid="lawyer-approve">
              <CheckCircle size={14} /> Approve as reviewed
            </button>
            <button onClick={() => submit("rejected")} disabled={submitting} className="btn-ghost px-5 py-2.5 text-sm inline-flex items-center gap-2 border border-destructive text-destructive" data-testid="lawyer-reject">
              <XCircle size={14} /> Request revisions
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Row({ label, v }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b hairline last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
