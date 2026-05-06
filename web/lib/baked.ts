// Baked-prices loader. Reads `public/prices_baked.json` once at module
// init (cold start) and serves daily-resolution slices from memory.
//
// The file is regenerated locally by `scripts/bake_prices.py` and
// committed to the repo. Vercel auto-redeploys on push, so the baked
// prices update with each push (typically weekly).
//
// Why this exists: Yahoo throttles Vercel IPs hard, and the Twelve Data
// free tier caps at 8 calls/min. Baking the canonical 49-ticker watchlist
// ahead of time means the standard portfolios load with zero upstream
// API calls and no rate-limit risk.

import type { PriceSeries } from "./types";
// Import the baked JSON directly so Next.js bundles it with the route
// handler (instead of relying on filesystem access to /public, which
// Vercel doesn't expose to serverless functions consistently).
import bakedData from "./data/prices_baked.json";

type BakedFile = {
  baked_at: string;
  range: string;
  interval: string;
  series: Record<string, { ticker: string; currency?: string; dates: string[]; closes: number[] }>;
};

const baked: BakedFile = bakedData as unknown as BakedFile;

const TRADING_DAYS: Record<string, number> = {
  "5d": 6, "1mo": 24, "3mo": 66, "6mo": 130, "ytd": 0,
  "1y": 260, "2y": 520, "5y": 1300, "10y": 2600, "max": 0,
};

/**
 * Slice baked daily data to match the requested range/interval.
 * Returns null if the ticker isn't in the bake or interval isn't daily.
 */
export function getBakedSlice(ticker: string, range: string, interval: string): PriceSeries | null {
  if (interval !== "1d") return null; // bake is daily-only
  const s = baked.series[ticker.toUpperCase()];
  if (!s || !s.dates.length) return null;

  const n = s.dates.length;
  let startIdx = 0;
  if (range === "ytd") {
    const year = new Date().getUTCFullYear().toString();
    startIdx = s.dates.findIndex((d) => d >= `${year}-01-01`);
    if (startIdx < 0) startIdx = 0;
  } else if (range === "max") {
    startIdx = 0;
  } else {
    const days = TRADING_DAYS[range] ?? 260;
    startIdx = Math.max(0, n - days);
  }
  return {
    ticker: s.ticker,
    currency: s.currency,
    dates: s.dates.slice(startIdx),
    closes: s.closes.slice(startIdx),
  };
}

/** Lightweight metadata for diagnostics — exposed as a header. */
export function bakedMeta(): { tickers: number; baked_at: string } | null {
  return { tickers: Object.keys(baked.series).length, baked_at: baked.baked_at };
}
