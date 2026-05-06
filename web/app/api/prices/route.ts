import { NextRequest, NextResponse } from "next/server";
import type { PriceSeries, PricesResponse } from "@/lib/types";
import { fetchYahooChart, primeYahooSession } from "@/lib/yahoo";
import { fetchStooq } from "@/lib/stooq";
import { priceCacheKey, getCached, setCached } from "@/lib/cache";
import { getBakedSlice, bakedMeta } from "@/lib/baked";

const ALLOWED_RANGES = new Set(["5d", "1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y", "10y", "max"]);
const ALLOWED_INTERVALS = new Set(["1d", "1wk", "1mo"]);

// Approx trading days for the requested range — used for Twelve Data outputsize.
const RANGE_DAYS: Record<string, number> = {
  "5d": 6, "1mo": 24, "3mo": 66, "6mo": 130, "ytd": 130,
  "1y": 260, "2y": 520, "5y": 1300, "10y": 2600, "max": 5000,
};

// Yahoo aggressively throttles Vercel IPs. Even 6 in-flight gets most calls
// rejected with HTTP 429. Drop to 2 — slightly slower, far higher hit rate.
const MAX_CONCURRENCY = 2;
// Inter-request jitter so we don't burst against Yahoo's bucket.
const JITTER_MS = 120;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Run async tasks with bounded concurrency, preserving result order. */
async function pmap<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Twelve Data batch endpoint: up to 8 symbols per call. Returns map keyed by ticker. */
async function fetchTwelveDataBatch(
  tickers: string[], range: string, interval: string,
): Promise<Map<string, PriceSeries>> {
  const out = new Map<string, PriceSeries>();
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key || tickers.length === 0) {
    for (const t of tickers) out.set(t, { ticker: t, dates: [], closes: [], error: "no TWELVEDATA_API_KEY" });
    return out;
  }
  const td_interval = interval === "1wk" ? "1week" : interval === "1mo" ? "1month" : "1day";
  const outputsize = Math.min(RANGE_DAYS[range] ?? 30, 5000);
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tickers.join(","))}` +
    `&interval=${td_interval}&outputsize=${outputsize}&apikey=${encodeURIComponent(key)}`;
  let json: any;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      for (const t of tickers) out.set(t, { ticker: t, dates: [], closes: [], error: `TwelveData HTTP ${res.status}` });
      return out;
    }
    json = await res.json();
  } catch (e: any) {
    for (const t of tickers) out.set(t, { ticker: t, dates: [], closes: [], error: e?.message || "TwelveData fetch failed" });
    return out;
  }

  // Single-symbol → { meta, values, status }; batch → { TICKER: {...}, ... }.
  const isBatch = !json?.values && !json?.status;
  const parseOne = (ticker: string, payload: any): PriceSeries => {
    if (!payload || payload?.status === "error") {
      return { ticker, dates: [], closes: [], error: payload?.message || "TwelveData error" };
    }
    const values: any[] = payload?.values || [];
    values.reverse(); // newest-first → oldest-first
    const dates: string[] = [];
    const closes: number[] = [];
    for (const v of values) {
      const c = parseFloat(v.close);
      if (!Number.isFinite(c) || !v.datetime) continue;
      dates.push(String(v.datetime).slice(0, 10));
      closes.push(c);
    }
    return { ticker, currency: payload?.meta?.currency, dates, closes };
  };

  if (isBatch) {
    for (const t of tickers) out.set(t, parseOne(t, json[t]));
  } else {
    out.set(tickers[0], parseOne(tickers[0], json));
  }
  return out;
}

/** Yahoo with two retries on transient errors, ramping backoff. */
async function fetchYahooWithRetry(ticker: string, range: string, interval: string): Promise<PriceSeries> {
  const attempt = (): Promise<PriceSeries> =>
    fetchYahooChart(ticker, range, interval).catch((e) => ({
      ticker, dates: [], closes: [], error: e?.message || "yahoo throw",
    } as PriceSeries));
  let r = await attempt();
  if (!r.error && r.dates.length) return r;
  await sleep(800 + Math.random() * 600);
  r = await attempt();
  if (!r.error && r.dates.length) return r;
  await sleep(1500 + Math.random() * 1000);
  return await attempt();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickersParam = searchParams.get("tickers") || "";
  const range = (searchParams.get("range") || "1mo").toLowerCase();
  const interval = (searchParams.get("interval") || "1d").toLowerCase();

  if (!ALLOWED_RANGES.has(range)) {
    return NextResponse.json({ error: `invalid range: ${range}` }, { status: 400 });
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json({ error: `invalid interval: ${interval}` }, { status: 400 });
  }

  const tickers = Array.from(
    new Set(tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)),
  ).slice(0, 60);
  if (tickers.length === 0) {
    return NextResponse.json({ error: "no tickers" }, { status: 400 });
  }

  // Phase 0: serve from baked JSON where possible (covers the canonical
  // watchlist). Zero upstream calls, zero rate-limit exposure.
  // Phase 1: in-memory cache for anything else previously fetched live.
  const series: PriceSeries[] = new Array(tickers.length);
  const needFetch: string[] = [];
  const indexByTicker = new Map<string, number>();
  let bakedHits = 0;
  tickers.forEach((t, i) => {
    indexByTicker.set(t, i);
    const baked = getBakedSlice(t, range, interval);
    if (baked) {
      series[i] = baked;
      bakedHits++;
      return;
    }
    const cached = getCached(priceCacheKey(t, range, interval));
    if (cached) {
      series[i] = cached;
    } else {
      needFetch.push(t);
    }
  });

  // Phase 2a: Stooq if configured (primary — generous limits, key required).
  // Then fall back to Yahoo (often 429s on Vercel IPs but works when cached).
  if (needFetch.length > 0) await primeYahooSession();
  const stooqEnabled = !!process.env.STOOQ_API_KEY;
  const primaryResults = await pmap(needFetch, MAX_CONCURRENCY, async (t, idx) => {
    if (idx > 0) await sleep(JITTER_MS + Math.random() * JITTER_MS);
    if (stooqEnabled) {
      const s = await fetchStooq(t, range, interval);
      if (!s.error && s.dates.length > 0) {
        setCached(priceCacheKey(t, range, interval), s);
        return s;
      }
    }
    const y = await fetchYahooWithRetry(t, range, interval);
    if (!y.error && y.dates.length > 0) {
      setCached(priceCacheKey(t, range, interval), y);
    }
    return y;
  });

  const stillFailing: string[] = [];
  primaryResults.forEach((r, i) => {
    const t = needFetch[i];
    const dst = indexByTicker.get(t)!;
    if (!r.error && r.dates.length > 0) {
      series[dst] = r;
    } else {
      stillFailing.push(t);
      series[dst] = r; // keep error in case the next fallback also fails
    }
  });

  // Phase 3: Twelve Data batch fallback (8 symbols per HTTP call to amortize the rate limit).
  if (stillFailing.length > 0 && process.env.TWELVEDATA_API_KEY) {
    for (let off = 0; off < stillFailing.length; off += 8) {
      const batch = stillFailing.slice(off, off + 8);
      const map = await fetchTwelveDataBatch(batch, range, interval);
      for (const t of batch) {
        const r = map.get(t) || { ticker: t, dates: [], closes: [], error: "TwelveData missing" };
        const dst = indexByTicker.get(t)!;
        if (!r.error && r.dates.length > 0) {
          series[dst] = r;
          setCached(priceCacheKey(t, range, interval), r);
        } else {
          const yahooErr = series[dst]?.error;
          series[dst] = { ...r, error: yahooErr || r.error };
        }
      }
    }
  }

  const body: PricesResponse = { range, series };
  const meta = bakedMeta();
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "X-Baked-Hits": `${bakedHits}/${tickers.length}`,
      ...(meta ? { "X-Baked-At": meta.baked_at } : {}),
    },
  });
}
