import type { Portfolio } from "./types";

// 3-pick thesis portfolio: knowledge-worker inference x20 thesis.
export const FOCUS_PORTFOLIO: Portfolio = {
  id: "focus3",
  name: "Focus 3 — Inference Thesis",
  description:
    "AVGO (custom inference ASICs), MU (HBM supply tightness), COHR (optical interconnect for disaggregated inference).",
  benchmark: "SMH",
  holdings: [
    { ticker: "AVGO", weight: 0.40 },
    { ticker: "MU", weight: 0.35 },
    { ticker: "COHR", weight: 0.25 },
  ],
};

// 45-name watchlist (equal weighted, can rebalance in UI).
const WATCHLIST_TICKERS = [
  "NVDA", "AMD", "INTC", "AVGO", "QCOM", "MRVL", "TXN", "ADI", "ON", "MCHP",
  "MPWR", "SWKS", "QRVO", "LSCC", "RMBS", "MU", "WDC", "STX", "AMAT", "LRCX",
  "KLAC", "TER", "ACMR", "ONTO", "COHR", "VECO", "ASML", "SNPS", "CDNS", "ARM",
  "NXPI", "STM", "TSM", "UMC", "WOLF", "MXL", "SITM", "POWI", "AEHR", "FN",
  "VRT", "ALAB", "CRDO", "CAMT", "ASX",
];

export const WATCHLIST_PORTFOLIO: Portfolio = {
  id: "watch45",
  name: "Watchlist 45 — Equal Weighted",
  description: "Curated semi universe: designers, IDMs, foundries, equipment, memory, EDA, photonics. Equal weights.",
  benchmark: "SMH",
  holdings: WATCHLIST_TICKERS.map((t) => ({
    ticker: t,
    weight: 1 / WATCHLIST_TICKERS.length,
  })),
};

export const DEFAULT_PORTFOLIOS: Portfolio[] = [FOCUS_PORTFOLIO, WATCHLIST_PORTFOLIO];

export const RANGE_OPTIONS = [
  { id: "5d", label: "5D", yahoo: "5d", interval: "1d" },
  { id: "1mo", label: "1M", yahoo: "1mo", interval: "1d" },
  { id: "3mo", label: "3M", yahoo: "3mo", interval: "1d" },
  { id: "6mo", label: "6M", yahoo: "6mo", interval: "1d" },
  { id: "ytd", label: "YTD", yahoo: "ytd", interval: "1d" },
  { id: "1y", label: "1Y", yahoo: "1y", interval: "1d" },
  { id: "2y", label: "2Y", yahoo: "2y", interval: "1wk" },
  { id: "5y", label: "5Y", yahoo: "5y", interval: "1wk" },
];
