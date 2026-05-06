// In-process price cache, keyed by `ticker|range|interval`.
//
// Survives only within a warm Vercel instance, but that's enough to make
// repeat loads of the same portfolio nearly free. Cold-start loads still
// hit the upstream once.
//
// TTL strategy: today's intraday bar moves, but yesterday's close doesn't.
// We cache for 5 min for the most recent bar; downstream code should treat
// historical-only requests as long-lived since they never change.

import type { PriceSeries } from "./types";

type Entry = { value: PriceSeries; expires: number };

const store = new Map<string, Entry>();
const MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function priceCacheKey(ticker: string, range: string, interval: string): string {
  return `${ticker.toUpperCase()}|${range}|${interval}`;
}

export function getCached(key: string): PriceSeries | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    store.delete(key);
    return null;
  }
  return e.value;
}

export function setCached(key: string, value: PriceSeries, ttlMs = DEFAULT_TTL_MS): void {
  // Don't cache empty/error responses — let the next request retry upstream.
  if (!value.dates.length || value.error) return;
  if (store.size >= MAX_ENTRIES) {
    // Drop the oldest entry by insertion order. Map preserves it.
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
}
