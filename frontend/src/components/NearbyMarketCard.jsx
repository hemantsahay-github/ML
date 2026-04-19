import { useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/format";
import { MapPin, TrendUp, ChartBar } from "@phosphor-icons/react";

/**
 * Inline card showing ongoing rent + per-sqft-rate ranges for a property's micro-market.
 * Fetches on-demand; cached per city+area+bhk lookup.
 */
const _cache = new Map();

export default function NearbyMarketCard({ property }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const city = property.city_preset || (property.location || "").split(",").slice(-1)[0].trim() || "Bengaluru";
  const area = (property.location || "").split(",")[0].trim();
  const bhk = (property.name || "").match(/([1-5])\s*BHK/i)?.[0]?.replace(/\s+/g, "").toUpperCase();

  const fetch = async () => {
    if (data || loading) {
      setExpanded(!expanded);
      return;
    }
    const cacheKey = `${city}|${area}|${bhk || ""}`;
    if (_cache.has(cacheKey)) {
      setData(_cache.get(cacheKey));
      setExpanded(true);
      return;
    }
    setLoading(true);
    try {
      const params = [`city=${encodeURIComponent(city)}`];
      if (area) params.push(`area=${encodeURIComponent(area)}`);
      if (bhk) params.push(`bhk=${encodeURIComponent(bhk)}`);
      const { data: res } = await api.get(`/market/nearby?${params.join("&")}`);
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
          Nearby market rates {area ? `· ${area}` : ""}{bhk ? ` · ${bhk}` : ""}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {loading ? "…" : expanded ? "hide" : "show"}
        </span>
      </button>
      {expanded && data && (
        <div className="px-3 py-3 border-t hairline text-xs space-y-2">
          {data.summary ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Avg rent/mo" value={inr(data.summary.rent_avg)} />
                <Stat label="Avg ₹/sqft" value={`₹${Number(data.summary.psf_avg).toLocaleString("en-IN")}`} />
                <Stat label="Avg yield" value={`${data.summary.yield_avg_pct}%`} />
              </div>
              <div className="text-[10px] text-muted-foreground pt-1">
                Rent range: ₹{Number(data.summary.rent_min).toLocaleString("en-IN")} – ₹{Number(data.summary.rent_max).toLocaleString("en-IN")} · ₹/sqft: {Number(data.summary.psf_min).toLocaleString("en-IN")} – {Number(data.summary.psf_max).toLocaleString("en-IN")} · sample {data.summary.sample_size}
              </div>
              {property.monthly_rent_income > 0 && data.summary.rent_avg > 0 && (
                <div className={`text-[11px] ${property.monthly_rent_income >= data.summary.rent_avg ? "text-[hsl(var(--secondary))]" : "text-destructive"} pt-1`}>
                  {property.monthly_rent_income >= data.summary.rent_avg
                    ? `✓ You charge ₹${inr(property.monthly_rent_income - data.summary.rent_avg)} above market.`
                    : `⚠ Market-rate is ₹${inr(data.summary.rent_avg - property.monthly_rent_income)} higher than your current rent.`}
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground">No market data for this micro-market yet.</div>
          )}
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
