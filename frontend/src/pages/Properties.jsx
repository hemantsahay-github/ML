import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/format";
import { Plus, Trash, PencilSimple, X, MapPin, Megaphone, Sparkle, Copy, ArrowSquareOut } from "@phosphor-icons/react";
import NearbyMarketCard from "../components/NearbyMarketCard";

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
  status: "evaluating",
  purchase_date: "",
  purchase_price: "",
  current_value: "",
  current_loan_balance: "",
  monthly_rent_income: 0,
  rented: false,
  sold_date: "",
  sold_price: "",
};

export default function Properties() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // editing form
  const [isEdit, setIsEdit] = useState(false);
  const [cities, setCities] = useState([]);
  const [filter, setFilter] = useState("all"); // all | evaluating | owned
  const [listingFor, setListingFor] = useState(null); // property to list for rent

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
      // required numeric coercion
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
        "monthly_rent_income",
      ].forEach((k) => (payload[k] = Number(payload[k] || 0)));
      // optional owned numbers (empty string → null)
      ["purchase_price", "current_value", "current_loan_balance", "sold_price"].forEach((k) => {
        payload[k] = payload[k] === "" || payload[k] === null || payload[k] === undefined ? null : Number(payload[k]);
      });
      if (!payload.purchase_date) payload.purchase_date = null;
      if (!payload.sold_date) payload.sold_date = null;
      payload.rented = !!payload.rented;
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

  const filtered = items.filter((p) => {
    const status = p.status || "evaluating";
    if (filter === "all") return true;
    return status === filter;
  });
  const counts = {
    all: items.length,
    evaluating: items.filter((p) => (p.status || "evaluating") === "evaluating").length,
    owned: items.filter((p) => p.status === "owned").length,
    sold: items.filter((p) => p.status === "sold").length,
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
        <>
          <div className="border-b hairline mb-6 flex gap-1">
            {[
              ["all", "All"],
              ["evaluating", "Evaluating"],
              ["owned", "Owned"],
              ["sold", "Sold"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                data-testid={`filter-${id}`}
                className={`px-4 py-2.5 text-sm -mb-px border-b-2 transition ${
                  filter === id
                    ? "border-[hsl(var(--primary))] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label} <span className="text-muted-foreground ml-1">({counts[id]})</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card-flat p-12 text-center text-muted-foreground" data-testid="filter-empty">
              No {filter} properties yet.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p) => (
                <div key={p.id} className="card-flat p-6" data-testid={`property-card-${p.id}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="eyebrow">{p.type}</div>
                        <span
                          className={`text-[0.6rem] tracking-widest uppercase px-1.5 py-0.5 border ${
                            p.status === "owned"
                              ? "border-[hsl(var(--secondary))] text-[hsl(var(--secondary))]"
                              : p.status === "sold"
                                ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                                : "hairline text-muted-foreground"
                          }`}
                          data-testid={`status-badge-${p.id}`}
                        >
                          {p.status === "owned" ? "Owned" : p.status === "sold" ? "Sold" : "Evaluating"}
                        </span>
                      </div>
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
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.area_sqft} sqft · ₹{Math.round(p.price / (p.area_sqft || 1)).toLocaleString("en-IN")}/sqft
                  </div>
                  {p.status === "owned" && p.current_value ? (
                    <div className="mt-3 text-xs text-[hsl(var(--secondary))]">
                      Now worth {inr(p.current_value)}
                      {p.purchase_price
                        ? (() => {
                            const pct = ((p.current_value - p.purchase_price) / p.purchase_price) * 100;
                            return ` · ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
                          })()
                        : ""}
                    </div>
                  ) : null}
                  {p.status === "sold" && p.sold_price ? (
                    <div className="mt-3 text-xs" data-testid={`sold-summary-${p.id}`}>
                      {(() => {
                        const base = p.purchase_price || p.price || 0;
                        const gain = p.sold_price - base;
                        const pct = base ? (gain / base) * 100 : 0;
                        const positive = gain >= 0;
                        return (
                          <span className={positive ? "text-[hsl(var(--secondary))]" : "text-destructive"}>
                            Sold for {inr(p.sold_price)} · {positive ? "+" : ""}
                            {inr(gain)} ({positive ? "+" : ""}
                            {pct.toFixed(1)}%)
                            {p.sold_date
                              ? ` · ${new Date(p.sold_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`
                              : ""}
                          </span>
                        );
                      })()}
                    </div>
                  ) : null}
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
                  {p.status === "owned" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setListingFor(p); }}
                      className="btn-ghost w-full mt-3 py-2 text-xs inline-flex items-center justify-center gap-2 border border-dashed border-[hsl(var(--secondary))] text-[hsl(var(--secondary))]"
                      data-testid={`list-for-rent-${p.id}`}
                    >
                      <Megaphone size={12} weight="duotone" /> List for rent in 1 click
                    </button>
                  )}
                  <div onClick={(e) => e.stopPropagation()}>
                    <NearbyMarketCard property={p} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
              <div className="eyebrow mb-3">Status</div>
              <div className="flex gap-2 mb-4">
                {[
                  ["evaluating", "Evaluating"],
                  ["owned", "Owned"],
                  ["sold", "Sold"],
                ].map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setForm({ ...form, status: id })}
                    data-testid={`form-status-${id}`}
                    className={`px-4 py-2 text-sm border transition ${
                      form.status === id
                        ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white"
                        : "hairline text-muted-foreground hover:text-foreground hover:border-[hsl(var(--secondary))]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(form.status === "owned" || form.status === "sold") && (
                <div className="space-y-4" data-testid="owned-fields">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Purchase date">
                      <input
                        type="date"
                        className="input-dark w-full px-3 py-2"
                        value={form.purchase_date || ""}
                        onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                        data-testid="form-purchase-date"
                      />
                    </Field>
                    <Field label="Purchase price (₹)">
                      <input
                        type="number"
                        className="input-dark w-full px-3 py-2"
                        value={form.purchase_price ?? ""}
                        onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                        data-testid="form-purchase-price"
                      />
                    </Field>
                  </div>

                  {form.status === "owned" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Current value (₹)">
                          <input
                            type="number"
                            className="input-dark w-full px-3 py-2"
                            value={form.current_value ?? ""}
                            onChange={(e) => setForm({ ...form, current_value: e.target.value })}
                            data-testid="form-current-value"
                          />
                        </Field>
                        <Field label="Outstanding loan (₹)">
                          <input
                            type="number"
                            className="input-dark w-full px-3 py-2"
                            value={form.current_loan_balance ?? ""}
                            onChange={(e) => setForm({ ...form, current_loan_balance: e.target.value })}
                            data-testid="form-current-loan"
                          />
                        </Field>
                      </div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!form.rented}
                          onChange={(e) => setForm({ ...form, rented: e.target.checked })}
                          className="accent-[hsl(var(--primary))] h-4 w-4"
                          data-testid="form-rented"
                        />
                        <span className="text-sm">Currently rented out</span>
                      </label>
                      {form.rented && (
                        <Field label="Monthly rent income (₹)">
                          <input
                            type="number"
                            className="input-dark w-full px-3 py-2"
                            value={form.monthly_rent_income || 0}
                            onChange={(e) => setForm({ ...form, monthly_rent_income: e.target.value })}
                            data-testid="form-rent-income"
                          />
                        </Field>
                      )}
                    </>
                  )}

                  {form.status === "sold" && (
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Sold date">
                        <input
                          type="date"
                          className="input-dark w-full px-3 py-2"
                          value={form.sold_date || ""}
                          onChange={(e) => setForm({ ...form, sold_date: e.target.value })}
                          data-testid="form-sold-date"
                        />
                      </Field>
                      <Field label="Sold price (₹)">
                        <input
                          type="number"
                          className="input-dark w-full px-3 py-2"
                          value={form.sold_price ?? ""}
                          onChange={(e) => setForm({ ...form, sold_price: e.target.value })}
                          data-testid="form-sold-price"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </div>

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

      {listingFor && <ListingModal property={listingFor} onClose={() => setListingFor(null)} />}
    </div>
  );
}

function ListingModal({ property, onClose }) {
  const [form, setForm] = useState({
    property_id: property.id,
    monthly_rent: property.monthly_rent_income || Math.round((property.current_value || property.price) * 0.03 / 12),
    security_deposit: 0,
    furnishing: "semi_furnished",
    tenant_preferences: ["family"],
    amenities: [],
    available_from: new Date().toISOString().slice(0, 10),
    description_addons: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    use_ai: true,
  });
  const [amenityInput, setAmenityInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const addAmenity = () => {
    if (!amenityInput.trim()) return;
    setForm({ ...form, amenities: [...form.amenities, amenityInput.trim()] });
    setAmenityInput("");
  };
  const delAmenity = (i) => setForm({ ...form, amenities: form.amenities.filter((_, j) => j !== i) });
  const togglePref = (p) =>
    setForm({
      ...form,
      tenant_preferences: form.tenant_preferences.includes(p)
        ? form.tenant_preferences.filter((x) => x !== p)
        : [...form.tenant_preferences, p],
    });

  const generate = async () => {
    if (!form.monthly_rent) {
      toast.error("Monthly rent is required");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/listings/generate", {
        ...form,
        monthly_rent: Number(form.monthly_rent),
        security_deposit: Number(form.security_deposit || 0),
      });
      setResult(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not generate listing");
    } finally {
      setLoading(false);
    }
  };

  const copyText = (txt) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copied to clipboard — paste into any rental portal");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="listing-modal">
      <div className="absolute inset-0 bg-background/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border-l hairline overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b hairline sticky top-0 bg-card z-10">
          <div>
            <div className="eyebrow flex items-center gap-2 text-[hsl(var(--secondary))]"><Megaphone size={12} weight="duotone" /> List for rent</div>
            <div className="font-serif text-2xl mt-1">{property.name}</div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X size={16} /></button>
        </div>

        {!result ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly rent (₹)" required>
                <input type="number" className="input-dark w-full px-3 py-2" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} data-testid="listing-rent" />
              </Field>
              <Field label="Security deposit (₹)">
                <input type="number" className="input-dark w-full px-3 py-2" value={form.security_deposit} onChange={(e) => setForm({ ...form, security_deposit: e.target.value })} />
              </Field>
            </div>
            <Field label="Furnishing">
              <select className="input-dark w-full px-3 py-2" value={form.furnishing} onChange={(e) => setForm({ ...form, furnishing: e.target.value })} data-testid="listing-furnishing">
                <option value="fully_furnished">Fully Furnished</option>
                <option value="semi_furnished">Semi-Furnished</option>
                <option value="unfurnished">Unfurnished</option>
              </select>
            </Field>
            <Field label="Available from">
              <input type="date" className="input-dark w-full px-3 py-2" value={form.available_from} onChange={(e) => setForm({ ...form, available_from: e.target.value })} />
            </Field>
            <div>
              <span className="eyebrow block mb-2">Preferred tenants</span>
              <div className="flex flex-wrap gap-2">
                {["family", "bachelors_male", "bachelors_female", "company", "any"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePref(p)}
                    className={`text-xs px-3 py-1.5 border ${form.tenant_preferences.includes(p) ? "bg-[hsl(var(--secondary))] text-white border-[hsl(var(--secondary))]" : "hairline text-muted-foreground"}`}
                  >
                    {p.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="eyebrow block mb-2">Amenities</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-dark px-3 py-2 flex-1"
                  placeholder="e.g. Swimming pool, Gym, Kids play area"
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAmenity())}
                />
                <button onClick={addAmenity} className="btn-ghost px-3 py-2 text-sm">Add</button>
              </div>
              {form.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.amenities.map((a, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-[hsl(var(--muted))] inline-flex items-center gap-1">
                      {a}
                      <button onClick={() => delAmenity(i)} className="hover:text-destructive"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Field label="Extra description (optional)">
              <textarea rows={2} className="input-dark w-full px-3 py-2" value={form.description_addons} onChange={(e) => setForm({ ...form, description_addons: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t hairline">
              <Field label="Your name">
                <input className="input-dark w-full px-3 py-2" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input className="input-dark w-full px-3 py-2" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Email">
              <input className="input-dark w-full px-3 py-2" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm pt-2">
              <input
                type="checkbox"
                checked={form.use_ai}
                onChange={(e) => setForm({ ...form, use_ai: e.target.checked })}
                className="accent-[hsl(var(--primary))]"
              />
              <span className="flex items-center gap-1"><Sparkle size={12} /> Let Claude write a polished description</span>
            </label>
            <div className="flex gap-3 pt-3">
              <button onClick={generate} disabled={loading} className="btn-primary px-5 py-2.5 text-sm flex-1 inline-flex items-center justify-center gap-2" data-testid="listing-generate">
                {loading ? "Generating…" : <><Megaphone size={14} /> Generate listing</>}
              </button>
              <button onClick={onClose} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5" data-testid="listing-result">
            <div className="card-flat p-5 border-[hsl(var(--secondary))]">
              <div className="flex items-start justify-between mb-3">
                <div className="font-serif text-xl" data-testid="listing-title">{result.title}</div>
                <button onClick={() => copyText(result.body)} className="btn-ghost p-2" title="Copy listing">
                  <Copy size={14} />
                </button>
              </div>
              {result.ai_description && (
                <div className="mb-4">
                  <div className="eyebrow mb-2 flex items-center gap-2 text-[hsl(var(--secondary))]"><Sparkle size={10} weight="fill" /> AI-written description</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed" data-testid="listing-ai-desc">{result.ai_description}</div>
                  <button onClick={() => copyText(result.ai_description)} className="btn-ghost text-xs px-2 py-1 mt-2 inline-flex items-center gap-1">
                    <Copy size={10} /> Copy AI description
                  </button>
                </div>
              )}
              <div className="eyebrow mb-2">Structured listing (paste-ready)</div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-[hsl(var(--muted))] p-3 max-h-64 overflow-y-auto" data-testid="listing-body">{result.body}</pre>
            </div>

            <div>
              <div className="eyebrow mb-3">One-click post to rental portals</div>
              <div className="grid grid-cols-2 gap-2">
                {result.links.map((l) => (
                  <a
                    key={l.portal}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost px-3 py-2.5 text-xs inline-flex items-center justify-between gap-2 hover:border-[hsl(var(--secondary))]"
                    data-testid={`portal-${l.portal.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span>{l.portal}</span>
                    <ArrowSquareOut size={12} />
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Most portals open their official "post free ad" page. We've copied your listing to clipboard — just paste when it loads.
              </p>
            </div>

            <div className="flex gap-3 pt-3">
              <button onClick={() => copyText(result.body)} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2" data-testid="listing-copy">
                <Copy size={14} /> Copy listing text
              </button>
              <button onClick={() => setResult(null)} className="btn-ghost px-5 py-2.5 text-sm">Edit again</button>
            </div>
          </div>
        )}
      </div>
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
