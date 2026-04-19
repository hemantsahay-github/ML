import { useEffect, useState } from "react";
import api from "../lib/api";
import { logger } from "../lib/logger";
import { toast } from "sonner";
import { Copy, Gift, UsersThree, Crown, ShareNetwork, CheckCircle } from "@phosphor-icons/react";
import Disclaimer from "../components/Disclaimer";

export default function Referrals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/referrals/me")
      .then(({ data }) => setData(data))
      .catch(() => toast.error("Couldn't load referrals."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-5xl mx-auto px-8 py-10 text-muted-foreground">Loading…</div>;
  if (!data) return null;

  const link = `${window.location.origin}/register?ref=${data.referral_code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast("Copy manually: " + link);
    }
  };
  const share = async () => {
    const payload = {
      title: "Join me on Estima",
      text: `I'm using Estima to make sense of property decisions. Use my invite — you get 10 free days of Pro, and I get a month. ${link}`,
      url: link,
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (e) {
        logger.debug("navigator.share cancelled/failed", e);
      }
    }
    copyLink();
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-10" data-testid="referrals-page">
      <div className="mb-10">
        <div className="eyebrow mb-2">Invites</div>
        <h1 className="font-serif text-5xl">Pay it forward, earn Pro.</h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          Give a friend a working decision engine. Every friend who signs up using your link adds{" "}
          <span className="text-[hsl(var(--secondary))]">{data.reward_per_referral_days} days of Pro</span>{" "}
          to your account. No cap.
        </p>
      </div>

      {/* Code card */}
      <div className="card-flat p-8 mb-10">
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <div className="eyebrow mb-2">Your invite code</div>
            <div className="font-serif text-5xl tracking-wider text-[hsl(var(--primary))]" data-testid="referral-code">
              {data.referral_code}
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <code className="font-mono text-xs text-muted-foreground break-all bg-[hsl(var(--muted))] px-3 py-2 border hairline flex-1" data-testid="referral-link">
                {link}
              </code>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={copyLink}
              className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2"
              data-testid="referral-copy"
            >
              <Copy size={14} weight="bold" /> Copy link
            </button>
            <button
              onClick={share}
              className="btn-ghost px-5 py-2.5 text-sm inline-flex items-center gap-2"
              data-testid="referral-share"
            >
              <ShareNetwork size={14} /> Share…
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-5 mb-10">
        <StatCard
          label="Friends invited"
          value={data.total_referrals}
          icon={<UsersThree size={20} weight="duotone" />}
          testid="referral-total"
        />
        <StatCard
          label="Pro days earned"
          value={data.total_days_granted}
          icon={<Gift size={20} weight="duotone" />}
          accent="good"
          testid="referral-days"
        />
        <StatCard
          label="Reward per signup"
          value={`${data.reward_per_referral_days} days`}
          icon={<Crown size={20} weight="duotone" />}
          testid="referral-reward"
        />
      </div>

      {/* Event log */}
      <div className="eyebrow mb-3">Activity</div>
      {data.events.length === 0 ? (
        <div className="card-flat p-8 text-center text-muted-foreground" data-testid="referral-empty">
          No signups yet. Share your link above to get started.
        </div>
      ) : (
        <div className="card-flat overflow-x-auto" data-testid="referral-events">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b hairline">
              <tr>
                {["When", "Friend", "Reward"].map((h) => (
                  <th key={h} className="p-4 font-normal eyebrow">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.events.map((e, i) => (
                <tr key={e.created_at ? `${e.created_at}-${i}` : `evt-${i}`} className="border-b hairline last:border-0">
                  <td className="p-4 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="p-4">{e.referred_email}</td>
                  <td className="p-4 text-[hsl(var(--secondary))] inline-flex items-center gap-1">
                    <CheckCircle size={14} weight="duotone" />
                    +{e.days_granted} Pro days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}

function StatCard({ label, value, icon, accent, testid }) {
  const color = accent === "good" ? "text-[hsl(var(--secondary))]" : "text-foreground";
  return (
    <div className="card-flat p-5" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="eyebrow">{label}</div>
        <div className="text-[hsl(var(--secondary))]">{icon}</div>
      </div>
      <div className={`num-metric text-4xl mt-4 ${color}`}>{value}</div>
    </div>
  );
}
