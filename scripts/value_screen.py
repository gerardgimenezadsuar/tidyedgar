"""Rank semiconductor-adjacent stocks by quality + peer-relative cheapness.

Takes the CSV from semiconductor_screen.py, joins live market data via
yfinance, applies a fundamentals quality filter, then z-scores valuation
within each SIC peer group. Output is sorted by a composite score where
the cheapest, highest-quality names rise to the top.

Caveats:
- "Cheap" here is P/Sales and P/E vs SIC peers. No EV (no debt data
  from EDGAR frames), no forward estimates, no FCF yield. Treat the
  output as a candidate list, not a buy list.
- yfinance scrapes Yahoo and is fragile; expect some tickers to come
  back with missing fields.

Usage:
    python value_screen.py --in semis.csv --out semis_ranked.csv
"""

from __future__ import annotations

import argparse
import sys
import time

import pandas as pd
import yfinance as yf


def latest_per_ticker(df: pd.DataFrame) -> pd.DataFrame:
    """Keep the most recent year per CIK that has revenue + net_income."""
    df = df.dropna(subset=["revenue", "net_income"])
    return df.sort_values("year").groupby("cik", as_index=False).tail(1)


def quality_pass(row: pd.Series, min_margin: float, min_cagr: float) -> bool:
    if pd.isna(row["net_margin"]) or row["net_margin"] < min_margin:
        return False
    if pd.isna(row["operating_margin"]) or row["operating_margin"] <= 0:
        return False
    if pd.isna(row.get("rev_cagr")) or row["rev_cagr"] < min_cagr:
        return False
    return True


def revenue_cagr(group: pd.DataFrame) -> float:
    g = group.dropna(subset=["revenue"]).sort_values("year")
    if len(g) < 2:
        return float("nan")
    first, last = g.iloc[0]["revenue"], g.iloc[-1]["revenue"]
    n = g.iloc[-1]["year"] - g.iloc[0]["year"]
    if first <= 0 or n <= 0:
        return float("nan")
    return (last / first) ** (1 / n) - 1


def fetch_market(tickers: list[str]) -> pd.DataFrame:
    rows = []
    for i, t in enumerate(tickers, 1):
        if not t:
            continue
        try:
            info = yf.Ticker(t).info or {}
        except Exception as e:
            print(f"  [{i}/{len(tickers)}] {t}: {e}", file=sys.stderr)
            continue
        rows.append({
            "ticker": t,
            "market_cap": info.get("marketCap"),
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "trailing_pe": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "price_to_sales_ttm": info.get("priceToSalesTrailing12Months"),
            "ev_to_revenue": info.get("enterpriseToRevenue"),
            "ev_to_ebitda": info.get("enterpriseToEbitda"),
        })
        if i % 25 == 0:
            print(f"  fetched market data for {i}/{len(tickers)}", file=sys.stderr)
        time.sleep(0.2)
    return pd.DataFrame(rows)


def zscore(s: pd.Series) -> pd.Series:
    if s.dropna().nunique() < 2:
        return pd.Series([float("nan")] * len(s), index=s.index)
    return (s - s.mean()) / s.std(ddof=0)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in", dest="inp", required=True, help="CSV from semiconductor_screen.py")
    ap.add_argument("--out", default="semis_ranked.csv")
    ap.add_argument("--min-margin", type=float, default=0.05, help="Min net margin (default 5%)")
    ap.add_argument("--min-cagr", type=float, default=0.05, help="Min revenue CAGR (default 5%)")
    ap.add_argument("--peer-min", type=int, default=4,
                    help="Minimum peers in a SIC to compute z-scores")
    args = ap.parse_args()

    fund = pd.read_csv(args.inp)
    if "ticker" not in fund.columns:
        print("Input CSV is missing a 'ticker' column.", file=sys.stderr)
        return 1

    cagr = (fund.groupby("cik").apply(revenue_cagr, include_groups=False)
                .rename("rev_cagr").reset_index())
    latest = latest_per_ticker(fund).merge(cagr, on="cik", how="left")
    latest = latest.dropna(subset=["ticker"])
    print(f"Latest-year rows with tickers: {len(latest)}", file=sys.stderr)

    # Quality screen first — cuts the yfinance request count.
    quality_mask = latest.apply(
        lambda r: quality_pass(r, args.min_margin, args.min_cagr), axis=1
    )
    survivors = latest[quality_mask].copy()
    print(f"Pass quality filter (margin>{args.min_margin}, CAGR>{args.min_cagr}): "
          f"{len(survivors)}", file=sys.stderr)
    if survivors.empty:
        print("Nothing passed the quality filter — try loosening --min-margin/--min-cagr.",
              file=sys.stderr)
        return 1

    print("Fetching market data from Yahoo...", file=sys.stderr)
    market = fetch_market(survivors["ticker"].tolist())
    merged = survivors.merge(market, on="ticker", how="left")

    # Fallback P/S from market_cap and trailing revenue if Yahoo's field is missing.
    merged["ps_calc"] = merged["market_cap"] / merged["revenue"]
    merged["pe_calc"] = merged["market_cap"] / merged["net_income"]
    merged["ps"] = merged["price_to_sales_ttm"].fillna(merged["ps_calc"])
    merged["pe"] = merged["trailing_pe"].fillna(merged["pe_calc"])

    # Peer-relative cheapness z-scores within SIC. Negative z = cheaper than peers.
    def per_sic(g: pd.DataFrame) -> pd.DataFrame:
        if len(g) < args.peer_min:
            g["ps_z"] = float("nan")
            g["pe_z"] = float("nan")
        else:
            g["ps_z"] = zscore(g["ps"])
            g["pe_z"] = zscore(g["pe"].where(g["pe"] > 0))
        return g

    merged = merged.groupby("sic", group_keys=False).apply(per_sic, include_groups=True)

    # Composite: cheapness (negative z is good) + quality (margin + growth).
    merged["quality_score"] = (
        merged["net_margin"].fillna(0) + merged["rev_cagr"].fillna(0)
    )
    merged["cheap_score"] = -(
        merged["ps_z"].fillna(0) + merged["pe_z"].fillna(0)
    ) / 2
    merged["composite"] = merged["cheap_score"] + merged["quality_score"]

    cols = [
        "ticker", "entityName", "sic", "year",
        "revenue", "net_income", "gross_margin", "operating_margin", "net_margin",
        "rev_cagr",
        "market_cap", "price", "ps", "pe", "ev_to_revenue", "ev_to_ebitda",
        "ps_z", "pe_z", "quality_score", "cheap_score", "composite",
    ]
    out = merged[cols].sort_values("composite", ascending=False)
    out.to_csv(args.out, index=False)

    print(f"Wrote {len(out)} ranked rows -> {args.out}", file=sys.stderr)
    print("\nTop 15 by composite score:", file=sys.stderr)
    show = out.head(15)[["ticker", "entityName", "sic", "ps", "pe",
                         "net_margin", "rev_cagr", "composite"]]
    print(show.to_string(index=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
