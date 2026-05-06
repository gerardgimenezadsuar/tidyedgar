// Yahoo Finance unofficial chart endpoint with cookie + crumb handshake.
//
// Yahoo has had anti-scraping in front of `query1.finance.yahoo.com/v8/...`
// since ~2023. Without a session cookie + the matching `crumb` token, you
// get a 401/429. yfinance does this dance too.
//
// Flow:
//   1. GET https://fc.yahoo.com/ to receive A1/A3 cookies (no crumb here).
//   2. GET https://query2.finance.yahoo.com/v1/test/getcrumb with those
//      cookies → returns the crumb string in the body.
//   3. Use both Cookie header + ?crumb=... on chart requests.
//
// The session is good for hours, so we cache it module-globally. In a
// Vercel serverless cold start it's recreated; warm invocations reuse.

import type { PriceSeries } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let cachedCookie: string | null = null;
let cachedCrumb: string | null = null;
let cachedAt = 0;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

async function refreshSession(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    const consent = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "manual",
    });
    // Node fetch exposes raw set-cookie via headers.getSetCookie() (Node 20+)
    // or via headers.raw()['set-cookie']. We use `getSetCookie` first.
    let setCookies: string[] = [];
    const anyHeaders = consent.headers as any;
    if (typeof anyHeaders.getSetCookie === "function") {
      setCookies = anyHeaders.getSetCookie();
    } else if (typeof anyHeaders.raw === "function") {
      setCookies = anyHeaders.raw()["set-cookie"] || [];
    } else {
      const single = consent.headers.get("set-cookie");
      if (single) setCookies = [single];
    }
    const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    if (!cookie) return null;

    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": UA,
        Cookie: cookie,
        Accept: "text/plain",
      },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length < 4) return null;
    return { cookie, crumb };
  } catch {
    return null;
  }
}

async function getSession(): Promise<{ cookie: string; crumb: string } | null> {
  if (cachedCookie && cachedCrumb && Date.now() - cachedAt < SESSION_TTL_MS) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }
  const fresh = await refreshSession();
  if (!fresh) return null;
  cachedCookie = fresh.cookie;
  cachedCrumb = fresh.crumb;
  cachedAt = Date.now();
  return fresh;
}

/** Force-prime the cookie+crumb session so callers don't all race for it. */
export async function primeYahooSession(): Promise<boolean> {
  return (await getSession()) !== null;
}

export async function fetchYahooChart(
  ticker: string,
  range: string,
  interval: string,
): Promise<PriceSeries> {
  // First, try without session (works from clean IPs and gets cached).
  const tryFetch = async (session: { cookie: string; crumb: string } | null) => {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
      `?interval=${interval}&range=${range}&includePrePost=false&events=div%2Csplit` +
      (session ? `&crumb=${encodeURIComponent(session.crumb)}` : "");
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        ...(session ? { Cookie: session.cookie } : {}),
      },
      next: { revalidate: 300 },
    });
    return res;
  };

  // Always send the session cookie+crumb if we have one — Yahoo throttles
  // anonymous IPs much more aggressively than session-bearing requests.
  const session = await getSession();
  let res = await tryFetch(session);
  if (res.status === 401 || res.status === 429 || !res.ok) {
    cachedCookie = null;
    cachedCrumb = null;
    const fresh = await getSession();
    if (fresh) res = await tryFetch(fresh);
  }

  if (!res.ok) {
    return { ticker, dates: [], closes: [], error: `Yahoo HTTP ${res.status}` };
  }
  const json = (await res.json()) as any;
  const result = json?.chart?.result?.[0];
  if (!result) {
    const errMsg = json?.chart?.error?.description || "no data";
    return { ticker, dates: [], closes: [], error: errMsg };
  }
  const ts: number[] = result.timestamp || [];
  const adj = result.indicators?.adjclose?.[0]?.adjclose as (number | null)[] | undefined;
  const close = result.indicators?.quote?.[0]?.close as (number | null)[] | undefined;
  const px = adj ?? close ?? [];
  const dates: string[] = [];
  const closes: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    const v = px[i];
    if (v == null || !Number.isFinite(v)) continue;
    dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
    closes.push(v);
  }
  const currency = result.meta?.currency as string | undefined;
  return { ticker, currency, dates, closes };
}
