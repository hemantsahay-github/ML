import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Tour, { hasSeenTour } from "../components/Tour";
import FeedbackWidget from "../components/FeedbackWidget";
import {
  SquaresFour,
  Buildings,
  Scales,
  Calculator,
  Sparkle,
  SignOut,
  ChartPieSlice,
  Crown,
  ShieldCheck,
  Lightning,
  BookOpen,
  Question,
  Gift,
  UserCircle,
} from "@phosphor-icons/react";

function daysLeft(iso) {
  if (!iso) return 0;
  const d = new Date(iso);
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (user && !hasSeenTour()) {
      const t = setTimeout(() => setShowTour(true), 500);
      return () => clearTimeout(t);
    }
  }, [user]);

  const doLogout = async () => {
    await logout();
    navigate("/");
  };

  const baseNav = [
    { to: "/app", label: "Dashboard", icon: SquaresFour, end: true, id: "nav-dashboard" },
    { to: "/app/properties", label: "Properties", icon: Buildings, id: "nav-properties" },
    { to: "/app/portfolio", label: "Portfolio", icon: ChartPieSlice, id: "nav-portfolio" },
    { to: "/app/tenants", label: "Tenants", icon: UserCircle, id: "nav-tenants" },
    { to: "/app/compare", label: "Compare", icon: Scales, id: "nav-compare" },
    { to: "/app/calculators", label: "Calculators", icon: Calculator, id: "nav-calculators" },
    { to: "/app/advisor", label: "AI Advisor", icon: Sparkle, id: "nav-advisor", pro: true },
    { to: "/app/referrals", label: "Invites", icon: Gift, id: "nav-referrals" },
    { to: "/app/guide", label: "Guide", icon: BookOpen, id: "nav-guide" },
  ];
  const nav = user?.role === "admin"
    ? [...baseNav, { to: "/app/admin", label: "Admin", icon: ShieldCheck, id: "nav-admin" }]
    : baseNav;

  const trialLeft = user?.plan_status === "trial" ? daysLeft(user?.trial_ends_at) : 0;
  const showTrialBanner = user && user.plan_status === "trial" && trialLeft >= 0;
  const showExpiredBanner = user && user.plan_status === "expired" && user.role !== "admin";
  const hideBannerOnAdmin = location.pathname.startsWith("/app/admin");

  return (
    <div className="min-h-screen flex bg-background">
      <Tour open={showTour} onClose={() => setShowTour(false)} />
      <aside className="w-64 border-r hairline flex flex-col shrink-0">
        <div className="p-6 border-b hairline">
          <Link to="/app" className="flex items-center gap-2">
            <div className="h-8 w-8 border hairline flex items-center justify-center">
              <span className="font-serif text-xl leading-none">E</span>
            </div>
            <span className="font-serif text-2xl tracking-tight">Estima</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            const locked = n.pro && user && !user.is_pro;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={n.id}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 text-sm rounded-sm transition ${
                    isActive
                      ? "bg-[hsl(var(--muted))] text-foreground border-l-2 border-[hsl(var(--primary))]"
                      : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--muted))]"
                  }`
                }
              >
                <Icon size={18} weight="duotone" />
                <span className="flex-1">{n.label}</span>
                {locked && <Crown size={12} weight="duotone" className="text-[hsl(var(--secondary))]" />}
              </NavLink>
            );
          })}
        </nav>

        {user && !user.is_pro && (
          <div className="p-4 border-t hairline">
            <Link
              to="/pricing"
              className="btn-primary w-full px-3 py-2 text-sm inline-flex items-center justify-center gap-2"
              data-testid="sidebar-upgrade-cta"
            >
              <Crown size={14} weight="duotone" /> Upgrade to Pro
            </Link>
          </div>
        )}

        <div className="p-4 border-t hairline">
          <div className="text-xs text-muted-foreground mb-2 truncate flex items-center gap-1.5" data-testid="sidebar-user-email">
            {user?.is_pro && <Crown size={11} weight="duotone" className="text-[hsl(var(--secondary))] shrink-0" />}
            <span className="truncate">{user?.email}</span>
          </div>
          <button
            onClick={doLogout}
            className="btn-ghost w-full px-3 py-2 text-sm inline-flex items-center justify-center gap-2"
            data-testid="logout-button"
          >
            <SignOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto">
        {showTrialBanner && !hideBannerOnAdmin && (
          <div className="bg-[hsl(var(--muted))] border-b hairline px-8 py-3 flex items-center justify-between text-sm" data-testid="trial-banner">
            <div className="flex items-center gap-2">
              <Lightning size={14} weight="duotone" className="text-[hsl(var(--secondary))]" />
              <span>
                <span className="text-[hsl(var(--secondary))]">Pro trial active</span>
                {" · "}
                <span className="text-muted-foreground">
                  {trialLeft} day{trialLeft === 1 ? "" : "s"} remaining. Every feature is yours.
                </span>
              </span>
            </div>
            <Link to="/pricing" className="text-[hsl(var(--secondary))] hover:text-foreground text-xs inline-flex items-center gap-1" data-testid="trial-banner-upgrade">
              Lock it in <span aria-hidden>→</span>
            </Link>
          </div>
        )}
        {showExpiredBanner && !hideBannerOnAdmin && (
          <div className="bg-[hsl(var(--muted))] border-b border-[hsl(var(--primary))] px-8 py-3 flex items-center justify-between text-sm" data-testid="expired-banner">
            <div className="flex items-center gap-2">
              <Crown size={14} weight="duotone" className="text-[hsl(var(--primary))]" />
              <span>
                <span className="text-[hsl(var(--primary))]">Pro expired.</span>{" "}
                <span className="text-muted-foreground">AI Advisor and exports are locked.</span>
              </span>
            </div>
            <Link to="/pricing" className="text-[hsl(var(--primary))] hover:text-foreground text-xs inline-flex items-center gap-1" data-testid="expired-banner-upgrade">
              Upgrade <span aria-hidden>→</span>
            </Link>
          </div>
        )}
        <Outlet />
      </main>

      {/* Floating help / re-open tour */}
      <button
        onClick={() => setShowTour(true)}
        className="fixed bottom-6 right-24 z-50 h-12 w-12 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center shadow-lg hover:bg-[#d46c44] transition"
        title="Open tour"
        data-testid="help-fab"
      >
        <Question size={20} weight="bold" />
      </button>
      <FeedbackWidget />
    </div>
  );
}
