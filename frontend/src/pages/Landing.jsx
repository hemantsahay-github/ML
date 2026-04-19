import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Buildings, ChartLineUp, Scales, Sparkle, MapTrifold, Scroll, UserCircle, Calculator, PlayCircle, ShieldCheck, MapPin } from "@phosphor-icons/react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1774415108809-87df103ee55f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbW9vZHklMjBtb2Rlcm4lMjBhcGFydG1lbnQlMjBpbnRlcmlvciUyMGV2ZW5pbmd8ZW58MHx8fHwxNzc2NTQyMTkyfDA&ixlib=rb-4.1.0&q=85";

const features = [
  {
    icon: <Buildings size={22} weight="duotone" />,
    title: "Property ledger",
    body: "Catalogue every flat, villa, and plot — with price, carpet area, loan terms and your gut-feel scores. Status-tracked across Evaluating, Owned, Sold.",
  },
  {
    icon: <Scales size={22} weight="duotone" />,
    title: "Side-by-side scoring",
    body: "Weighted decision score across location, commute, resale and price/value. Share a read-only link with family. CSV + PDF export.",
  },
  {
    icon: <Calculator size={22} weight="duotone" />,
    title: "14 calculators with XIRR",
    body: "EMI · Rent vs Buy · Car vs Property · UC expected value · RTM vs UC breakeven · Leverage Optimizer · Wealth narrative · Prepay vs Invest — all with proper XIRR math.",
  },
  {
    icon: <ChartLineUp size={22} weight="duotone" />,
    title: "Portfolio vs markets",
    body: "Own it? Watch your property compound against Nifty, MF, gold, silver, FD. Realized P&L on every flip.",
  },
  {
    icon: <MapTrifold size={22} weight="duotone" />,
    title: "Upcoming projects radar",
    body: "Curated launches across BLR / MUM / NCR / HYD / PUN / CHN. Star-watch the ones you care about; they follow you to your Dashboard.",
  },
  {
    icon: <MapPin size={22} weight="duotone" />,
    title: "Nearby market data",
    body: "Real rent and ₹/sqft around every owned property — Estima's city presets + community contributions. 1-click rental listings that deep-link to 99acres, MagicBricks, NoBroker & more.",
  },
  {
    icon: <UserCircle size={22} weight="duotone" />,
    title: "Tenants + rent portal",
    body: "Track tenants, generate PDF receipts, and invite them to a Razorpay-powered portal. They pay; Estima auto-generates the receipt.",
  },
  {
    icon: <ShieldCheck size={22} weight="duotone" />,
    title: "Aadhaar verification",
    body: "Verify tenants and Will-witnesses with an Aadhaar OTP flow (UIDAI-contract-compatible stub today; real partner swap when you're ready).",
  },
  {
    icon: <Scroll size={22} weight="duotone" />,
    title: "AI Will · Lawyer · Witness e-sign",
    body: "Let AI draft a property-level distribution, send to a lawyer for review, collect Aadhaar-backed e-signatures from witnesses, and email each beneficiary a password-protected PDF.",
  },
  {
    icon: <Sparkle size={22} weight="duotone" />,
    title: "AI advisor",
    body: "Claude Sonnet 4.5 reads your numbers and returns a 2-line verdict, 5 bullets of reasoning, and one concrete next step.",
  },
  {
    icon: <PlayCircle size={22} weight="duotone" />,
    title: "One-click demo mode",
    body: "Kick the tires with no signup. Pre-seeded with sample properties, tenants and receipts.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b hairline">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-logo">
            <div className="h-8 w-8 border hairline flex items-center justify-center">
              <span className="font-serif text-xl leading-none">E</span>
            </div>
            <span className="font-serif text-2xl tracking-tight">Estima</span>
          </Link>
          <nav className="flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition">
              Features
            </a>
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground transition">
              How it works
            </a>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition" data-testid="nav-pricing-link">
              Pricing
            </Link>
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition"
              data-testid="nav-login-link"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="btn-primary text-sm px-4 py-2"
              data-testid="nav-register-cta"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b hairline">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${HERO_IMG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "brightness(0.35) saturate(1.1)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        <div className="relative max-w-7xl mx-auto px-6 py-28 lg:py-36">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <div className="eyebrow mb-6" data-testid="hero-eyebrow">
              A property decision engine · built for Indian buyers
            </div>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-foreground">
              Buy the right home,
              <br />
              <span className="italic text-[hsl(var(--secondary))]">not the shiny one.</span>
            </h1>
            <p className="mt-8 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Estima puts every flat, villa and plot you&apos;re eyeing on a single scorecard —
              then stress-tests each against renting, mutual funds and equity. You ship a
              decision, not a spreadsheet.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link
                to="/register"
                className="btn-primary px-6 py-3 inline-flex items-center gap-2 text-sm"
                data-testid="hero-cta-register"
              >
                Build your first comparison <ArrowRight size={16} weight="bold" />
              </Link>
              <Link
                to="/login"
                className="btn-ghost px-6 py-3 text-sm"
                data-testid="hero-cta-login"
              >
                I already have an account
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b hairline">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { k: "₹85L+", v: "avg. decision value" },
            { k: "4-way", v: "comparison matrix" },
            { k: "<60s", v: "to a verdict" },
            { k: "0%", v: "builder bias" },
          ].map((s) => (
            <div key={s.v}>
              <div className="num-metric text-3xl md:text-4xl text-foreground">{s.k}</div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-2">
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-16">
          <div className="eyebrow mb-4">What Estima does</div>
          <h2 className="font-serif text-4xl md:text-5xl leading-tight">
            A single place where real estate meets the rest of your portfolio.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-[hsl(var(--border))] border hairline">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-card p-8 md:p-10"
              data-testid={`feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="text-[hsl(var(--secondary))] mb-6">{f.icon}</div>
              <h3 className="font-serif text-2xl mb-3">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t hairline bg-[hsl(var(--muted))]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16">
            <div>
              <div className="eyebrow mb-4">The method</div>
              <h2 className="font-serif text-4xl md:text-5xl leading-tight mb-8">
                Numbers first. Vibes second.
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Every home you consider is scored on six axes and six financial scenarios.
                Nothing is hidden behind jargon — every assumption is editable, every chart is
                explained.
              </p>
            </div>
            <ol className="space-y-6">
              {[
                ["01", "Add the properties", "Price, area, loan, expected appreciation and rental yield."],
                ["02", "Score the intangibles", "Location, amenities, safety, commute, resale — 0 to 10."],
                ["03", "Run the comparisons", "Rent vs Buy. Property vs Mutual Funds vs Equity. EMI schedules."],
                ["04", "Ask the advisor", "Claude-powered verdict grounded in your actual numbers."],
              ].map(([n, t, b]) => (
                <li key={n} className="flex gap-6 border-b hairline pb-6">
                  <div className="num-metric text-3xl text-[hsl(var(--secondary))] w-16 shrink-0">
                    {n}
                  </div>
                  <div>
                    <div className="font-serif text-xl mb-1">{t}</div>
                    <div className="text-sm text-muted-foreground">{b}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Demo videos */}
      <section className="border-t hairline">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-12">
            <div className="eyebrow mb-4">See it in action</div>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight">
              90 seconds to see how Estima decides.
            </h2>
            <p className="text-muted-foreground mt-4">
              Short walkthroughs of every flow — before you sign up, before you commit.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Compare 3 flats in under a minute",
                length: "0:52",
                body: "From empty ledger to a weighted winner — watch the side-by-side score reveal itself.",
              },
              {
                title: "Rent vs buy, with real math",
                length: "1:14",
                body: "Breakeven year, net worth trajectories, and why this number often surprises you.",
              },
              {
                title: "Property vs mutual funds vs equity",
                length: "1:02",
                body: "Run your property against Nifty, gold, and MF CAGRs. See who wins at 10 years.",
              },
              {
                title: "The AI advisor takes your call",
                length: "0:48",
                body: "Claude Sonnet 4.5 reading your numbers and returning a verdict in plain language.",
              },
            ].map((v) => (
              <div
                key={v.title}
                data-testid={`demo-video-${v.title.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`}
                className="card-flat overflow-hidden group"
              >
                <div className="aspect-video relative bg-[hsl(var(--muted))] overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/10 via-transparent to-[hsl(var(--secondary))]/10" />
                  <div className="relative text-center">
                    <div className="h-16 w-16 rounded-full bg-[hsl(var(--primary))]/20 border border-[hsl(var(--primary))] flex items-center justify-center text-[hsl(var(--primary))] mx-auto mb-3">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <div className="text-xs text-muted-foreground tracking-widest uppercase">Coming soon</div>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-background/80 px-2 py-0.5 text-[11px] font-mono">
                    {v.length}
                  </div>
                </div>
                <div className="p-6">
                  <div className="font-serif text-xl mb-2">{v.title}</div>
                  <div className="text-sm text-muted-foreground">{v.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why buy teaser */}
      <section className="border-t hairline bg-[hsl(var(--muted))]/40">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-[1fr_1.3fr] gap-12 items-center">
            <div>
              <div className="eyebrow mb-4 text-[hsl(var(--secondary))]">Long-game math</div>
              <h2 className="font-serif text-4xl md:text-5xl leading-tight">Why buying still wins over 25 years.</h2>
              <p className="text-muted-foreground mt-5 leading-relaxed">
                Tier-1 land is finite. Rents compound at 8% a year. EMIs end at tenure — and every rupee after that becomes investable. And when you pass property on, India&apos;s capital-gains clock resets at zero. Run your own numbers in the Wealth narrative calculator.
              </p>
              <Link to="/register" className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2 mt-8" data-testid="wealth-landing-cta">
                Run the 25-year math <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { h: "Tier-1 land is finite", p: "Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune — a fixed-supply game with a growing buyer pool." },
                { h: "Rent compounds 8% a year", p: "₹30k today ≈ ₹2L in 25 years. That money never comes back." },
                { h: "EMI has an expiry date", p: "After year 20 every rupee that used to go to the bank compounds into your net worth." },
                { h: "Generational tax-free transfer", p: "Inheritance resets India's capital-gains clock to zero. Equity and MFs don't." },
              ].map((c) => (
                <div key={c.h} className="card-flat p-5" data-testid={`why-buy-${c.h.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`}>
                  <div className="font-serif text-xl mb-2">{c.h}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t hairline">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h2 className="font-serif text-4xl md:text-5xl mb-6">
            Stop arguing with your spouse about spreadsheets.
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
            Create your account and model your first property in under two minutes.
          </p>
          <Link
            to="/register"
            className="btn-primary px-8 py-4 inline-flex items-center gap-2"
            data-testid="cta-register-bottom"
          >
            Get started · it&apos;s free <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </section>

      <footer className="border-t hairline">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Estima — a personal property decision engine.</div>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              Method
            </a>
            <Link to="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link to="/disclaimer" className="hover:text-foreground" data-testid="landing-disclaimer-link">
              Disclaimer
            </Link>
            <Link to="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
