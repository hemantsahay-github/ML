import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Buildings,
  ChartPieSlice,
  Scales,
  Calculator,
  Sparkle,
  Crown,
  Check,
} from "@phosphor-icons/react";

const STORAGE_KEY = "estima_tour_seen_v1";

const STEPS = [
  {
    icon: Buildings,
    title: "Step 1 · Add your first property",
    body:
      "Head to Properties and fill in price, area, loan terms, and your gut-feel scores for Location, Safety, Commute etc. You can add multiple flats, villas or plots side by side.",
    cta: "Open Properties",
    to: "/app/properties",
    testid: "tour-step-properties",
  },
  {
    icon: Scales,
    title: "Step 2 · Compare them",
    body:
      "Pick two or more candidates in Compare. Tune the weights that matter to you, then hit Score. Estima surfaces a weighted winner with a radar breakdown and a ranked table.",
    cta: "Try Compare",
    to: "/app/compare",
    testid: "tour-step-compare",
  },
  {
    icon: Calculator,
    title: "Step 3 · Run the brutal math",
    body:
      "Calculators has four tabs: EMI, Rent vs Buy, Property vs MF vs Equity, and a Cashflow-positive finder that reverse-solves for the max property price your rent can actually support.",
    cta: "Open Calculators",
    to: "/app/calculators",
    testid: "tour-step-calc",
  },
  {
    icon: ChartPieSlice,
    title: "Step 4 · Already own property? Add it to Portfolio",
    body:
      "Mark a property as Owned (or Sold) with purchase date & price. Portfolio tracks current value, equity, monthly cashflow, realized gains — plus a year-by-year timeline and a vs-markets comparison against equity, MF, gold, silver, FD.",
    cta: "See Portfolio",
    to: "/app/portfolio",
    testid: "tour-step-portfolio",
  },
  {
    icon: Sparkle,
    title: "Step 5 · Ask the AI advisor",
    body:
      "Pro feature. Claude Sonnet 4.5 reads your data (properties + calculators) and gives a verdict in plain language. Great for arguments with your spouse or your CA.",
    cta: "Open Advisor",
    to: "/app/advisor",
    testid: "tour-step-advisor",
  },
  {
    icon: Crown,
    title: "You're all set.",
    body:
      "You have 10 days of full Pro access — exports, share links, AI advisor, everything. Lock it in anytime from Pricing. Need to revisit this tour? Click the Guide button in the header.",
    cta: "Start using Estima",
    to: "/app",
    testid: "tour-step-done",
  },
];

export function hasSeenTour() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}
export function markTourSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}
export function resetTour() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function Tour({ open, onClose }) {
  const [i, setI] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  if (!open) return null;
  const step = STEPS[i];
  const Icon = step.icon;
  const isLast = i === STEPS.length - 1;

  const dismiss = () => {
    markTourSeen();
    onClose?.();
  };

  const next = () => {
    if (isLast) {
      dismiss();
      nav(step.to);
    } else {
      setI((x) => x + 1);
    }
  };

  const go = () => {
    markTourSeen();
    onClose?.();
    nav(step.to);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        data-testid="tour-modal"
      >
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" onClick={dismiss} />
        <motion.div
          className="relative card-flat w-full max-w-2xl mx-6 overflow-hidden"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 btn-ghost p-2 z-10"
            data-testid="tour-close"
            aria-label="Close tour"
          >
            <X size={14} />
          </button>

          {/* progress */}
          <div className="flex gap-1 p-1">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-0.5 flex-1 transition ${
                  idx <= i ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--border))]"
                }`}
              />
            ))}
          </div>

          <div className="p-10" data-testid={step.testid}>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 border hairline flex items-center justify-center text-[hsl(var(--secondary))]">
                <Icon size={20} weight="duotone" />
              </div>
              <div className="eyebrow">
                {i + 1} / {STEPS.length}
              </div>
            </div>

            <h2 className="font-serif text-3xl md:text-4xl mb-4 leading-tight">{step.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-8">{step.body}</p>

            <div className="flex items-center gap-3">
              {i > 0 && (
                <button
                  onClick={() => setI((x) => x - 1)}
                  className="btn-ghost px-4 py-2.5 text-sm inline-flex items-center gap-2"
                  data-testid="tour-prev"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              )}
              <button
                onClick={next}
                className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2"
                data-testid="tour-next"
              >
                {isLast ? (
                  <>
                    <Check size={14} weight="bold" /> {step.cta}
                  </>
                ) : (
                  <>
                    Next <ArrowRight size={14} weight="bold" />
                  </>
                )}
              </button>
              {!isLast && (
                <button
                  onClick={go}
                  className="text-xs text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1"
                  data-testid="tour-go-there"
                >
                  Take me there <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="border-t hairline px-10 py-4 flex items-center justify-between text-xs text-muted-foreground">
            <button onClick={dismiss} className="hover:text-foreground" data-testid="tour-skip">
              Skip tour
            </button>
            <Link to="/pricing" onClick={dismiss} className="hover:text-foreground inline-flex items-center gap-1">
              <Crown size={12} weight="duotone" /> View pricing
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
