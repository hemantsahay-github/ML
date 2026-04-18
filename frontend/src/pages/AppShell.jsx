import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  SquaresFour,
  Buildings,
  Scales,
  Calculator,
  Sparkle,
  SignOut,
} from "@phosphor-icons/react";

const nav = [
  { to: "/app", label: "Dashboard", icon: SquaresFour, end: true, id: "nav-dashboard" },
  { to: "/app/properties", label: "Properties", icon: Buildings, id: "nav-properties" },
  { to: "/app/compare", label: "Compare", icon: Scales, id: "nav-compare" },
  { to: "/app/calculators", label: "Calculators", icon: Calculator, id: "nav-calculators" },
  { to: "/app/advisor", label: "AI Advisor", icon: Sparkle, id: "nav-advisor" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const doLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r hairline flex flex-col shrink-0">
        <div className="p-6 border-b hairline">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 border hairline flex items-center justify-center">
              <span className="font-serif text-xl leading-none">E</span>
            </div>
            <span className="font-serif text-2xl tracking-tight">Estima</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
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
                {n.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t hairline">
          <div className="text-xs text-muted-foreground mb-2 truncate" data-testid="sidebar-user-email">
            {user?.email}
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
        <Outlet />
      </main>
    </div>
  );
}
