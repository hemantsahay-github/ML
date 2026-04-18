import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { inr, inrFull } from "../lib/format";
import {
  Users,
  CurrencyInr,
  Buildings,
  Crown,
  ArrowCircleUp,
  ArrowCircleDown,
  Gift,
  Prohibit,
} from "@phosphor-icons/react";

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, u, t] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/transactions"),
      ]);
      setStats(s.data);
      setUsers(u.data);
      setTxns(t.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user]);

  if (user && user.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  const act = async (id, action, days = 30) => {
    try {
      await api.post(`/admin/users/${id}/action`, { action, days });
      toast.success("Done");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10" data-testid="admin-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="eyebrow mb-2">Admin</div>
          <h1 className="font-serif text-5xl">
            The control room
            <span className="text-[hsl(var(--primary))]">.</span>
          </h1>
        </div>
        <span className="eyebrow text-[hsl(var(--primary))] inline-flex items-center gap-1">
          <Crown size={14} weight="duotone" /> admin
        </span>
      </div>

      <div className="border-b hairline mb-8 flex gap-1">
        {[
          ["overview", "Overview"],
          ["users", `Users (${users.length})`],
          ["transactions", `Transactions (${txns.length})`],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            data-testid={`admin-tab-${id}`}
            className={`px-5 py-2.5 text-sm -mb-px border-b-2 transition ${
              tab === id
                ? "border-[hsl(var(--primary))] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground" data-testid="admin-loading">
          Loading…
        </div>
      ) : tab === "overview" ? (
        <Overview stats={stats} />
      ) : tab === "users" ? (
        <UsersTable users={users} currentUserId={user?.id} onAct={act} />
      ) : (
        <TxnsTable txns={txns} />
      )}
    </div>
  );
}

function Overview({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <StatCard
        label="Users"
        big={stats.users.total}
        rows={[
          ["Pro", stats.users.pro, "secondary"],
          ["Trial", stats.users.trial],
          ["Free", stats.users.free],
        ]}
        icon={<Users size={22} weight="duotone" />}
        testid="stat-users"
      />
      <StatCard
        label="Revenue"
        big={inrFull(stats.revenue.total_inr)}
        rows={[
          ["Successful payments", stats.revenue.successful_transactions],
          ["Average ticket", stats.revenue.successful_transactions ? inr(stats.revenue.total_inr / stats.revenue.successful_transactions) : "—"],
        ]}
        icon={<CurrencyInr size={22} weight="duotone" />}
        testid="stat-revenue"
      />
      <StatCard
        label="Properties"
        big={stats.properties.total}
        rows={[
          ["Owned", stats.properties.owned],
          ["Sold", stats.properties.sold],
          ["Evaluating", Math.max(stats.properties.total - stats.properties.owned - stats.properties.sold, 0)],
        ]}
        icon={<Buildings size={22} weight="duotone" />}
        testid="stat-properties"
      />
    </div>
  );
}

function StatCard({ label, big, rows, icon, testid }) {
  return (
    <div className="card-flat p-6" data-testid={testid}>
      <div className="flex items-start justify-between mb-4">
        <div className="eyebrow">{label}</div>
        <div className="text-[hsl(var(--secondary))]">{icon}</div>
      </div>
      <div className="num-metric text-4xl mb-4">{big}</div>
      <div className="border-t hairline pt-4 space-y-2 text-sm">
        {rows.map(([k, v, tone]) => (
          <div key={k} className="flex justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span className={tone === "secondary" ? "text-[hsl(var(--secondary))]" : "text-foreground"}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTable({ users, currentUserId, onAct }) {
  return (
    <div className="card-flat overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground border-b hairline">
          <tr>
            {["User", "Role", "Plan", "Status", "Expires", "Actions"].map((h) => (
              <th key={h} className="p-4 font-normal eyebrow">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b hairline last:border-0" data-testid={`admin-user-row-${u.id}`}>
              <td className="p-4">
                <div className="font-serif text-lg">{u.name || u.email.split("@")[0]}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </td>
              <td className="p-4">
                <span className={`text-xs uppercase tracking-widest ${u.role === "admin" ? "text-[hsl(var(--primary))]" : "text-muted-foreground"}`}>
                  {u.role}
                </span>
              </td>
              <td className="p-4">
                <span className={u.is_pro ? "text-[hsl(var(--secondary))]" : "text-muted-foreground"}>
                  {u.plan}
                </span>
              </td>
              <td className="p-4 text-xs">{u.plan_status}</td>
              <td className="p-4 text-xs text-muted-foreground">
                {u.plan_status === "trial"
                  ? u.trial_ends_at
                    ? new Date(u.trial_ends_at).toLocaleDateString()
                    : "—"
                  : u.plan_expires_at
                    ? new Date(u.plan_expires_at).toLocaleDateString()
                    : "—"}
              </td>
              <td className="p-4">
                <div className="flex gap-1.5">
                  {u.role !== "admin" ? (
                    <button onClick={() => onAct(u.id, "promote")} className="btn-ghost p-1.5 text-xs" title="Promote to admin" data-testid={`admin-promote-${u.id}`}>
                      <ArrowCircleUp size={14} />
                    </button>
                  ) : u.id !== currentUserId ? (
                    <button onClick={() => onAct(u.id, "demote")} className="btn-ghost p-1.5 text-xs" title="Demote" data-testid={`admin-demote-${u.id}`}>
                      <ArrowCircleDown size={14} />
                    </button>
                  ) : null}
                  {!u.is_pro ? (
                    <button onClick={() => onAct(u.id, "grant_pro", 30)} className="btn-ghost p-1.5 text-xs" title="Grant 30 days Pro" data-testid={`admin-grant-${u.id}`}>
                      <Gift size={14} />
                    </button>
                  ) : (
                    <button onClick={() => onAct(u.id, "cancel_pro")} className="btn-ghost p-1.5 text-xs" title="Cancel Pro" data-testid={`admin-cancel-${u.id}`}>
                      <Prohibit size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TxnsTable({ txns }) {
  if (txns.length === 0)
    return <div className="card-flat p-12 text-center text-muted-foreground" data-testid="admin-txns-empty">No transactions yet.</div>;
  return (
    <div className="card-flat overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground border-b hairline">
          <tr>
            {["When", "User", "Plan", "Amount", "Status", "Order / Payment"].map((h) => (
              <th key={h} className="p-4 font-normal eyebrow">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {txns.map((t, i) => (
            <tr key={t.order_id || i} className="border-b hairline last:border-0" data-testid={`admin-txn-${t.order_id}`}>
              <td className="p-4 text-xs text-muted-foreground">
                {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
              </td>
              <td className="p-4">{t.email}</td>
              <td className="p-4">{t.plan_id}</td>
              <td className="p-4 num-metric">{inr(t.amount_inr)}</td>
              <td className="p-4">
                <span
                  className={`text-xs uppercase tracking-widest ${
                    t.status === "success"
                      ? "text-[hsl(var(--secondary))]"
                      : t.status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {t.status}
                </span>
              </td>
              <td className="p-4 font-mono text-[0.7rem] text-muted-foreground">
                <div>{t.order_id}</div>
                {t.payment_id && <div>{t.payment_id}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
