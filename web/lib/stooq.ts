// Stooq.com daily-CSV fetcher.
//
// Stooq's CSV download endpoint requires an API key (free signup at
// https://stooq.com/q/d/?s=avgo.us&get_apikey). With a key, the limits
// are generous enough to load a 40-ticker portfolio in one go, which is
// the binding constraint we hit with Twelve Data's 8-credits/min free tier.
//
// URL: https://stooq.com/q/d/l/?s={symbol}&i=d&d1=YYYYMMDD&d2=YYYYMMDD&apikey=KEY
// Symbols use lowercase + market suffix:
//   US stocks/ETFs: avgo.us, spy.us, qqq.us, smh.us, mu.us
//   Indices:        ^spx (S&P 500), ^ndx (Nasdaq 100), ^ixic (Nasdaq Composite)
// CSV format: Date,Open,High,Low,Close,Volume

import type { PriceSeries } from "./types";

const RANGE_DAYS: Record<string, number> = {
  "5d": 7, "1mo": 35, "3mo": 95, "6mo": 190, "ytd": 200,
  "1y": 370, "2y": 740, "5y": 1830, "10y": 3660, "max": 0,
};

function fmtDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function stooqSymbol(ticker: string): string {
  const t = ticker.trim().toLowerCase();
  // Indices: ^spx, ^ndx, ^ixic — pass through unchanged.
  if (t.startsWith("^")) return t;
  // Already has a market suffix (.us, .de, .uk, .pl ...) — pass through.
  if (/\.[a-z]{2,3}$/.test(t)) return t;
  // Default: assume US listing.
  return `${t}.us`;
}

function stooqInterval(interval: string): string {
  if (interval === "1wk") return "w";
  if (interval === "1mo") return "m";
  return "d";
}

function parseCsv(csv: string, ticker: string): PriceSeries {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { ticker, dates: [], closes: [], error: "Stooq empty CSV" };
  }
  const header = lines[0].toLowerCase();
  if (header.startsWith("get your apikey") || /apikey/i.test(header)) {
    return { ticker, dates: [], closes: [], error: "Stooq apikey required/invalid" };
  }
  const cols = header.split(",");
  const dateIdx = cols.indexOf("date");
  const closeIdx = cols.indexOf("close");
  if (dateIdx < 0 || closeIdx < 0) {
    return { ticker, dates: [], closes: [], error: `Stooq unexpected header: ${header}` };
  }
  const dates: string[] = [];
  const closes: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const d = parts[dateIdx];
    const c = parseFloat(parts[closeIdx]);
    if (!d || !Number.isFinite(c)) continue;
    dates.push(d.length === 10 ? d : `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
    closes.push(c);
  }
  return { ticker, dates, closes };
}

export async function fetchStooq(
  ticker: string,
  range: string,
  interval: string,
): Promise<PriceSeries> {
  const apikey = process.env.STOOQ_API_KEY;
  if (!apikey) {
    return { ticker, dates: [], closes: [], error: "no STOOQ_API_KEY" };
  }
  const sym = stooqSymbol(ticker);
  const i = stooqInterval(interval);
  const days = RANGE_DAYS[range] ?? 35;
  const today = new Date();
  let dateRange = "";
  if (days > 0) {
    const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    dateRange = `&d1=${fmtDate(start)}&d2=${fmtDate(today)}`;
  }
  const url =
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=${i}${dateRange}` +
    `&apikey=${encodeURIComponent(apikey)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "tidyedgar-portfolio-tracker" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return { ticker, dates: [], closes: [], error: `Stooq HTTP ${res.status}` };
    }
    const csv = await res.text();
    return parseCsv(csv, ticker);
  } catch (e: any) {
    return { ticker, dates: [], closes: [], error: e?.message || "Stooq fetch failed" };
  }
}
