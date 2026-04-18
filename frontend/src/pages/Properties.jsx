import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/format";
import { Plus, Trash, PencilSimple, X, MapPin } from "@phosphor-icons/react";

const blank = {
  name: "",
  type: "flat",
  location: "",
  price: 7500000,
  area_sqft: 1200,
  down_payment: 2000000,
  loan_rate: 8.5,
  loan_tenure_years: 20,
  maintenance_monthly: 4000,
  property_tax_yearly: 12000,
  expected_appreciation: 6,
  rental_yield: 3,
  notes: "",
  score_location: 7,
  score_amenities: 7,
  score_safety: 8,
  score_commute: 6,
  score_resale: 7,
};

export default function Properties() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // editing form
  const [isEdit, setIsEdit] = useState(false);
  const [cities, setCities] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/properties");
      setItems(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get("/presets/cities").then(({ data }) => setCities(data.cities || [])).catch(() => {});
  }, []);

  const openNew = () => {
    setForm({ ...blank });
    setIsEdit(false);
  };

  const openEdit = (p) => {
    setForm({ ...p });
    setIsEdit(true);
  };

  const close = () => {
    setForm(null);
    setIsEdit(false);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      delete payload.id;
      delete payload.user_id;
      delete payload.created_at;
      // coerce numbers
      [
        "price",
        "area_sqft",
        "down_payment",
        "loan_rate",
        "loan_tenure_years",
        "maintenance_monthly",
        "property_tax_yearly",
        "expected_appreciation",
        "rental_yield",
        "score_location",
        "score_amenities",
        "score_safety",
        "score_commute",
        "score_resale",
      ].forEach((k) => (payload[k] = Number(payload[k])));
      if (isEdit) {
        await api.put(`/properties/${form.id}`, payload);
        toast.success("Property updated");
      } else {
        await api.post("/properties", payload);
        toast.success("Property saved");
      }
      close();
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this property?")) return;
    try {
      await api.delete(`/properties/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10" data-testid="properties-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="eyebrow mb-2">Your candidates</div>
          <h1 className="font-serif text-5xl">Property ledger.</h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Every flat, villa or plot on your shortlist — with the numbers and your gut-feel
            scores sitting side by side.
          </p>
        </div>
        <button onClick={openNew} className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2" data-testid="add-property-button">
          <Plus size={16} weight="bold" /> Add property
        </button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card-flat p-12 text-center">
          <div className="font-serif text-3xl mb-3">Nothing added yet.</div>
          <p className="text-muted-foreground mb-6">Add your first candidate to unlock scoring and comparisons.</p>
          <button onClick={openNew} className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2">
            <Plus size={16} weight="bold" /> Add property
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((p) => (
            <div key={p.id} className="card-flat p-6" data-testid={`property-card-${p.id}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="eyebrow">{p.type}</div>
                  <div className="font-serif text-2xl mt-1">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.location}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="btn-ghost p-2" title="Edit" data-testid={`edit-${p.id}`}>
                    <PencilSimple size={14} />
                  </button>
                  <button onClick={() => remove(p.id)} className="btn-ghost p-2" title="Delete" data-testid={`delete-${p.id}`}>
                    <Trash size={14} />
                  </button>
                </div>
              </div>
              <div className="num-metric text-3xl mt-4">{inr(p.price)}</div>
              <div className="text-xs text-muted-foreground mt-1">{p.area_sqft} sqft · ₹{Math.round(p.price / (p.area_sqft || 1)).toLocaleString("en-IN")}/sqft</div>
              <div className="mt-4 pt-4 border-t hairline grid grid-cols-3 gap-2 text-xs">
                <Stat label="Loan" value={`${p.loan_rate}%`} />
                <Stat label="Tenure" value={`${p.loan_tenure_years}y`} />
                <Stat label="Appr." value={`${p.expected_appreciation}%`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ["Loc", p.score_location],
                  ["Amen", p.score_amenities],
                  ["Safe", p.score_safety],
                  ["Comm", p.score_commute],
                  ["Resale", p.score_resale],
                ].map(([l, v]) => (
                  <span key={l} className="text-xs px-2 py-1 border hairline text-muted-foreground">
                    {l} · <span className="text-foreground">{v}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Drawer onClose={close} title={isEdit ? "Edit property" : "Add property"}>
          <form onSubmit={save} className="space-y-5" data-testid="property-form">
            <Field label="Name" required>
              <input className="input-dark w-full px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="form-name" />
            </Field>

            {cities.length > 0 && (
              <div className="border hairline bg-[hsl(var(--muted))] p-4">
                <div className="flex items-center gap-2 mb-3 text-[hsl(var(--secondary))]">
                  <MapPin size={14} weight="duotone" />
                  <span className="eyebrow text-[hsl(var(--secondary))]">Apply city preset</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cities.map((c) => (
                    <button
                      type="button"
                      key={c.city}
                      onClick={() =>
                        setForm({
                          ...form,
                          location: c.city,
                          expected_appreciation: c.expected_appreciation,
                          rental_yield: c.rental_yield,
                        })
                      }
                      className="btn-ghost px-3 py-1.5 text-xs"
                      data-testid={`city-preset-${c.city.replace(/\s+/g, "-")}`}
                      title={c.notes}
                    >
                      {c.city} · {c.expected_appreciation}% / {c.rental_yield}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <select className="input-dark w-full px-3 py-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="form-type">
                  <option value="flat">Flat</option>
                  <option value="villa">Villa</option>
                  <option value="plot">Plot</option>
                  <option value="commercial">Commercial</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Location">
                <input className="input-dark w-full px-3 py-2" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} data-testid="form-location" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Price (₹)">
                <input type="number" className="input-dark w-full px-3 py-2" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="form-price" />
              </Field>
              <Field label="Area (sqft)">
                <input type="number" className="input-dark w-full px-3 py-2" value={form.area_sqft} onChange={(e) => setForm({ ...form, area_sqft: e.target.value })} data-testid="form-area" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Down payment (₹)">
                <input type="number" className="input-dark w-full px-3 py-2" value={form.down_payment} onChange={(e) => setForm({ ...form, down_payment: e.target.value })} />
              </Field>
              <Field label="Maint. / month">
                <input type="number" className="input-dark w-full px-3 py-2" value={form.maintenance_monthly} onChange={(e) => setForm({ ...form, maintenance_monthly: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Loan %">
                <input type="number" step="0.1" className="input-dark w-full px-3 py-2" value={form.loan_rate} onChange={(e) => setForm({ ...form, loan_rate: e.target.value })} />
              </Field>
              <Field label="Tenure (yrs)">
                <input type="number" className="input-dark w-full px-3 py-2" value={form.loan_tenure_years} onChange={(e) => setForm({ ...form, loan_tenure_years: e.target.value })} />
              </Field>
              <Field label="Appr. %">
                <input type="number" step="0.1" className="input-dark w-full px-3 py-2" value={form.expected_appreciation} onChange={(e) => setForm({ ...form, expected_appreciation: e.target.value })} />
              </Field>
            </div>
            <Field label="Rental yield %">
              <input type="number" step="0.1" className="input-dark w-full px-3 py-2" value={form.rental_yield} onChange={(e) => setForm({ ...form, rental_yield: e.target.value })} />
            </Field>

            <div className="border-t hairline pt-5">
              <div className="eyebrow mb-3">Your subjective scores (0–10)</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ["score_location", "Location"],
                  ["score_amenities", "Amenities"],
                  ["score_safety", "Safety"],
                  ["score_commute", "Commute"],
                  ["score_resale", "Resale"],
                ].map(([k, l]) => (
                  <Field key={k} label={l}>
                    <input type="number" min="0" max="10" step="0.5" className="input-dark w-full px-3 py-2" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </Field>
                ))}
              </div>
            </div>

            <Field label="Notes">
              <textarea className="input-dark w-full px-3 py-2" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>

            <div className="flex gap-3 pt-4">
              <button type="submit" className="btn-primary px-5 py-2.5 text-sm" data-testid="save-property-button">
                {isEdit ? "Save changes" : "Add property"}
              </button>
              <button type="button" onClick={close} className="btn-ghost px-5 py-2.5 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="eyebrow text-[0.6rem]">{label}</div>
      <div className="text-sm mt-1">{value}</div>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">
        {label}
        {required && " *"}
      </span>
      {children}
    </label>
  );
}

function Drawer({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="property-drawer">
      <div className="absolute inset-0 bg-background/70" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border-l hairline overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b hairline sticky top-0 bg-card z-10">
          <div className="font-serif text-2xl">{title}</div>
          <button onClick={onClose} className="btn-ghost p-2" data-testid="drawer-close">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
