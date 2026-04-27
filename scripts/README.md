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
