import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { FilePdf, Plus, Trash, UserPlus, FloppyDisk, ShieldCheck } from "@phosphor-icons/react";
import Disclaimer from "../components/Disclaimer";

export default function Will() {
  const [form, setForm] = useState({
    testator_name: "",
    testator_pan: "",
    testator_address: "",
    executor_name: "",
    executor_relation: "",
    witness_1: "",
    witness_2: "",
    beneficiaries: [{ name: "", relation: "", email: "", phone: "", notes: "" }],
    allocations: [],
    preamble_notes: "",
  });
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
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
                  name: b.name || "",
                  relation: b.relation || "",
                  email: b.email || "",
                  phone: b.phone || "",
                  notes: b.notes || "",
                }))
              : [{ name: "", relation: "", email: "", phone: "", notes: "" }],
            allocations: w.data.allocations || [],
            preamble_notes: w.data.preamble_notes || "",
          });
        }
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addBene = () =>
    setForm({ ...form, beneficiaries: [...form.beneficiaries, { name: "", relation: "", email: "", phone: "", notes: "" }] });
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

  if (loading) return <div className="max-w-7xl mx-auto px-8 py-12 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto px-8 py-10" data-testid="will-page">
      <div className="mb-8">
        <div className="eyebrow mb-2">Succession planning</div>
        <h1 className="font-serif text-5xl">Draft your Will.</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Distribute your properties to the next generation with clarity. Draft, save, and download a printable PDF. Review with a lawyer before signing — our Wills comply with the Indian Succession Act format.
        </p>
      </div>

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
            <div key={i} className="border hairline p-4" data-testid={`will-bene-${i}`}>
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
                        <div key={bi} className="flex items-center gap-3 text-sm">
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

      <div className="flex gap-3 sticky bottom-4 bg-background/80 backdrop-blur p-3 border hairline">
        <button onClick={save} disabled={saving} className="btn-ghost px-5 py-2.5 text-sm inline-flex items-center gap-2" data-testid="will-save">
          <FloppyDisk size={14} /> {saving ? "Saving…" : "Save draft"}
        </button>
        <button onClick={downloadPdf} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2" data-testid="will-download-pdf">
          <FilePdf size={14} /> Download PDF
        </button>
      </div>

      <Disclaimer />
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
