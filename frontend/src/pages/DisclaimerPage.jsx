import { Link } from "react-router-dom";
import { ArrowLeft, ShieldWarning } from "@phosphor-icons/react";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="disclaimer-page">
      <header className="border-b hairline">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 border hairline flex items-center justify-center">
              <span className="font-serif text-xl leading-none">E</span>
            </div>
            <span className="font-serif text-2xl tracking-tight">Estima</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-6 text-[hsl(var(--secondary))]">
          <ShieldWarning size={22} weight="duotone" />
          <div className="eyebrow">Legal · Disclaimer</div>
        </div>
        <h1 className="font-serif text-5xl mb-6">Estimates, not advice.</h1>
        <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed space-y-5">
          <p>
            Estima is an <span className="text-foreground">illustrative decision-support tool</span>{" "}
            for comparing personal property options and tracking owned real estate. Every number the
            app produces is an <span className="text-foreground">estimate</span> based on the inputs
            you have supplied and the assumptions you (or we, as defaults) have chosen.
          </p>
          <p>
            Market values, appreciation rates, rental yields, interest rates, tax treatment (LTCG,
            STT, stamp duty, registration), CAGR assumptions for equity / mutual funds / gold /
            silver / fixed deposits, and broker fees all change over time and across geographies.
            Estima does not verify any of these numbers against live market data.
          </p>
          <p>
            <span className="text-foreground">Nothing produced by Estima</span> — including AI
            advisor responses, comparison scores, rent-vs-buy projections, cashflow finders,
            resale estimates, portfolio timelines, or market comparison charts —{" "}
            <span className="text-foreground">constitutes investment, tax, legal, or
            real-estate advice.</span>
          </p>
          <p>
            Before acting on anything you see here, consult qualified professionals: a{" "}
            <span className="text-foreground">SEBI-registered investment advisor</span> or{" "}
            <span className="text-foreground">chartered accountant</span> for financial matters, a{" "}
            <span className="text-foreground">lawyer</span> for legal due diligence, and a trusted{" "}
            <span className="text-foreground">real-estate professional</span> for on-ground market
            conditions.
          </p>
          <p>
            The final responsibility for any property purchase, sale, financing, lease, investment
            or hold decision made by you —{" "}
            <span className="text-foreground">and for the financial outcomes of that decision</span>
            {" "}— rests <span className="text-foreground">solely and entirely with you</span>.
          </p>
          <p className="border-l-2 border-[hsl(var(--primary))] pl-4 text-foreground">
            By using Estima you acknowledge that you have read and understood this disclaimer and
            accept full responsibility for any action you take based on information obtained from
            the product.
          </p>
        </div>
      </div>
    </div>
  );
}
