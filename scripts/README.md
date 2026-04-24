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
