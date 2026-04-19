import { useEffect, useState, useCallback } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { FilePdf, Plus, Trash, UserPlus, FloppyDisk, ShieldCheck, Sparkle, Gavel, PaperPlaneTilt, Bell, CheckCircle, Clock } from "@phosphor-icons/react";
import Disclaimer from "../components/Disclaimer";

function newBene() {
  return { _k: (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}-${Math.random()}`), name: "", relation: "", email: "", phone: "", notes: "" };
}

export default function Will() {
  const [form, setForm] = useState({
    testator_name: "",
    testator_pan: "",
    testator_address: "",
    executor_name: "",
    executor_relation: "",
    witness_1: "",
    witness_2: "",
    beneficiaries: [newBene()],
    allocations: [],
    preamble_notes: "",
  });
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadInitial = useCallback(async () => {
    try {
      const [w, p] = await Promise.all([api.get("/will"), api.get("/properties")]);
      setProperties(p.data.filter((x) => x.status === "owned" || x.status === "evaluating"));
      if (w.data.exists) {
        setForm({
          testator_name: w.data.testator_name || "",
          testator_pan: w.data.testator_pan || "",
          testator_address: w.data.testator_address || "",
          executor_name: w.data.executor_name || "",
          executor_relation: w.data.executor_relation || "",
          witness_1: w.data.witness_1 || "",
          witness_2: w.data.witness_2 || "",
          beneficiaries: w.data.beneficiaries?.length
            ? w.data.beneficiaries.map((b) => ({
                ...newBene(),
                name: b.name || "",
                relation: b.relation || "",
                email: b.email || "",
                phone: b.phone || "",
                notes: b.notes || "",
              }))
            : [newBene()],
          allocations: w.data.allocations || [],
          preamble_notes: w.data.preamble_notes || "",
        });
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const addBene = () =>
    setForm({ ...form, beneficiaries: [...form.beneficiaries, newBene()] });
  const delBene = (i) =>
    setForm({
      ...form,
      beneficiaries: form.beneficiaries.filter((_, j) => j !== i),
      allocations: form.allocations.map((a) => ({
        ...a,
        splits: a.splits.filter((s) => s.beneficiary_index !== i).map((s) => ({
          ...s,
          beneficiary_index: s.beneficiary_index > i ? s.beneficiary_index - 1 : s.beneficiary_index,
        })),
      })),
    });
  const updateBene = (i, k, v) =>
    setForm({ ...form, beneficiaries: form.beneficiaries.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });

  const allocationsByProp = (pid) => form.allocations.find((a) => a.property_id === pid) || { property_id: pid, splits: [] };
  const setAllocation = (pid, splits) => {
    const others = form.allocations.filter((a) => a.property_id !== pid);
    setForm({ ...form, allocations: [...others, { property_id: pid, splits }] });
  };
  const updateSplit = (pid, bi, pct) => {
    const cur = allocationsByProp(pid);
    const next = cur.splits.some((s) => s.beneficiary_index === bi)
      ? cur.splits.map((s) => (s.beneficiary_index === bi ? { ...s, percentage: Number(pct) } : s))
      : [...cur.splits, { beneficiary_index: bi, percentage: Number(pct) }];
    setAllocation(pid, next.filter((s) => s.percentage > 0));
  };

  const validate = () => {
    for (const a of form.allocations) {
      const total = a.splits.reduce((s, x) => s + Number(x.percentage || 0), 0);
      if (total > 100) {
        const p = properties.find((x) => x.id === a.property_id);
        toast.error(`"${p?.name}" allocates ${total}% — must be ≤ 100%`);
        return false;
      }
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post("/will", form);
      toast.success("Will draft saved");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    if (!validate()) return;
    await save();
    try {
      const res = await api.get("/will/pdf", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `last-will-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded Will draft");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const [aiOpen, setAiOpen] = useState(false);
  const [aiForm, setAiForm] = useState({ family_context: "", distribution_style: "equal", custom_note: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState("");

  // Signatures & review state
  const [sigs, setSigs] = useState(null);
  const loadSigs = useCallback(async () => {
    try {
      const { data } = await api.get("/will/signatures");
      setSigs(data);
    } catch (e) {
      console.debug("will/signatures load failed", e);
    }
  }, []);
  useEffect(() => { loadSigs(); }, [loadSigs]);

  const [lawyerForm, setLawyerForm] = useState({ lawyer_name: "", lawyer_email: "", lawyer_phone: "", note: "" });
  const [lawyerOpen, setLawyerOpen] = useState(false);

  const sendLawyer = async () => {
    if (!lawyerForm.lawyer_name || !lawyerForm.lawyer_email) {
      toast.error("Lawyer name + email are required");
      return;
    }
    await save();
    try {
      const { data } = await api.post("/will/send-for-lawyer-review", lawyerForm);
      toast.success(`Sent to ${lawyerForm.lawyer_name} · review link: ${data.review_url}`, { duration: 15000 });
      setLawyerOpen(false);
      loadSigs();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const [witnessOpen, setWitnessOpen] = useState(null); // 0 or 1
  const [witnessForm, setWitnessForm] = useState({ witness_name: "", witness_email: "", witness_phone: "" });

  // Ask-a-lawyer marketplace
  const [browseOpen, setBrowseOpen] = useState(false);
  const [lawyersList, setLawyersList] = useState([]);
  const [lawyersLoading, setLawyersLoading] = useState(false);
  const [bookNote, setBookNote] = useState("");
  const [bookingId, setBookingId] = useState(null);

  const openBrowse = async () => {
    setBrowseOpen(true);
    if (lawyersList.length > 0) return;
    setLawyersLoading(true);
    try {
      const { data } = await api.get("/lawyers");
      setLawyersList(data.lawyers || []);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLawyersLoading(false);
    }
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

  const bookLawyer = async (lawyer) => {
    setBookingId(lawyer.id);
    await save();
    try {
      const ok = await loadRazorpay();
      if (!ok) { toast.error("Razorpay SDK failed to load"); return; }
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
            setBrowseOpen(false);
            loadSigs();
          } catch (e) {
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

  const inviteWitness = async () => {
    if (!witnessForm.witness_name || !witnessForm.witness_email || !witnessForm.witness_phone) {
      toast.error("All witness fields required");
      return;
    }
    await save();
    try {
      const { data } = await api.post("/will/invite-witness", { witness_index: witnessOpen, ...witnessForm });
      toast.success(`Sent · sign link: ${data.sign_url}`, { duration: 15000 });
      setWitnessOpen(null);
      setWitnessForm({ witness_name: "", witness_email: "", witness_phone: "" });
      loadSigs();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyForm, setNotifyForm] = useState({ personal_note: "", cc_lawyer: true });

  const notifyBene = async () => {
    const missing = form.beneficiaries.filter((b) => !b.email);
    if (missing.length) {
      toast.error(`Add email for: ${missing.map((b) => b.name || "(unnamed)").join(", ")}`);
      return;
    }
    await save();
    try {
      const { data } = await api.post("/will/notify-beneficiaries", notifyForm);
      toast.success(`Sent to ${data.count} beneficiary email${data.count === 1 ? "" : "s"} · Review due ${data.review_due_at.slice(0, 10)}`);
      setNotifyOpen(false);
      loadSigs();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const aiDraft = async () => {
    if (!aiForm.family_context.trim()) {
      toast.error("Describe your family situation first");
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await api.post("/will/ai-draft", aiForm);
      setForm({
        ...form,
        beneficiaries: data.beneficiaries.length
          ? data.beneficiaries.map((b) => ({
              ...newBene(),
              name: b.name || "",
              relation: b.relation || "",
              email: "",
              phone: "",
              notes: b.suggested_share_note || "",
            }))
          : form.beneficiaries,
        allocations: data.allocations || [],
      });
      setAiReasoning(data.reasoning || "");
      setAiOpen(false);
      toast.success(`AI drafted ${data.allocations.length} property allocation${data.allocations.length === 1 ? "" : "s"} — review and edit`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "AI draft failed");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-8 py-12 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto px-8 py-10" data-testid="will-page">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-2">Succession planning</div>
          <h1 className="font-serif text-5xl">Draft your Will.</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Distribute your properties to the next generation with clarity. Draft, save, and download a printable PDF. Review with a lawyer before signing — our Wills comply with the Indian Succession Act format.
          </p>
        </div>
        <button
          onClick={() => setAiOpen(true)}
          className="btn-ghost px-4 py-2.5 text-sm inline-flex items-center gap-2 border border-[hsl(var(--secondary))] text-[hsl(var(--secondary))]"
          data-testid="will-ai-open"
        >
          <Sparkle size={14} weight="duotone" /> AI-draft a distribution
        </button>
      </div>

      {aiReasoning && (
        <div className="card-flat p-5 mb-6 border-[hsl(var(--secondary))]" data-testid="will-ai-reasoning">
          <div className="eyebrow text-[hsl(var(--secondary))] mb-2 flex items-center gap-2"><Sparkle size={12} weight="fill" /> AI reasoning</div>
          <div className="text-sm text-muted-foreground whitespace-pre-line">{aiReasoning}</div>
        </div>
      )}

      {/* Testator */}
      <section className="card-flat p-6 mb-6">
        <div className="eyebrow mb-3 flex items-center gap-2"><ShieldCheck size={14} /> Testator (you)</div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Full legal name *" value={form.testator_name} onChange={(v) => setForm({ ...form, testator_name: v })} dt="will-testator-name" />
          <Field label="PAN (optional)" value={form.testator_pan} onChange={(v) => setForm({ ...form, testator_pan: v })} />
        </div>
        <Field label="Address" value={form.testator_address} onChange={(v) => setForm({ ...form, testator_address: v })} area />
        <Field label="Preamble / personal notes (optional)" value={form.preamble_notes} onChange={(v) => setForm({ ...form, preamble_notes: v })} area />
      </section>

      {/* Executor */}
      <section className="card-flat p-6 mb-6">
        <div className="eyebrow mb-3">Executor</div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Executor name" value={form.executor_name} onChange={(v) => setForm({ ...form, executor_name: v })} dt="will-executor" />
          <Field label="Relation" value={form.executor_relation} onChange={(v) => setForm({ ...form, executor_relation: v })} />
        </div>
      </section>

      {/* Beneficiaries */}
      <section className="card-flat p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">Beneficiaries</div>
          <button onClick={addBene} className="btn-ghost text-xs px-3 py-1.5 inline-flex items-center gap-1" data-testid="will-add-bene">
            <UserPlus size={12} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {form.beneficiaries.map((b, i) => (
            <div key={b._k || `bene-${i}`} className="border hairline p-4" data-testid={`will-bene-${i}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="eyebrow">Beneficiary {i + 1}</span>
                {form.beneficiaries.length > 1 && (
                  <button onClick={() => delBene(i)} className="btn-ghost p-1"><Trash size={12} /></button>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Full name *" value={b.name} onChange={(v) => updateBene(i, "name", v)} dt={`will-bene-name-${i}`} />
                <Field label="Relation" value={b.relation} onChange={(v) => updateBene(i, "relation", v)} />
                <Field label="Email" value={b.email} onChange={(v) => updateBene(i, "email", v)} />
                <Field label="Phone" value={b.phone} onChange={(v) => updateBene(i, "phone", v)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Allocations */}
      <section className="card-flat p-6 mb-6">
        <div className="eyebrow mb-3">Property distribution</div>
        {properties.length === 0 ? (
          <div className="text-sm text-muted-foreground">Add properties first from the Properties page — then return to allocate them.</div>
        ) : (
          <div className="space-y-5">
            {properties.map((p) => {
              const alloc = allocationsByProp(p.id);
              const total = alloc.splits.reduce((s, x) => s + Number(x.percentage || 0), 0);
              return (
                <div key={p.id} className="border hairline p-4" data-testid={`will-prop-${p.id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-serif text-xl">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.location} · {p.type}</div>
                    </div>
                    <div className={`text-xs ${total === 100 ? "text-[hsl(var(--secondary))]" : total > 100 ? "text-destructive" : "text-muted-foreground"}`}>
                      Allocated: {total}%
                    </div>
                  </div>
                  <div className="space-y-2">
                    {form.beneficiaries.map((b, bi) => {
                      const s = alloc.splits.find((x) => x.beneficiary_index === bi);
                      return (
                        <div key={b._k || `split-${p.id}-${bi}`} className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground flex-1 truncate">{b.name || `Beneficiary ${bi + 1}`}</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="input-dark px-2 py-1 w-20 text-sm"
                            value={s?.percentage || 0}
                            onChange={(e) => updateSplit(p.id, bi, e.target.value)}
                            data-testid={`will-split-${p.id}-${bi}`}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Witnesses */}
      <section className="card-flat p-6 mb-6">
        <div className="eyebrow mb-3">Witnesses (two non-beneficiaries)</div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Witness 1" value={form.witness_1} onChange={(v) => setForm({ ...form, witness_1: v })} />
          <Field label="Witness 2" value={form.witness_2} onChange={(v) => setForm({ ...form, witness_2: v })} />
        </div>
      </section>

      {/* Review & Signatures */}
      <section className="card-flat p-6 mb-6" data-testid="will-signatures-section">
        <div className="eyebrow mb-4 flex items-center gap-2"><Gavel size={14} /> Review &amp; signatures</div>

        {/* Lawyer review */}
        <div className="mb-5 pb-5 border-b hairline">
          <div className="flex items-start justify-between mb-2 gap-3">
            <div>
              <div className="font-serif text-xl">Lawyer review</div>
              <div className="text-xs text-muted-foreground mt-1">Send your Will to a lawyer for review. They get a secure link to approve or request revisions.</div>
            </div>
            {sigs?.review?.status === "reviewed" ? (
              <span className="text-xs px-2 py-1 bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))] inline-flex items-center gap-1"><CheckCircle size={10} weight="fill" /> Reviewed by {sigs.review.lawyer_name}</span>
            ) : sigs?.review?.status === "rejected" ? (
              <span className="text-xs px-2 py-1 bg-destructive/10 text-destructive">Revisions requested</span>
            ) : sigs?.review?.status === "pending" ? (
              <span className="text-xs px-2 py-1 bg-[hsl(var(--muted))] text-muted-foreground inline-flex items-center gap-1"><Clock size={10} /> Pending · {sigs.review.lawyer_name}</span>
            ) : null}
          </div>
          {sigs?.review?.review_comments && (
            <div className="text-xs text-muted-foreground italic bg-[hsl(var(--muted))] p-3 mt-2">
              "{sigs.review.review_comments}" — {sigs.review.lawyer_name}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={openBrowse} className="btn-primary px-4 py-2 text-xs inline-flex items-center gap-2" data-testid="will-browse-lawyers">
              <Gavel size={12} weight="bold" /> Browse Estima Counsel
            </button>
            <button onClick={() => setLawyerOpen(true)} className="btn-ghost px-4 py-2 text-xs inline-flex items-center gap-2" data-testid="will-send-lawyer">
              <PaperPlaneTilt size={12} /> {sigs?.review ? "Send to another lawyer" : "Or bring your own lawyer"}
            </button>
          </div>
        </div>

        {/* Witnesses e-sign */}
        <div className="mb-5 pb-5 border-b hairline">
          <div className="font-serif text-xl mb-2">Witness e-signatures</div>
          <div className="text-xs text-muted-foreground mb-3">Two witnesses (non-beneficiaries) sign via Aadhaar OTP.</div>
          <div className="space-y-2">
            {[0, 1].map((idx) => {
              const invited = sigs?.witnesses?.find((w) => w.witness_index === idx);
              const name = idx === 0 ? form.witness_1 : form.witness_2;
              return (
                <div key={idx} className="flex items-center justify-between border hairline p-3 text-sm" data-testid={`witness-row-${idx}`}>
                  <div>
                    <div>Witness {idx + 1}: <b>{invited?.witness_name || name || "—"}</b></div>
                    {invited && <div className="text-xs text-muted-foreground mt-0.5">{invited.witness_email}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {invited?.status === "signed" ? (
                      <span className="text-xs px-2 py-1 bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))] inline-flex items-center gap-1">
                        <CheckCircle size={10} weight="fill" /> Signed · ****{invited.aadhaar_last_4}
                      </span>
                    ) : (
                      <button onClick={() => { setWitnessOpen(idx); setWitnessForm({ witness_name: name || "", witness_email: "", witness_phone: "" }); }} className="btn-ghost px-3 py-1.5 text-xs" data-testid={`witness-invite-${idx}`}>
                        {invited ? "Resend sign link" : "Invite to e-sign"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notify beneficiaries */}
        <div>
          <div className="font-serif text-xl mb-2 flex items-center gap-2"><Bell size={14} /> Notify beneficiaries</div>
          <div className="text-xs text-muted-foreground mb-3">
            Send each beneficiary a password-protected PDF copy (password = their first-name lowercase + last 4 of phone). Optionally CCs your lawyer.
          </div>
          {sigs?.notifications_sent?.length > 0 && (
            <div className="text-xs text-[hsl(var(--secondary))] mb-2" data-testid="notify-sent-count">
              ✓ {sigs.notifications_sent.length} notification{sigs.notifications_sent.length === 1 ? "" : "s"} sent
            </div>
          )}
          <button onClick={() => setNotifyOpen(true)} className="btn-primary px-4 py-2 text-xs inline-flex items-center gap-2" data-testid="will-notify">
            <Bell size={12} /> Notify beneficiaries
          </button>
          {sigs?.review_due_at && (
            <div className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
              <Clock size={11} /> Next review reminder: {new Date(sigs.review_due_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
            </div>
          )}
        </div>
      </section>

      <div className="flex gap-3 sticky bottom-4 bg-background/80 backdrop-blur p-3 border hairline">
        <button onClick={save} disabled={saving} className="btn-ghost px-5 py-2.5 text-sm inline-flex items-center gap-2" data-testid="will-save">
          <FloppyDisk size={14} /> {saving ? "Saving…" : "Save draft"}
        </button>
        <button onClick={downloadPdf} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2" data-testid="will-download-pdf">
          <FilePdf size={14} /> Download PDF
        </button>
      </div>

      <Disclaimer />

      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80" onClick={() => setAiOpen(false)} />
          <div className="relative card-flat w-full max-w-lg mx-6 p-8" data-testid="will-ai-modal">
            <div className="eyebrow mb-2 flex items-center gap-2 text-[hsl(var(--secondary))]"><Sparkle size={14} weight="fill" /> AI-assisted Will</div>
            <h3 className="font-serif text-3xl mb-4">Describe your family.</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Claude Sonnet 4.5 will read your properties + family context and propose a sensible distribution. You can edit every line after.
            </p>
            <label className="block mb-4">
              <span className="eyebrow block mb-1.5">Family situation *</span>
              <textarea
                rows={4}
                className="input-dark w-full px-3 py-2"
                placeholder="e.g. Wife Priya + 2 children (Arjun 12, Ananya 8). Widowed mother Sunita lives with us."
                value={aiForm.family_context}
                onChange={(e) => setAiForm({ ...aiForm, family_context: e.target.value })}
                data-testid="will-ai-family"
              />
            </label>
            <label className="block mb-4">
              <span className="eyebrow block mb-1.5">Style</span>
              <select
                className="input-dark w-full px-3 py-2"
                value={aiForm.distribution_style}
                onChange={(e) => setAiForm({ ...aiForm, distribution_style: e.target.value })}
                data-testid="will-ai-style"
              >
                <option value="equal">Equal split across beneficiaries</option>
                <option value="spouse_first">Spouse gets majority of primary residence</option>
                <option value="legacy_trust">Trust for minor children</option>
                <option value="custom">Custom (describe below)</option>
              </select>
            </label>
            {aiForm.distribution_style === "custom" && (
              <label className="block mb-4">
                <span className="eyebrow block mb-1.5">Custom note</span>
                <textarea rows={2} className="input-dark w-full px-3 py-2" value={aiForm.custom_note} onChange={(e) => setAiForm({ ...aiForm, custom_note: e.target.value })} />
              </label>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={aiDraft} disabled={aiLoading} className="btn-primary px-5 py-2.5 text-sm flex-1 inline-flex items-center justify-center gap-2" data-testid="will-ai-go">
                {aiLoading ? "Claude is drafting…" : <><Sparkle size={14} /> Draft with AI</>}
              </button>
              <button onClick={() => setAiOpen(false)} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {browseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80" onClick={() => setBrowseOpen(false)} />
          <div className="relative card-flat w-full max-w-3xl mx-6 p-8 max-h-[85vh] overflow-y-auto" data-testid="will-browse-modal">
            <div className="eyebrow mb-2 flex items-center gap-2 text-[hsl(var(--secondary))]"><Gavel size={14} weight="fill" /> Ask Estima Counsel</div>
            <h3 className="font-serif text-3xl mb-2">Pick a verified lawyer.</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Pay the lawyer&apos;s fee securely via Razorpay. They get a secure link to review, endorse and comment on your Will within 30 days. Platform fee is 10%.
            </p>
            <label className="block mb-5">
              <span className="eyebrow block mb-1.5">Private note to the lawyer (optional)</span>
              <textarea rows={2} className="input-dark w-full px-3 py-2" value={bookNote} onChange={(e) => setBookNote(e.target.value)} placeholder="Anything context-specific they should know…" data-testid="will-book-note" />
            </label>
            {lawyersLoading ? (
              <div className="text-center py-10 text-muted-foreground" data-testid="will-browse-loading">Loading lawyers…</div>
            ) : lawyersList.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground" data-testid="will-browse-empty">
                No verified lawyers are available yet. Try again soon — or <button onClick={() => { setBrowseOpen(false); setLawyerOpen(true); }} className="underline">bring your own lawyer</button>.
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
            <button onClick={() => setBrowseOpen(false)} className="btn-ghost px-5 py-2.5 text-sm mt-6">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, area, dt }) {
  return (
    <label className="block mb-3">
      <span className="eyebrow block mb-1.5">{label}</span>
      {area ? (
        <textarea rows={2} className="input-dark w-full px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} data-testid={dt} />
      ) : (
        <input className="input-dark w-full px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} data-testid={dt} />
      )}
    </label>
  );
}
