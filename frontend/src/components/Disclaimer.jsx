import { Info } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const LONG = (
  <>
    Estima presents <span className="text-foreground">estimates and comparisons</span> derived from
    the inputs and assumptions you provide. Figures are illustrative — market values, appreciation,
    rental yields, CAGRs (Nifty/Gold/MF), tax rates and loan behaviour can deviate substantially in
    reality. Nothing here is investment, tax, legal or real-estate advice. Any decision to buy,
    sell, finance, rent or hold property is{" "}
    <span className="text-foreground">yours alone</span> and should be taken after consulting a
    qualified advisor.
  </>
);

export default function Disclaimer({ variant = "inline" }) {
  if (variant === "compact") {
    return (
      <div
        className="text-[11px] text-muted-foreground border hairline px-3 py-2 bg-[hsl(var(--muted))] flex items-start gap-2"
        data-testid="disclaimer-compact"
      >
        <Info size={12} weight="duotone" className="mt-0.5 shrink-0 text-[hsl(var(--secondary))]" />
        <span>
          Illustrative estimates. Not financial advice — final decisions and responsibility are yours.{" "}
          <Link to="/disclaimer" className="underline underline-offset-2 hover:text-foreground">
            Read full disclaimer
          </Link>
          .
        </span>
      </div>
    );
  }
  return (
    <div
      className="mt-10 border-t hairline pt-6 text-xs text-muted-foreground max-w-3xl flex gap-3"
      data-testid="disclaimer-inline"
    >
      <Info size={16} weight="duotone" className="mt-0.5 shrink-0 text-[hsl(var(--secondary))]" />
      <div className="leading-relaxed">
        <span className="eyebrow block mb-1.5">Disclaimer</span>
        {LONG}
      </div>
    </div>
  );
}
