import { useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/format";
import { ChartBar } from "@phosphor-icons/react";

/**
 * Inline card showing ongoing rent + per-sqft-rate ranges for a property's micro-market.
 * Fetches on-demand; cached per city+area+bhk lookup.
 */
const _cache = new Map();

function deriveLocation(property) {
  const city = property.city_preset || (property.location || "").split(",").slice(-1)[0].trim() || "Bengaluru";
  const area = (property.location || "").split(",")[0].trim();
  const bhk = (property.name || "").match(/([1-5])\s*BHK/i)?.[0]?.replace(/\s+/g, "").toUpperCase();
  return { city, area, bhk };
}

function buildMarketQuery({ city, area, bhk }) {
  const params = [`city=${encodeURIComponent(city)}`];
  if (area) params.push(`area=${encodeURIComponent(area)}`);
  if (bhk) params.push(`bhk=${encodeURIComponent(bhk)}`);
  return params.join("&");
}

function RentVsMarket({ userRent, marketAvg }) {
  if (!(userRent > 0 && marketAvg > 0)) return null;
  const delta = userRent - marketAvg;
  const above = delta >= 0;
  return (
    <div className={`text-[11px] ${above ? "text-[hsl(var(--secondary))]" : "text-destructive"} pt-1`}>
      {above
        ? `✓ You charge ₹${inr(delta)} above market.`
        : `⚠ Market-rate is ₹${inr(-delta)} higher than your current rent.`}
    </div>
  );
}

function MarketSummary({ summary, userRent }) {
  if (!summary) {
    return <div className="text-muted-foreground">No market data for this micro-market yet.</div>;
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Avg rent/mo" value={inr(summary.rent_avg)} />
        <Stat label="Avg ₹/sqft" value={`₹${Number(summary.psf_avg).toLocaleString("en-IN")}`} />
        <Stat label="Avg yield" value={`${summary.yield_avg_pct}%`} />
      </div>
      <div className="text-[10px] text-muted-foreground pt-1">
        Rent range: ₹{Number(summary.rent_min).toLocaleString("en-IN")} – ₹{Number(summary.rent_max).toLocaleString("en-IN")} · ₹/sqft: {Number(summary.psf_min).toLocaleString("en-IN")} – {Number(summary.psf_max).toLocaleString("en-IN")} · sample {summary.sample_size}
      </div>
      <RentVsMarket userRent={userRent} marketAvg={summary.rent_avg} />
    </>
  );
}

export default function NearbyMarketCard({ property }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loc = deriveLocation(property);

  const fetch = async () => {
    if (data || loading) {
      setExpanded(!expanded);
      return;
    }
    const cacheKey = `${loc.city}|${loc.area}|${loc.bhk || ""}`;
    if (_cache.has(cacheKey)) {
      setData(_cache.get(cacheKey));
      setExpanded(true);
      return;
    }
    setLoading(true);
    try {
      const { data: res } = await api.get(`/market/nearby?${buildMarketQuery(loc)}`);
      _cache.set(cacheKey, res);
      setData(res);
      setExpanded(true);
      if (!res.rows?.length) toast("No market data for this area yet — contribute a data point!", { icon: "📊" });
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border hairline" data-testid={`nearby-market-${property.id}`}>
      <button onClick={fetch} className="w-full px-3 py-2 text-xs text-left hover:bg-[hsl(var(--muted))] flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <ChartBar size={12} weight="duotone" className="text-[hsl(var(--secondary))]" />
          Nearby market rates {loc.area ? `· ${loc.area}` : ""}{loc.bhk ? ` · ${loc.bhk}` : ""}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {loading ? "…" : expanded ? "hide" : "show"}
        </span>
      </button>
      {expanded && data && (
        <div className="px-3 py-3 border-t hairline text-xs space-y-2">
          <MarketSummary summary={data.summary} userRent={property.monthly_rent_income} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="num-metric text-foreground">{value}</div>
    </div>
  );
}
