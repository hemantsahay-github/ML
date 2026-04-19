import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/format";
import Disclaimer from "../components/Disclaimer";
import AadhaarModal from "../components/tenants/AadhaarModal";
import {
  Plus,
  X,
  PencilSimple,
  Trash,
  Receipt,
  DownloadSimple,
  PaperPlaneTilt,
  UserCircle,
  Key,
  ShieldCheck,
} from "@phosphor-icons/react";

const blankTenant = {
  property_id: "",
  name: "",
  phone: "",
  email: "",
  monthly_rent: 25000,
  deposit: 75000,
  lease_start: "",
  lease_end: "",
  notes: "",
};

const blankReceipt = {
  month: new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  amount: 25000,
  paid_on: new Date().toISOString().slice(0, 10),
  payment_mode: "UPI",
  notes: "",
  send_email: false,
};

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [receiptFor, setReceiptFor] = useState(null);
  const [receiptForm, setReceiptForm] = useState(blankReceipt);
  const [receipts, setReceipts] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        api.get("/tenants"),
        api.get("/properties?status=owned"),
      ]);
      setTenants(t.data);
      setProperties(p.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm({ ...blankTenant, property_id: properties[0]?.id || "" });
    setIsEdit(false);
  };
  const openEdit = (t) => {
    setForm({ ...t });
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
      ["monthly_rent", "deposit"].forEach((k) => (payload[k] = Number(payload[k] || 0)));
      if (!payload.property_id) {
        toast.error("Select a property");
        return;
      }
      if (isEdit) {
        await api.put(`/tenants/${form.id}`, payload);
        toast.success("Tenant updated");
      } else {
        await api.post("/tenants", payload);
        toast.success("Tenant added");
      }
      close();
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this tenant and their receipts?")) return;
    try {
      await api.delete(`/tenants/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const openReceipts = async (t) => {
    setReceiptFor(t);
    setReceiptForm({ ...blankReceipt, amount: t.monthly_rent });
    try {
      const { data } = await api.get(`/tenants/${t.id}/receipts`);
      setReceipts(data);
    } catch {
      setReceipts([]);
    }
  };

  const generateReceipt = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/tenants/${receiptFor.id}/receipts`, {
        tenant_id: receiptFor.id,
        ...receiptForm,
        amount: Number(receiptForm.amount),
      });
      toast.success("Receipt generated");
      openReceipts(receiptFor);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
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

  const inviteTenant = async (t) => {
    if (!t.email) {
      toast.error("Add the tenant's email first");
      return;
    }
    if (!confirm(`Create a login for ${t.name}? They'll get an email with their temporary password.`)) return;
    try {
      const { data } = await api.post(`/tenants/${t.id}/invite`, {});
      toast.success(`Login created · temp password: ${data.temp_password}`, { duration: 12000 });
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const [aadhaarFor, setAadhaarFor] = useState(null);
  const verifyAadhaar = (t) => setAadhaarFor(t);

  return (
    <div className="max-w-7xl mx-auto px-8 py-10" data-testid="tenants-page">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="eyebrow mb-2">Tenants</div>
          <h1 className="font-serif text-5xl">Who pays you rent.</h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Track tenants per owned property, issue rent receipts, and email them a PDF copy — all in one place.
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={properties.length === 0}
          className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2 disabled:opacity-60"
          data-testid="add-tenant-button"
        >
          <Plus size={16} weight="bold" /> Add tenant
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="card-flat p-12 text-center">
          <div className="font-serif text-3xl mb-3">No owned properties yet.</div>
          <p className="text-muted-foreground">Mark at least one property as <span className="text-foreground">Owned</span> first.</p>
        </div>
      ) : loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : tenants.length === 0 ? (
        <div className="card-flat p-12 text-center" data-testid="tenants-empty">
          <UserCircle size={40} weight="duotone" className="mx-auto text-[hsl(var(--secondary))] mb-3" />
          <div className="font-serif text-3xl mb-3">No tenants yet.</div>
          <p className="text-muted-foreground mb-6">Add a tenant to start generating receipts.</p>
          <button onClick={openNew} className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2">
            <Plus size={16} weight="bold" /> Add tenant
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((t) => (
            <div key={t.id} className="card-flat p-6" data-testid={`tenant-card-${t.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="eyebrow">{t.property_name}</div>
                  <div className="font-serif text-2xl mt-1">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.phone}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(t)} className="btn-ghost p-2" title="Edit" data-testid={`tenant-edit-${t.id}`}>
                    <PencilSimple size={14} />
                  </button>
                  <button onClick={() => remove(t.id)} className="btn-ghost p-2" title="Delete">
                    <Trash size={14} />
                  </button>
                </div>
              </div>
              <div className="num-metric text-2xl mt-2">{inr(t.monthly_rent)}</div>
              <div className="text-xs text-muted-foreground">
                per month · deposit {inr(t.deposit)}
              </div>
              {t.lease_end && (
                <div className="text-xs text-muted-foreground mt-1">
                  Lease till {new Date(t.lease_end).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                </div>
              )}
              <button
                onClick={() => openReceipts(t)}
                className="btn-ghost w-full mt-4 py-2 text-xs inline-flex items-center justify-center gap-2"
                data-testid={`tenant-receipts-${t.id}`}
              >
                <Receipt size={14} /> Receipts
              </button>
              <button
                onClick={() => inviteTenant(t)}
                className="btn-ghost w-full mt-2 py-2 text-xs inline-flex items-center justify-center gap-2"
                data-testid={`tenant-invite-${t.id}`}
                title={t.portal_user_id ? "Reset login (sends new password)" : "Create tenant login"}
              >
                <Key size={12} />
                {t.portal_user_id ? "Reset tenant login" : "Invite to tenant portal"}
              </button>
              <button
                onClick={() => verifyAadhaar(t)}
                className={`btn-ghost w-full mt-2 py-2 text-xs inline-flex items-center justify-center gap-2 ${t.aadhaar_verified ? "text-[hsl(var(--secondary))] border-[hsl(var(--secondary))]/30" : ""}`}
                data-testid={`tenant-aadhaar-${t.id}`}
              >
                <ShieldCheck size={12} weight={t.aadhaar_verified ? "fill" : "regular"} />
                {t.aadhaar_verified ? `Aadhaar verified ****${t.aadhaar_last_4}` : "Verify Aadhaar"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tenant drawer */}
      {form && (
        <Drawer onClose={close} title={isEdit ? "Edit tenant" : "Add tenant"}>
          <form onSubmit={save} className="space-y-4" data-testid="tenant-form">
            <F label="Property *">
              <select
                className="input-dark w-full px-3 py-2"
                value={form.property_id}
                onChange={(e) => setForm({ ...form, property_id: e.target.value })}
                required
                data-testid="tenant-form-property"
              >
                <option value="">Select a property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.location}</option>
                ))}
              </select>
            </F>
            <F label="Name *">
              <input className="input-dark w-full px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="tenant-form-name" />
            </F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Phone"><input className="input-dark w-full px-3 py-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" /></F>
              <F label="Email"><input type="email" className="input-dark w-full px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Monthly rent ₹"><input type="number" className="input-dark w-full px-3 py-2" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} /></F>
              <F label="Deposit ₹"><input type="number" className="input-dark w-full px-3 py-2" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Lease start"><input type="date" className="input-dark w-full px-3 py-2" value={form.lease_start || ""} onChange={(e) => setForm({ ...form, lease_start: e.target.value })} /></F>
              <F label="Lease end"><input type="date" className="input-dark w-full px-3 py-2" value={form.lease_end || ""} onChange={(e) => setForm({ ...form, lease_end: e.target.value })} /></F>
            </div>
            <F label="Notes"><textarea rows={2} className="input-dark w-full px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
            <div className="flex gap-3 pt-4">
              <button type="submit" className="btn-primary px-5 py-2.5 text-sm" data-testid="tenant-save-button">
                {isEdit ? "Save changes" : "Add tenant"}
              </button>
              <button type="button" onClick={close} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
            </div>
          </form>
        </Drawer>
      )}

      {/* Receipts drawer */}
      {receiptFor && (
        <Drawer onClose={() => setReceiptFor(null)} title={`Receipts · ${receiptFor.name}`}>
          <div className="space-y-6" data-testid="receipts-drawer">
            <form onSubmit={generateReceipt} className="card-flat p-5 space-y-3">
              <div className="eyebrow">Generate receipt</div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Month"><input className="input-dark w-full px-3 py-2" value={receiptForm.month} onChange={(e) => setReceiptForm({ ...receiptForm, month: e.target.value })} required data-testid="receipt-month" /></F>
                <F label="Amount ₹"><input type="number" className="input-dark w-full px-3 py-2" value={receiptForm.amount} onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })} required data-testid="receipt-amount" /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Paid on"><input type="date" className="input-dark w-full px-3 py-2" value={receiptForm.paid_on} onChange={(e) => setReceiptForm({ ...receiptForm, paid_on: e.target.value })} /></F>
                <F label="Payment mode">
                  <select className="input-dark w-full px-3 py-2" value={receiptForm.payment_mode} onChange={(e) => setReceiptForm({ ...receiptForm, payment_mode: e.target.value })}>
                    {["UPI", "Bank Transfer", "Cheque", "Cash", "Card"].map((m) => (<option key={m}>{m}</option>))}
                  </select>
                </F>
              </div>
              <F label="Notes"><textarea rows={2} className="input-dark w-full px-3 py-2" value={receiptForm.notes} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} /></F>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={receiptForm.send_email} onChange={(e) => setReceiptForm({ ...receiptForm, send_email: e.target.checked })} className="accent-[hsl(var(--primary))]" data-testid="receipt-send-email" />
                Email a copy to {receiptFor.email || "tenant"}
              </label>
              <button type="submit" className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2" data-testid="receipt-generate">
                <PaperPlaneTilt size={14} weight="bold" /> Generate
              </button>
            </form>

            <div>
              <div className="eyebrow mb-3">History</div>
              {receipts.length === 0 ? (
                <div className="text-muted-foreground text-sm">No receipts yet.</div>
              ) : (
                <div className="space-y-2">
                  {receipts.map((r) => (
                    <div key={r.id} className="card-flat p-3 flex items-center justify-between" data-testid={`receipt-${r.id}`}>
                      <div>
                        <div className="text-sm font-medium">{r.month} · {inr(r.amount)}</div>
                        <div className="text-xs text-muted-foreground">#{r.receipt_no} · {r.payment_mode}</div>
                      </div>
                      <button onClick={() => downloadReceipt(r)} className="btn-ghost p-2" title="Download PDF" data-testid={`receipt-download-${r.id}`}>
                        <DownloadSimple size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Drawer>
      )}

      {aadhaarFor && <AadhaarModal tenant={aadhaarFor} onClose={() => setAadhaarFor(null)} onVerified={() => { setAadhaarFor(null); load(); }} />}

      <Disclaimer />
    </div>
  );
}

function F({ label, children }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Drawer({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/70" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border-l hairline overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b hairline sticky top-0 bg-card z-10">
          <div className="font-serif text-2xl">{title}</div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
