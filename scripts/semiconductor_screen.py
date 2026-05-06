"""Screen semiconductor-industry fundamentals from SEC EDGAR, write CSV.

Port of the tidyedgar R workflow (get_ydata + prepare_data) with an added
SIC-code filter. Pulls the SEC XBRL "frames" endpoint per (tag, year),
keeps only companies whose SIC falls in the semiconductor cluster, then
pivots and computes margins + YoY changes.

Usage:
    python semiconductor_screen.py --email you@example.com \
        --years 2020-2024 --out semis.csv

The --email value goes into the User-Agent header — SEC requires a real
contact. The CIK -> SIC map is cached to ~/.cache/sec_sic.json so only
the first run is slow.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import pandas as pd
import requests

SEMI_SIC_CODES = {"3674", "3559", "3827"}

REVENUE_TAGS = [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueGoodsNet",
    "SalesRevenueNet",
]
NET_INCOME_TAGS = ["NetIncomeLoss", "ProfitLoss"]
OTHER_TAGS = ["OperatingIncomeLoss", "GrossProfit"]

CANONICAL = {t: "Revenues" for t in REVENUE_TAGS}
CANONICAL.update({t: "NetIncomeLoss" for t in NET_INCOME_TAGS})
CANONICAL.update({t: t for t in OTHER_TAGS})


def parse_years(spec: str) -> list[int]:
    if "-" in spec:
        a, b = spec.split("-", 1)
        return list(range(int(a), int(b) + 1))
    return [int(x) for x in spec.split(",")]


def build_sic_map(session: requests.Session, cache: Path) -> dict[int, dict]:
    """CIK -> {name, sic, ticker}. Cached to disk (10k+ requests on cold run)."""
    if cache.exists():
        return {int(k): v for k, v in json.loads(cache.read_text()).items()}

    cache.parent.mkdir(parents=True, exist_ok=True)
    tickers = session.get(
        "https://www.sec.gov/files/company_tickers.json", timeout=30
    ).json()

    out: dict[int, dict] = {}
    total = len(tickers)
    for i, row in enumerate(tickers.values(), 1):
        cik = int(row["cik_str"])
        try:
            sub = session.get(
                f"https://data.sec.gov/submissions/CIK{cik:010d}.json", timeout=20
            ).json()
        except Exception as e:
            print(f"  [{i}/{total}] CIK {cik}: {e}", file=sys.stderr)
            continue
        out[cik] = {
            "name": sub.get("name", row["title"]),
            "sic": str(sub.get("sic") or ""),
            "ticker": row.get("ticker"),
        }
        if i % 500 == 0:
            print(f"  resolved {i}/{total} SIC codes", file=sys.stderr)
            cache.write_text(json.dumps(out))
        time.sleep(0.11)  # SEC fair-use: <10 req/s

    cache.write_text(json.dumps(out))
    return out


def fetch_frame(session: requests.Session, tag: str, year: int, unit: str = "USD"):
    url = (
        f"https://data.sec.gov/api/xbrl/frames/us-gaap/{tag}/{unit}/CY{year}.json"
    )
    r = session.get(url, timeout=30)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    js = r.json()
    df = pd.DataFrame(js["data"])
    df["year"] = year
    df["tag"] = tag
    df["canon"] = CANONICAL[tag]
    return df


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--email", required=True, help="Contact email for SEC User-Agent")
    ap.add_argument("--years", default="2020-2024", help="e.g. 2020-2024 or 2020,2022")
    ap.add_argument("--out", default="semiconductor_fundamentals.csv")
    ap.add_argument(
        "--sic-cache",
        default=str(Path.home() / ".cache" / "sec_sic.json"),
        help="Path to cache CIK->SIC lookup",
    )
    ap.add_argument(
        "--sic",
        default=",".join(sorted(SEMI_SIC_CODES)),
        help="Comma-separated SIC codes to keep",
    )
    args = ap.parse_args()

    years = parse_years(args.years)
    sic_codes = set(args.sic.split(","))

    session = requests.Session()
    session.headers.update(
        {"User-Agent": f"tidyedgar-screen {args.email}", "Accept-Encoding": "gzip"}
    )

    print(f"Building SIC map (cache: {args.sic_cache})", file=sys.stderr)
    sic_map = build_sic_map(session, Path(args.sic_cache))
    semi_ciks = {c for c, v in sic_map.items() if v["sic"] in sic_codes}
    print(f"  {len(semi_ciks)} companies match SIC {sorted(sic_codes)}", file=sys.stderr)

    frames = []
    all_tags = REVENUE_TAGS + NET_INCOME_TAGS + OTHER_TAGS
    for tag in all_tags:
        for y in years:
            df = fetch_frame(session, tag, y)
            if df is None:
                print(f"  no frame for {tag} CY{y}", file=sys.stderr)
                continue
            df = df[df["cik"].isin(semi_ciks)]
            print(f"  {tag} CY{y}: {len(df)} semi rows", file=sys.stderr)
            frames.append(df)
            time.sleep(0.11)

    if not frames:
        print("No data retrieved.", file=sys.stderr)
        return 1

    raw = pd.concat(frames, ignore_index=True)
    # Collapse synonymous revenue / net-income tags by taking max per (cik, year, canon).
    collapsed = (
        raw.groupby(["cik", "entityName", "year", "canon"], as_index=False)["val"].max()
    )
    wide = collapsed.pivot_table(
        index=["cik", "entityName", "year"],
        columns="canon",
        values="val",
        aggfunc="max",
    ).reset_index()

    for col in ["Revenues", "NetIncomeLoss", "OperatingIncomeLoss", "GrossProfit"]:
        if col not in wide.columns:
            wide[col] = pd.NA

    wide = wide.rename(
        columns={"Revenues": "revenue", "NetIncomeLoss": "net_income"}
    )
    wide["ticker"] = wide["cik"].map(lambda c: sic_map.get(int(c), {}).get("ticker"))
    wide["sic"] = wide["cik"].map(lambda c: sic_map.get(int(c), {}).get("sic"))

    wide["gross_margin"] = wide["GrossProfit"] / wide["revenue"]
    wide["operating_margin"] = wide["OperatingIncomeLoss"] / wide["revenue"]
    wide["net_margin"] = wide["net_income"] / wide["revenue"]

    wide = wide.sort_values(["entityName", "year"])
    wide["change_R"] = wide.groupby("cik")["revenue"].pct_change()
    wide["change_NI"] = wide.groupby("cik")["net_income"].pct_change()
    wide["change_OI"] = wide.groupby("cik")["OperatingIncomeLoss"].pct_change()

    cols = [
        "cik", "ticker", "entityName", "sic", "year",
        "revenue", "GrossProfit", "OperatingIncomeLoss", "net_income",
        "gross_margin", "operating_margin", "net_margin",
        "change_R", "change_OI", "change_NI",
    ]
    wide[cols].to_csv(args.out, index=False)
    print(f"Wrote {len(wide)} rows -> {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
