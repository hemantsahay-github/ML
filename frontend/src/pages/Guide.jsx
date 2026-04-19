import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Tour, { resetTour } from "../components/Tour";
import {
  Buildings,
  ChartPieSlice,
  Scales,
  Calculator,
  Sparkle,
  Crown,
  FilePdf,
  ShareNetwork,
  CaretDown,
  PlayCircle,
  Question,
  MapTrifold,
  Scroll,
  UserCircle,
} from "@phosphor-icons/react";

const FEATURES = [
  {
    icon: Buildings,
    title: "Properties ledger",
    link: "/app/properties",
    body:
      "Add every flat, villa or plot you're evaluating — plus any you already own or have sold. Each property carries price, carpet area, loan terms, your subjective scores (location/amenities/safety/commute/resale), and optional owned/sold metadata.",
    tips: [
      "Use the Apply city preset row to auto-fill appreciation & yield for Bengaluru, Mumbai, Hyderabad etc.",
      "Status toggle: Evaluating (default), Owned (tracks current value, equity, rent), Sold (records gain/loss).",
      "Filter tabs at the top of the Properties page: All / Evaluating / Owned / Sold.",
    ],
  },
  {
    icon: Scales,
    title: "Side-by-side Compare",
    link: "/app/compare",
    body:
      "Pick two or more properties in Compare, tune the six weights (location, amenities, safety, commute, resale, price/value), and Estima returns a weighted winner plus a radar breakdown and ranked table.",
    tips: [
      "Each weight is independent — they don't need to sum to 100%.",
      "Export the report as CSV or PDF (Pro). Share a read-only link with anyone — no login required on their side.",
      "Price/Value is auto-computed: the cheapest ₹/sqft scores highest.",
    ],
  },
  {
    icon: Calculator,
    title: "14 Calculators",
    link: "/app/calculators",
    body:
      "Every number real-estate agents never show you — now with proper XIRR, leverage-adjusted ROI, and long-horizon wealth modelling.",
    tips: [
      "Why buy (wealth) — 25-year buy vs rent-invest narrative with tier-1 premium + generational-transfer bonus.",
      "Car vs Property — full finance comparison (car DP + loan + running cost vs property DP + loan + rent).",
      "EMI · Rent vs Buy · Property vs MF vs Equity · Cashflow-positive finder.",
      "Rent-for-cashflow — the rent you need today to make your owned property CF-positive in N years.",
      "Resale estimator — min/current rent, renovation, broker fee, LTCG. Returns true XIRR.",
      "Loan Leverage Optimizer — DP sweep with 10-yr XIRR including appreciation + rent + EMI.",
      "Builder plan — CLP vs 10:90 vs subvention. UC expected value at possession (w/ pre-EMI by builder).",
      "RTM vs UC breakeven — min DP for each + 5-yr XIRR + subvention support.",
      "Prepay vs Invest — part / full / invest-surplus / hybrid scenarios with winner detection.",
      "XIRR — proper Newton-Raphson IRR for irregular real-estate cashflows.",
    ],
  },
  {
    icon: ChartPieSlice,
    title: "Portfolio",
    link: "/app/portfolio",
    body:
      "For properties you already own or have sold. Net worth, current value, total equity, realized gains, monthly cashflow; timeline chart; vs-markets comparison against equity/MF/gold/silver/FD; Sold ledger with realized P&L.",
    tips: [
      "Mark a property as Sold with sold_date + sold_price to see realized gains show up as a step line on the timeline.",
      "The opportunity-cost chart uses historical CAGR defaults (Equity 13%, MF 11%, Gold 9%, Silver 8.5%, FD 7%) — you'll be surprised how often your property wins.",
      "Net worth = current equity + cumulative realized gains from sold properties.",
    ],
  },
  {
    icon: MapTrifold,
    title: "Upcoming Projects directory",
    link: "/app/projects",
    body:
      "Curated under-construction & upcoming launches across tier-1 cities (BLR / MUM / NCR / HYD / PUN / CHN / KOL / AMD) with builder, possession, ticket size, RERA, and amenities. Filter by city, area, status. Star-watch projects and they show on your Dashboard.",
    tips: [
      "Submit your own community projects — they appear alongside curated ones.",
      "Watched projects show up as a section on your Dashboard with quick-access cards.",
    ],
  },
  {
    icon: UserCircle,
    title: "Tenants + Rent portal",
    link: "/app/tenants",
    body:
      "Track tenants across your owned rentals — name, rent, email, phone. Generate PDF rent receipts instantly. Invite your tenant to their own portal: they log in at /login and auto-route to /tenant, where they can pay rent via Razorpay and download receipts.",
    tips: [
      "Click \"Invite to tenant portal\" on any tenant card (needs the tenant's email). Estima creates a login with a temp password and shows it to you.",
      "Online rent payment auto-generates a receipt with payment_mode='Razorpay' and a unique receipt number.",
    ],
  },
  {
    icon: Scroll,
    title: "Will — succession planning",
    link: "/app/will",
    body:
      "Draft a Last Will and Testament with property-level allocation across named beneficiaries. Download a printable PDF you can have witnessed.",
    tips: [
      "Allocations are split per property — give 100% of Flat A to spouse, 60/40 of Flat B to two children, etc.",
      "Draft auto-saves. Review with a lawyer before signing — witnesses must be non-beneficiaries.",
    ],
  },
  {
    icon: Sparkle,
    title: "AI Advisor",
    link: "/app/advisor",
    body:
      "A Claude Sonnet 4.5 session that sees your property list and answers grounded questions. Pro feature.",
    tips: [
      "Ask specific questions: \"Given my 3 Bengaluru flats, which yields the best 10-year return assuming a job move to Chennai in 2028?\"",
      "The advisor always returns a 2-line verdict, 3-5 bullet reasoning, and one concrete next step.",
      "Session memory persists across messages. Click the seed prompts to see example queries.",
    ],
  },
  {
    icon: Crown,
    title: "Pricing & Pro",
    link: "/pricing",
    body:
      "Free ₹0 · Pro ₹999/month or ₹9,999/year. Every new account starts with a 10-day Pro trial automatically. Or click \"Try the demo\" on the login page — no signup.",
    tips: [
      "Pro unlocks unlimited properties, AI advisor, CSV/PDF exports, share links, cashflow finder, vs-markets chart, portfolio timeline, and Will PDF.",
      "Test payment card: 4111 1111 1111 1111 · any future expiry · any CVV.",
      "Cancel anytime — your Pro features keep working until the end of the paid period.",
    ],
  },
];

const FAQS = [
  {
    q: "How is the decision score calculated?",
    a: "For each property we take your 0-10 scores on Location/Amenities/Safety/Commute/Resale and multiply by your weights. Price/Value is auto-computed: the cheapest property per sqft gets 10, the most expensive gets 1, and the rest scale linearly. Total score is the weighted sum.",
  },
  {
    q: "Where do the default market returns come from?",
    a: "We use long-run CAGR approximations commonly cited in Indian personal finance: Equity (Nifty) ~13%, Mutual Funds ~11%, Gold ~9%, Silver ~8.5%, Bank FDs ~7%. These are defaults — override them on the Portfolio vs-markets section if your assumptions differ.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Every property, calculation and advisor conversation is scoped to your account. Shared comparison links are opt-in snapshots — the shared version never reveals your email or the other properties in your ledger.",
  },
  {
    q: "Can I import properties from a CSV?",
    a: "Not yet — it's on the roadmap. For now the fastest path is to use a city preset + sensible defaults for rows you haven't decided on yet; Estima treats any field as editable.",
  },
  {
    q: "What happens when my trial ends?",
    a: "Your account reverts to the Free plan. Your data stays intact. AI Advisor and exports lock, but all calculators, Compare, Portfolio tracking (read-only) and your saved properties remain accessible.",
  },
  {
    q: "How do I get a refund?",
    a: "Razorpay refunds are supported within 14 days — email us from your registered email and we'll process it. Trial-mode payments in the test environment don't settle, so no refund is needed.",
  },
];

export default function Guide() {
  const { user } = useAuth();
  const [showTour, setShowTour] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="max-w-5xl mx-auto px-8 py-10" data-testid="guide-page">
      <Tour open={showTour} onClose={() => setShowTour(false)} />

      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="eyebrow mb-2">User guide</div>
          <h1 className="font-serif text-5xl">How to use Estima.</h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            A 90-second tour, full feature reference, and the answers to the five questions
            every new user asks.
          </p>
        </div>
        <button
          onClick={() => {
            resetTour();
            setShowTour(true);
          }}
          className="btn-primary px-5 py-3 inline-flex items-center gap-2 text-sm"
          data-testid="guide-run-tour"
        >
          <PlayCircle size={16} weight="duotone" /> Run the tour again
        </button>
      </div>

      {/* Quick cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
        {[
          ["Properties", Buildings, "/app/properties"],
          ["Portfolio", ChartPieSlice, "/app/portfolio"],
          ["Compare", Scales, "/app/compare"],
          ["Calculators", Calculator, "/app/calculators"],
          ["AI Advisor", Sparkle, "/app/advisor"],
          ["Pricing", Crown, "/pricing"],
        ].map(([label, Icon, to]) => (
          <Link
            key={label}
            to={to}
            className="card-flat p-5 hover:border-[hsl(var(--secondary))] transition flex items-center gap-4"
            data-testid={`guide-quick-${label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="h-10 w-10 border hairline flex items-center justify-center text-[hsl(var(--secondary))] shrink-0">
              <Icon size={18} weight="duotone" />
            </div>
            <div>
              <div className="font-serif text-lg">{label}</div>
              <div className="text-xs text-muted-foreground">Go to {label.toLowerCase()} →</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Feature deep-dives */}
      <section className="mb-16">
        <div className="eyebrow mb-4">Feature reference</div>
        <div className="space-y-px bg-[hsl(var(--border))] border hairline">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="bg-card p-8" data-testid={`guide-feature-${i}`}>
                <div className="flex items-start gap-5">
                  <div className="h-12 w-12 border hairline flex items-center justify-center text-[hsl(var(--secondary))] shrink-0">
                    <Icon size={22} weight="duotone" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-serif text-2xl">{f.title}</h3>
                      <Link to={f.link} className="text-xs text-muted-foreground hover:text-foreground">
                        Open →
                      </Link>
                    </div>
                    <p className="text-muted-foreground leading-relaxed mb-4">{f.body}</p>
                    <ul className="space-y-2">
                      {f.tips.map((t, j) => (
                        <li key={j} className="flex gap-2 text-sm">
                          <span className="text-[hsl(var(--secondary))] font-serif">·</span>
                          <span className="text-muted-foreground">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQs */}
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <Question size={18} weight="duotone" className="text-[hsl(var(--secondary))]" />
          <div className="eyebrow">Frequently asked</div>
        </div>
        <div className="card-flat divide-y divide-[hsl(var(--border))]">
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <button
                key={i}
                onClick={() => setOpenFaq(open ? null : i)}
                className="w-full text-left p-5 hover:bg-[hsl(var(--muted))] transition"
                data-testid={`faq-${i}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="font-serif text-lg">{f.q}</div>
                  <CaretDown
                    size={16}
                    className={`mt-1 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </div>
                {open && (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed" data-testid={`faq-answer-${i}`}>
                    {f.a}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Shortcuts */}
      <section>
        <div className="eyebrow mb-4">Pro tips</div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="card-flat p-6">
            <FilePdf size={20} weight="duotone" className="text-[hsl(var(--secondary))] mb-3" />
            <div className="font-serif text-xl mb-2">Export the decision</div>
            <p className="text-sm text-muted-foreground">
              After scoring in Compare, use Export PDF to get a clean 1-page report. Share it with
              your spouse, CA, or parents instead of screenshotting spreadsheets.
            </p>
          </div>
          <div className="card-flat p-6">
            <ShareNetwork size={20} weight="duotone" className="text-[hsl(var(--secondary))] mb-3" />
            <div className="font-serif text-xl mb-2">Make the decision public (privately)</div>
            <p className="text-sm text-muted-foreground">
              The Share link generates a read-only comparison page at
              {" "}
              <code className="text-foreground">/share/&lt;id&gt;</code>. It's a snapshot — future edits
              to your properties don't change what the recipient sees.
            </p>
          </div>
        </div>
      </section>

      {user && !user.is_pro && (
        <div className="mt-16 card-flat p-8 border-[hsl(var(--secondary))] text-center">
          <Crown size={28} weight="duotone" className="text-[hsl(var(--secondary))] mx-auto mb-3" />
          <div className="font-serif text-3xl mb-3">Still on Free?</div>
          <p className="text-muted-foreground mb-6">
            Unlock the AI advisor, exports, share links, cashflow finder and vs-markets for ₹999/mo or ₹9,999/yr.
          </p>
          <Link to="/pricing" className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2" data-testid="guide-upgrade-cta">
            See plans
          </Link>
        </div>
      )}
    </div>
  );
}
