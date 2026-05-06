"""Bake daily prices for the canonical watchlist into a static JSON.

The web app's `/api/prices` route reads this file first, so the standard
portfolios (Focus 3 + Watchlist 45) load instantly without hitting any
upstream API. Only ad-hoc tickers the user types in trigger live fetches.

Run it weekly from your local machine (Yahoo doesn't throttle home IPs
the way it throttles Vercel), then commit + push:

    python scripts/bake_prices.py
    git add web/public/prices_baked.json
    git commit -m "weekly price bake"
    git push     # Vercel auto-redeploys

Output JSON shape matches lib/types.ts:
    {
      "baked_at": "2026-05-06T08:32:00Z",
      "range": "5y",
      "interval": "1d",
      "series": {
        "AVGO": { "ticker": "AVGO", "currency": "USD",
                  "dates": ["2021-05-07", ...], "closes": [...] },
        ...
      }
    }
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

# Matches web/lib/portfolios.ts WATCHLIST_TICKERS + the benchmark chips.
TICKERS = [
    # Watchlist 45
    "NVDA", "AMD", "INTC", "AVGO", "QCOM", "MRVL", "TXN", "ADI", "ON", "MCHP",
    "MPWR", "SWKS", "QRVO", "LSCC", "RMBS", "MU", "WDC", "STX", "AMAT", "LRCX",
    "KLAC", "TER", "ACMR", "ONTO", "COHR", "VECO", "ASML", "SNPS", "CDNS", "ARM",
    "NXPI", "STM", "TSM", "UMC", "WOLF", "MXL", "SITM", "POWI", "AEHR", "FN",
    "VRT", "ALAB", "CRDO", "CAMT", "ASX",
    # Benchmark chips (BENCHMARK_CHIPS in PortfolioBuilder.tsx)
    "SPY", "QQQ", "SMH", "IWM",
]

OUT_PATH = Path(__file__).resolve().parent.parent / "web" / "lib" / "data" / "prices_baked.json"
PERIOD = "5y"  # 5y daily covers every range option in the UI up to 5y.


def load_existing() -> dict[str, dict]:
    """Return existing series map, or {} if no bake exists yet."""
    if not OUT_PATH.exists():
        return {}
    try:
        return json.loads(OUT_PATH.read_text()).get("series", {})
    except Exception as e:
        print(f"Warn: couldn't parse existing bake ({e}); starting fresh", file=sys.stderr)
        return {}


def main() -> int:
    print(f"Baking {len(TICKERS)} tickers, period={PERIOD} ...", file=sys.stderr)
    existing = load_existing()

    # Single batched download. yfinance returns a multi-index DataFrame
    # with columns (Field, Ticker). auto_adjust=True so closes match
    # Yahoo's adjclose values the live route serves.
    raw = yf.download(
        TICKERS, period=PERIOD, interval="1d",
        auto_adjust=True, progress=False, group_by="ticker", threads=True,
    )

    series_map: dict[str, dict] = {}
    fresh: list[str] = []
    stale: list[str] = []
    missing: list[str] = []
    for tkr in TICKERS:
        try:
            close_col = raw[tkr]["Close"].dropna()
        except KeyError:
            close_col = None
        if close_col is None or len(close_col) == 0:
            # Fall back to whatever we had last time — don't drop the ticker.
            if tkr in existing and existing[tkr].get("dates"):
                series_map[tkr] = existing[tkr]
                stale.append(tkr)
            else:
                missing.append(tkr)
            continue
        series_map[tkr] = {
            "ticker": tkr,
            "currency": "USD",
            "dates": [d.strftime("%Y-%m-%d") for d in close_col.index],
            "closes": [round(float(v), 4) for v in close_col.values],
        }
        fresh.append(tkr)

    # Refuse to write if nothing new — better to keep the existing file
    # intact than overwrite a working bake with empty data.
    if not fresh:
        print("ERROR: zero tickers fetched — leaving existing bake untouched", file=sys.stderr)
        return 2

    out = {
        "baked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "range": PERIOD,
        "interval": "1d",
        "series": series_map,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(
        f"Wrote {len(series_map)}/{len(TICKERS)} tickers → {OUT_PATH} ({size_kb:.0f} KB) "
        f"[fresh={len(fresh)} stale={len(stale)} missing={len(missing)}]",
        file=sys.stderr,
    )
    if stale:
        print(f"Stale (kept last bake): {', '.join(stale)}", file=sys.stderr)
    if missing:
        print(f"Missing entirely: {', '.join(missing)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
