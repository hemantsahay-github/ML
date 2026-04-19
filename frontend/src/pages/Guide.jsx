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
  ShieldCheck,
  MapPin,
  EnvelopeSimple,
  Gift,
} from "@phosphor-icons/react";

const FEATURES = [
  {
    icon: Buildings,
    title: "Properties ledger · Nearby market · 1-click listings",
    link: "/app/properties",
    body:
      "Add every flat, villa or plot you're evaluating — plus any you already own or have sold. Each property carries price, carpet area, loan terms, your subjective scores (location/amenities/safety/commute/resale), and optional owned/sold metadata. Owned properties now also surface nearby rent/sqft data and a 1-click rental-listing generator.",
    tips: [
      "Use the Apply city preset row to auto-fill appreciation & yield for Bengaluru, Mumbai, Hyderabad etc.",
      "Status toggle: Evaluating (default), Owned (tracks current value, equity, rent), Sold (records gain/loss).",
      "Nearby market card on owned properties: see community-contributed rent ₹/sqft around your locality; contribute your own data point in one tap.",
      "\"List for rent in 1 click\" on owned cards — pick rent/deposit/furnishing, optionally ask AI to write the description, and Estima returns paste-ready deep-links for 99acres, MagicBricks, Housing.com, NoBroker, OLX, Quikr, plus a WhatsApp share text.",
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
    title: "14 Calculators with proper XIRR",
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
    icon: ShieldCheck,
    title: "Aadhaar tenant verification",
    link: "/app/tenants",
    body:
      "Verify your tenant's Aadhaar on-file using a stubbed OTP flow (wired to UIDAI's official sandbox contract for easy prod-swap). Once verified, the card shows a \"Aadhaar verified ****XXXX\" badge — useful for rental agreements and society onboarding.",
    tips: [
      "Click Verify Aadhaar on any tenant card → enter last-4 digits + Aadhaar-linked phone → send OTP → confirm.",
      "The stub accepts any 6-digit OTP; swap the handler for a real UIDAI partner (Digio, Karza, SignDesk) when ready.",
      "Mode is stored as 'stub' on the tenant record so you can audit later.",
    ],
  },
  {
    icon: MapPin,
    title: "Nearby market data",
    link: "/app/properties",
    body:
      "See real rent and ₹/sqft data for the area around any owned property — aggregated from Estima's city presets plus community contributions. Crowd-sourced, transparent, always local.",
    tips: [
      "Nearby card surfaces: mean rent, median rent, rent per sqft, and the size of the comparison set.",
      "Contribute anonymously — one tap adds your locality's rent and helps the next user.",
      "Filters applied: city → area → type (flat/villa/plot) → BHK match.",
    ],
  },
  {
    icon: Scroll,
    title: "Will — AI draft · Lawyer · Witness e-sign · Notify",
    link: "/app/will",
    body:
      "A full succession workflow. Draft your Last Will and Testament with property-level allocations across named beneficiaries — or let AI draft a distribution based on your family context. Send to a lawyer for review, collect Aadhaar-backed e-signatures from witnesses, and notify each beneficiary with a password-protected PDF.",
    tips: [
      "AI-draft — provide family context + distribution style (equal / spouse-first / legacy-trust / custom) and Claude Sonnet 4.5 returns beneficiaries + per-property splits + reasoning. You can edit anything before saving.",
      "Lawyer review — send the Will to any lawyer via email; they review at a secure public link (30-day token) and return approved/rejected with comments. Status lands on your Will record.",
      "Witness e-sign — invite witness 1 and witness 2 via email. They sign at a public link with Aadhaar last-4 + OTP (stub OK for testing; swap for UIDAI in prod).",
      "Notify beneficiaries — single click emails each beneficiary a password-protected Will PDF (mocked Resend — logs in dev, swap for a real API key in prod).",
      "Download an Indian-Succession-Act-compliant PDF at any point.",
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
    icon: Gift,
    title: "Refer & earn · Demo mode",
    link: "/app/referrals",
    body:
      "Every account gets a unique referral code — each signup via your link earns you 30 extra days of Pro, instantly. Prefer to browse first? Click \"Try the demo — no signup\" on the login page for a fully-seeded sandbox (4 sample properties, tenants, and receipts).",
    tips: [
      "Copy or WhatsApp-share your code from the Referrals page. Earnings credit the moment the referred user verifies their email.",
      "Demo account is isolated — your real data is never touched. Great for sharing screenshots with a prospect.",
    ],
  },
  {
    icon: Crown,
    title: "Pricing & Pro",
    link: "/pricing",
    body:
      "Free ₹0 · Pro ₹999/month or ₹9,999/year. Every new account starts with a 10-day Pro trial automatically. Or click \"Try the demo\" on the login page — no signup.",
    tips: [
      "Pro unlocks unlimited properties, AI advisor, CSV/PDF exports, share links, cashflow finder, vs-markets chart, portfolio timeline, AI Will drafting, and Will PDF.",
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
  {
    q: "Is the Aadhaar tenant verification real?",
    a: "The Aadhaar verification flow is intentionally stubbed (accepts any 6-digit OTP) so the whole product works end-to-end without a paid UIDAI partner. The contract matches how partners like Digio, Karza or SignDesk expose Aadhaar OTP — one backend swap turns it live. Every verified record is tagged mode='stub' for audit.",
  },
  {
    q: "Will my lawyer and witnesses receive real emails?",
    a: "Lawyer-review and witness-sign emails use a Resend mock in dev (logs to server stdout) — the signing links themselves work end-to-end. Add a RESEND_API_KEY to backend/.env to send real email. The password-protected Will PDF is generated either way.",
  },
  {
    q: "How accurate is the Nearby market data?",
    a: "Two sources: (1) Estima's curated city-rent presets per locality, and (2) anonymous user contributions. Median and mean are reported separately so outliers are visible. Always sanity-check against 99acres / MagicBricks — and please contribute a data point after you've rented out your own flat.",
  },
  {
    q: "Can the AI actually draft my Will?",
    a: "AI-draft takes your properties + family context + distribution style (equal / spouse-first / legacy-trust / custom) and returns beneficiaries + per-property allocations + reasoning. It's a starting draft, not legal advice — every output is fully editable before saving, and you should still run it past a family-law lawyer before signing.",
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
          ["Projects", MapTrifold, "/app/projects"],
          ["Tenants", UserCircle, "/app/tenants"],
          ["Will", Scroll, "/app/will"],
          ["AI Advisor", Sparkle, "/app/advisor"],
          ["Refer & earn", Gift, "/app/referrals"],
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
