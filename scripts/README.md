# scripts/

Python port of the tidyedgar workflow for ad-hoc screening.

## semiconductor_screen.py

Pulls the SEC XBRL frames API for Revenues / NetIncomeLoss /
OperatingIncomeLoss / GrossProfit across a year range, filters to
semiconductor SIC codes (3674, 3559, 3827), pivots, and writes a CSV
with margins and year-over-year changes.

### Requirements

```
pip install pandas requests
```

### Run

```
python scripts/semiconductor_screen.py \
    --email you@example.com \
    --years 2020-2024 \
    --out semis.csv
```

The first run builds a CIK -> SIC map (~10k HTTP requests, ~20 minutes
at the SEC rate limit). It is cached to `~/.cache/sec_sic.json`;
subsequent runs complete in under a minute.

### Flags

- `--email` contact for the SEC User-Agent header (required by SEC).
- `--years` `2020-2024` range, or `2020,2022,2023` list.
- `--sic` override SIC codes (default covers semis + semi equipment).
- `--sic-cache` path to the CIK->SIC cache file.
- `--out` output CSV path.

## value_screen.py

Takes the CSV from `semiconductor_screen.py`, joins live market data
from Yahoo via `yfinance`, applies a fundamentals quality filter
(positive operating margin, minimum net margin, minimum revenue CAGR),
then z-scores P/Sales and P/E within each SIC peer group. Output is
sorted by a composite of cheapness vs peers + quality.

Treat the result as a candidate list, not a buy list. There is no EV
(no debt data from EDGAR frames), no FCF, no forward estimates.

### Requirements

```
pip install pandas yfinance
```

### Run

```
python scripts/value_screen.py --in semis.csv --out semis_ranked.csv
```

### Flags

- `--in` input CSV (output of `semiconductor_screen.py`).
- `--out` output CSV path.
- `--min-margin` minimum trailing net margin (default 0.05).
- `--min-cagr` minimum revenue CAGR over the input window (default 0.05).
- `--peer-min` minimum peers per SIC to compute z-scores (default 4).

## semi_watchlist.py

Deep-fundamentals puller for a curated watchlist of semiconductor
companies. Use this when you want **detail** on specific names (NVDA, AMD,
ASML, Micron, TSMC, ...) rather than a broad SIC-filtered screen.

### Why a separate script

The `frames` endpoint used by `semiconductor_screen.py` only returns
calendar-year filers. That misses NVIDIA (Jan year-end), Micron (Aug),
Broadcom (Oct/Nov), and foreign filers like ASML (20-F, EUR). This script
hits the per-company `companyconcept` endpoint instead, so off-cycle
fiscal years show up correctly and EUR/GBP/JPY/TWD values are accepted
(with a `currency` column per row).

### Run

```
python scripts/semi_watchlist.py \
    --email you@example.com \
    --years 2018-2025 \
    --out semis.csv
```

Runs in ~2 minutes (one batch of ~25 requests per ticker × 40 tickers,
throttled to <10 req/s per SEC rules).

### Flags

- `--email` contact for SEC User-Agent header (required by SEC).
- `--years` `2018-2025` range, or `2020,2022,2023` list.
- `--tickers` comma-separated override. Default is a curated list of
  ~40 names covering designers, IDMs, foundries, memory, equipment,
  EDA/IP, and foreign filers.
- `--out` output CSV path.

### Columns

Income statement: `revenue`, `cost_of_revenue`, `gross_profit`,
`rd_expense`, `sga_expense`, `operating_income`, `interest_expense`,
`tax_expense`, `net_income`.

Balance sheet: `assets`, `current_assets`, `cash`, `inventory`, `ppe_net`,
`liabilities`, `long_term_debt`, `equity`.

Cash flow: `cfo`, `capex`, `fcf`, `depreciation`, `buybacks`,
`dividends_paid`.

Per-share: `eps_basic`, `eps_diluted`, `shares_basic`, `shares_diluted`.

Derived: `gross_margin`, `operating_margin`, `net_margin`, `rd_intensity`,
`capex_intensity`, `fcf_margin`, `roa`, `roe`, `debt_to_equity`,
`asset_turnover`, `cash_to_assets`, `inventory_days`,
`revenue_yoy`, `op_income_yoy`, `net_income_yoy`, `rd_yoy`.

### Caveats

- Reporting currency varies (USD for most, EUR for ASML/NXPI/STM/IFNNY,
  GBP for ARM). Margins and ratios are currency-free, but raw dollar-like
  values are in the company's reporting currency. Check the `currency`
  column before cross-company dollar comparisons.
- Fiscal-year label follows the `end` date of the filing (e.g. NVDA's
  fiscal year ending Jan 30, 2022 is labeled `year=2022`, matching NVDA's
  own "FY22" convention).
- For companies filing 20-F with IFRS (ASML etc.), a handful of line
  items may be absent — IFRS and us-gaap taxonomies don't map 1:1.

## semi_watchlist_quarterly.py

Quarterly companion to `semi_watchlist.py`. Reuses the same concept
catalog but unpacks each fiscal year into four quarters.

### How it handles Q4

SEC XBRL does not tag Q4 directly — `fp` only takes `Q1`, `Q2`, `Q3`, or
`FY`. Q4 is the standard reconstruction: `FY − Q1 − Q2 − Q3`. If any of
those three quarters are missing for a given fiscal year, Q4 for duration
fields (revenue, income, etc.) is left blank; balance-sheet instants at
the quarter-end date are still attached.

### Run

```
python scripts/semi_watchlist_quarterly.py \
    --email you@example.com \
    --years 2020-2025 \
    --out semis_q.csv
```

### Output

One row per (ticker, fiscal_year, fiscal_quarter). Fiscal quarters are
labeled relative to the filer's own fiscal year (NVDA Q1 = Feb–Apr, MU
Q1 = Sep–Nov). A `calendar_quarter` column (e.g. `2024Q2`) lets you
compare cross-company on the comparable calendar window.

Adds `revenue_qoq`, `op_income_qoq`, and same-quarter-prior-year
`revenue_yoy`, `op_income_yoy`, `net_income_yoy`, `rd_yoy`.

### Caveats

- Foreign filers (ASML, NXPI, STM, ARM, TSM, STM) typically file 20-F
  annually and 6-K half-yearly — **no true quarterly data**. These
  tickers will appear with sparse/empty rows. Use `semi_watchlist.py`
  for those.
- The Q4 residual fails if any one of Q1/Q2/Q3 is missing for that
  fiscal year. Rare in modern filings.

## bake_prices.py

Pre-fetches daily prices for the canonical 49-ticker watchlist (45
semis + SPY/QQQ/SMH/IWM benchmark chips) via yfinance and writes them
to `web/lib/data/prices_baked.json`. The web app's `/api/prices` route
reads this file first, so the standard portfolios load instantly with
zero upstream API calls.

Refreshed automatically every Monday by the `bake-prices.yml` GitHub
Actions workflow. To run manually:

```
pip install pandas yfinance
python scripts/bake_prices.py
git add web/lib/data/prices_baked.json
git commit -m "manual price bake"
git push
```

The script is fault-tolerant: if yfinance is partially throttled, it
keeps the previous bake's data for failed tickers instead of overwriting
with empty.
