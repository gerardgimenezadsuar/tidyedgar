import type { Holding, PriceSeries } from "./types";

export type AlignedReturns = {
  dates: string[];
  // For each ticker: cumulative return series aligned to `dates`.
  byTicker: Record<string, number[]>;
  // Portfolio cumulative return, weight-applied.
  portfolio: number[];
  // Per-ticker total return (last vs first available aligned point).
  totals: Record<string, { totalReturn: number; startPrice: number; endPrice: number; startDate: string; endDate: string }>;
  portfolioTotal: number;
};

/**
 * Align all series on a common date axis (the intersection of dates that
 * exist for every ticker), then compute cumulative returns from the first
 * common date and a weighted portfolio cumulative return.
 *
 * Why intersection: if one ticker has a missing day (holiday/halt), using
 * a forward-fill on that day would understate volatility on that day for
 * the others. Intersection keeps the portfolio comparable day-by-day.
 */
export function alignAndCompute(
  series: PriceSeries[],
  holdings: Holding[],
): AlignedReturns | null {
  const usable = series.filter((s) => s.dates.length > 1 && !s.error);
  if (usable.length === 0) return null;

  // Intersection of date sets.
  const dateSets = usable.map((s) => new Set(s.dates));
  const commonDates = usable[0].dates.filter((d) => dateSets.every((set) => set.has(d)));
  if (commonDates.length < 2) return null;

  // Build price-by-date lookup per ticker.
  const priceByDate: Record<string, Record<string, number>> = {};
  for (const s of usable) {
    const map: Record<string, number> = {};
    for (let i = 0; i < s.dates.length; i++) map[s.dates[i]] = s.closes[i];
    priceByDate[s.ticker] = map;
  }

  const baseDate = commonDates[0];
  const byTicker: Record<string, number[]> = {};
  const totals: AlignedReturns["totals"] = {};

  for (const s of usable) {
    const base = priceByDate[s.ticker][baseDate];
    const series: number[] = [];
    for (const d of commonDates) {
      const px = priceByDate[s.ticker][d];
      series.push(px / base - 1);
    }
    byTicker[s.ticker] = series;
    totals[s.ticker] = {
      totalReturn: series[series.length - 1],
      startPrice: priceByDate[s.ticker][commonDates[0]],
      endPrice: priceByDate[s.ticker][commonDates[commonDates.length - 1]],
      startDate: commonDates[0],
      endDate: commonDates[commonDates.length - 1],
    };
  }

  // Portfolio = sum_i w_i * (P_i,t / P_i,0). Cum return = sum - 1.
  const totalWeight = holdings.reduce((acc, h) => acc + (h.weight || 0), 0) || 1;
  const portfolio = commonDates.map((_, idx) => {
    let val = 0;
    for (const h of holdings) {
      const w = (h.weight || 0) / totalWeight;
      const series = byTicker[h.ticker];
      if (!series) continue;
      val += w * (series[idx] + 1);
    }
    return val - 1;
  });

  const portfolioTotal = portfolio[portfolio.length - 1] ?? 0;
  return {
    dates: commonDates,
    byTicker,
    portfolio,
    totals,
    portfolioTotal,
  };
}

export function formatPct(x: number | null | undefined, decimals = 2): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const sign = x >= 0 ? "+" : "";
  return `${sign}${(x * 100).toFixed(decimals)}%`;
}

export function formatMoney(x: number | null | undefined, decimals = 2): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `$${x.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
