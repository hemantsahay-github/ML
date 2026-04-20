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
  Clock,
  ChatCircleDots,
  Bug,
  Lightbulb,
  Heart,
  UserPlus,
} from "@phosphor-icons/react";

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [txns, setTxns] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, u, t, f, lw] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/transactions"),
        api.get("/admin/feedback"),
        api.get("/admin/lawyers").catch(() => ({ data: { lawyers: [] } })),
      ]);
      setStats(s.data);
      setUsers(u.data);
      setTxns(t.data);
      setFeedback(f.data);
      setLawyers(lw.data.lawyers || []);
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

  const legacyTransfer = async (srcUser) => {
    const new_email = prompt(`Transfer ${srcUser.email}'s portfolio to next of kin. Enter new email:`);
    if (!new_email) return;
    const new_name = prompt("New user's full name:");
    if (!new_name) return;
    const note = prompt("Note (optional, e.g. 'Inherited from father'):", "") || "";
    try {
      const { data } = await api.post("/admin/legacy-transfer", {
        from_user_id: srcUser.id,
        new_email: new_email.trim().toLowerCase(),
        new_name: new_name.trim(),
        transfer_properties: true,
        transfer_tenants: true,
        note,
      });
      toast.success(
        `Transferred: ${data.transferred.properties} properties, ${data.transferred.tenants} tenants · temp password: ${data.temp_password}`,
        { duration: 15000 }
      );
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

      <div className="border-b hairline mb-8 flex gap-1 flex-wrap">
        {[
          ["overview", "Overview"],
          ["users", `Users (${users.length})`],
          ["lawyers", `Lawyers (${lawyers.length})`],
          ["transactions", `Transactions (${txns.length})`],
          ["feedback", `Feedback (${feedback.length})`],
          ["analytics", "Analytics"],
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
        <UsersTable users={users} currentUserId={user?.id} onAct={act} onLegacyTransfer={legacyTransfer} />
      ) : tab === "lawyers" ? (
        <LawyersTable lawyers={lawyers} onRefresh={load} />
      ) : tab === "feedback" ? (
        <FeedbackTable feedback={feedback} onRefresh={load} />
      ) : tab === "analytics" ? (
        <AnalyticsPanel />
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

function UsersTable({ users, currentUserId, onAct, onLegacyTransfer }) {
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
                  <button
                    onClick={() => {
                      const days = parseInt(prompt("Extend trial by how many days?", "15") || "0", 10);
                      if (days > 0) onAct(u.id, "extend_trial", days);
                    }}
                    className="btn-ghost p-1.5 text-xs"
                    title="Extend trial"
                    data-testid={`admin-extend-trial-${u.id}`}
                  >
                    <Clock size={14} />
                  </button>
                  <button
                    onClick={() => onLegacyTransfer(u)}
                    className="btn-ghost p-1.5 text-xs"
                    title="Transfer portfolio to next-of-kin (create legacy login)"
                    data-testid={`admin-legacy-${u.id}`}
                  >
                    <UserPlus size={14} />
                  </button>
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


const CAT_ICON = { general: ChatCircleDots, bug: Bug, idea: Lightbulb, love: Heart };
const CAT_COLOR = {
  general: "text-muted-foreground",
  bug: "text-destructive",
  idea: "text-[hsl(var(--secondary))]",
  love: "text-[hsl(var(--primary))]",
};

function FeedbackTable({ feedback, onRefresh }) {
  const setStatus = async (fid, status) => {
    try {
      await api.post(`/admin/feedback/${fid}/status`, { status });
      toast.success("Updated");
      onRefresh?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };
  if (feedback.length === 0)
    return (
      <div className="card-flat p-12 text-center text-muted-foreground" data-testid="admin-feedback-empty">
        No feedback yet.
      </div>
    );
  return (
    <div className="space-y-3" data-testid="admin-feedback-list">
      {feedback.map((f) => {
        const Icon = CAT_ICON[f.category] || ChatCircleDots;
        return (
          <div key={f.id} className="card-flat p-5" data-testid={`admin-feedback-${f.id}`}>
            <div className="flex items-start gap-4">
              <div className={`h-9 w-9 border hairline flex items-center justify-center shrink-0 ${CAT_COLOR[f.category] || ""}`}>
                <Icon size={16} weight="duotone" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="eyebrow capitalize">{f.category}</span>
                    {f.rating && <span className="ml-3 text-xs text-muted-foreground">rating: {f.rating}/5</span>}
                    {f.page && <span className="ml-3 text-xs text-muted-foreground font-mono">{f.page}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs uppercase tracking-widest ${f.status === "new" ? "text-[hsl(var(--primary))]" : "text-muted-foreground"}`}>
                      {f.status}
                    </span>
                    <select
                      value={f.status}
                      onChange={(e) => setStatus(f.id, e.target.value)}
                      className="input-dark text-xs px-2 py-1"
                      data-testid={`admin-feedback-status-${f.id}`}
                    >
                      {["new", "triaged", "planned", "done", "wontfix"].map((s) => (<option key={s}>{s}</option>))}
                    </select>
                  </div>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{f.message}</div>
                <div className="mt-3 text-xs text-muted-foreground">
                  from <span className="text-foreground">{f.email}</span> · {new Date(f.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


function LawyersTable({ lawyers, onRefresh }) {
  const verify = async (id, verified) => {
    try {
      await api.post("/admin/lawyers/verify", { lawyer_id: id, verified });
      toast.success(verified ? "Lawyer verified" : "Verification revoked");
      onRefresh();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };
  if (!lawyers.length) {
    return (
      <div className="card-flat p-12 text-center text-muted-foreground" data-testid="admin-lawyers-empty">
        No lawyers have signed up yet. Share the <code>/lawyer/register</code> page with vetted counsels.
      </div>
    );
  }
  return (
    <div className="card-flat overflow-x-auto" data-testid="admin-lawyers-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b hairline text-muted-foreground uppercase text-[10px] tracking-wider">
            <th className="text-left px-4 py-3">Counsel</th>
            <th className="text-left px-4 py-3">Bar ID</th>
            <th className="text-left px-4 py-3">Specialization</th>
            <th className="text-right px-4 py-3">Rate</th>
            <th className="text-right px-4 py-3">Endorsements</th>
            <th className="text-right px-4 py-3">Earnings</th>
            <th className="text-center px-4 py-3">Status</th>
            <th className="text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {lawyers.map((lw) => (
            <tr key={lw.id} className="border-b hairline last:border-0" data-testid={`admin-lawyer-${lw.id.slice(0, 8)}`}>
              <td className="px-4 py-3">
                <div>{lw.name}</div>
                <div className="text-xs text-muted-foreground">{lw.email}</div>
              </td>
              <td className="px-4 py-3 text-xs">{lw.bar_council_id}</td>
              <td className="px-4 py-3 text-xs">{lw.specialization}</td>
              <td className="px-4 py-3 text-right num-metric">{inr(lw.rate_inr)}</td>
              <td className="px-4 py-3 text-right">{lw.endorsement_count}</td>
              <td className="px-4 py-3 text-right num-metric">{inr(lw.earnings_inr)}</td>
              <td className="px-4 py-3 text-center">
                {lw.verified ? (
                  <span className="text-[10px] px-2 py-1 bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))] uppercase tracking-wider">Verified</span>
                ) : (
                  <span className="text-[10px] px-2 py-1 bg-yellow-500/10 text-yellow-500 uppercase tracking-wider">Pending</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {lw.verified ? (
                  <button onClick={() => verify(lw.id, false)} className="btn-ghost px-3 py-1.5 text-xs" data-testid={`admin-lawyer-revoke-${lw.id.slice(0, 8)}`}>
                    Revoke
                  </button>
                ) : (
                  <button onClick={() => verify(lw.id, true)} className="btn-primary px-3 py-1.5 text-xs" data-testid={`admin-lawyer-verify-${lw.id.slice(0, 8)}`}>
                    Verify
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/admin/analytics?days=${days}`)
      .then(({ data }) => { if (!cancelled) setData(data); })
      .catch((e) => { if (!cancelled) toast.error(formatApiErrorDetail(e.response?.data?.detail)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  if (loading) return <div className="card-flat p-10 text-muted-foreground" data-testid="analytics-loading">Loading analytics…</div>;
  if (!data) return null;

  return (
    <div className="space-y-8" data-testid="admin-analytics-panel">
      <div className="flex items-center gap-3">
        <span className="eyebrow text-xs">Window</span>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs border hairline ${days === d ? "bg-[hsl(var(--primary))] text-primary-foreground" : "bg-transparent"}`}
              data-testid={`analytics-window-${d}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        <MiniStat label={`Pageviews · ${days}d`} value={data.total_pageviews} />
        <MiniStat label="Pageviews · 7d" value={data.last_7d_pageviews} />
        <MiniStat label="Pageviews · 24h" value={data.last_24h_pageviews} />
        <MiniStat label="Unique sessions · 24h" value={data.unique_sessions_24h} />
      </div>

      <section className="card-flat p-6">
        <div className="eyebrow mb-4">Most-used features (last {days} days)</div>
        {data.top_features?.length ? (
          <table className="w-full text-sm" data-testid="analytics-top-features">
            <thead>
              <tr className="border-b hairline text-muted-foreground uppercase text-[10px] tracking-wider">
                <th className="text-left py-2">Feature</th>
                <th className="text-right py-2">Views</th>
                <th className="text-right py-2">Avg time</th>
                <th className="text-right py-2">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {data.top_features.map((r) => (
                <tr key={r.route} className="border-b hairline last:border-0" data-testid={`analytics-top-${r.route.replace(/\//g, "-")}`}>
                  <td className="py-2.5"><code className="text-xs">{r.route}</code></td>
                  <td className="py-2.5 text-right num-metric">{r.views}</td>
                  <td className="py-2.5 text-right">{r.avg_time_seconds}s</td>
                  <td className="py-2.5 text-right">{r.unique_sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-muted-foreground">No feature data yet.</div>
        )}
      </section>

      {data.least_used_features?.length > 0 && (
        <section className="card-flat p-6">
          <div className="eyebrow mb-4">Least-used features — candidates to promote or remove</div>
          <div className="space-y-2" data-testid="analytics-least-features">
            {data.least_used_features.slice(0, 5).map((r) => (
              <div key={r.route} className="flex items-center justify-between text-sm">
                <code className="text-xs">{r.route}</code>
                <span className="text-muted-foreground">{r.views} views · {r.avg_time_seconds}s avg</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.daily_series?.length > 0 && (
        <section className="card-flat p-6">
          <div className="eyebrow mb-4">Daily pageviews · last 14 days</div>
          <div className="flex items-end gap-2 h-32" data-testid="analytics-daily-bars">
            {data.daily_series.map((d) => {
              const maxV = Math.max(...data.daily_series.map((x) => x.views), 1);
              const h = (d.views / maxV) * 100;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center" title={`${d.day}: ${d.views}`}>
                  <div className="w-full bg-[hsl(var(--secondary))]" style={{ height: `${h}%` }} />
                  <div className="text-[9px] text-muted-foreground mt-1 rotate-[-30deg] origin-top-left whitespace-nowrap">{d.day.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card-flat p-6">
        <div className="eyebrow mb-4">All routes (top {data.top_routes.length})</div>
        <table className="w-full text-sm" data-testid="analytics-all-routes">
          <thead>
            <tr className="border-b hairline text-muted-foreground uppercase text-[10px] tracking-wider">
              <th className="text-left py-2">Route</th>
              <th className="text-right py-2">Views</th>
              <th className="text-right py-2">Avg time</th>
              <th className="text-right py-2">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {data.top_routes.map((r) => (
              <tr key={r.route} className="border-b hairline last:border-0">
                <td className="py-2"><code className="text-xs">{r.route}</code></td>
                <td className="py-2 text-right num-metric">{r.views}</td>
                <td className="py-2 text-right">{r.avg_time_seconds}s</td>
                <td className="py-2 text-right">{r.unique_sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="card-flat p-5">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className="num-metric text-3xl">{Number(value || 0).toLocaleString("en-IN")}</div>
    </div>
  );
}

