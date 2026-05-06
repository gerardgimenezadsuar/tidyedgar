"use client";

import type { Holding } from "@/lib/types";
import type { AlignedReturns } from "@/lib/returns";
import { formatPct, formatMoney } from "@/lib/returns";

type Props = {
  data: AlignedReturns | null;
  holdings: Holding[];
  benchmark?: string;
  benchmarkTotal?: number | null;
};

export function PortfolioStats({ data, holdings, benchmark, benchmarkTotal }: Props) {
  if (!data) return null;

  const totalWeight = holdings.reduce((acc, h) => acc + (Number(h.weight) || 0), 0) || 1;
  const excess =
    benchmarkTotal != null && Number.isFinite(benchmarkTotal)
      ? data.portfolioTotal - benchmarkTotal
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-edge bg-panel p-4 lg:col-span-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Period start" value={data.dates[0]} />
          <Stat label="Period end" value={data.dates[data.dates.length - 1]} />
          <Stat
            label="Portfolio return"
            value={formatPct(data.portfolioTotal)}
            tone={data.portfolioTotal >= 0 ? "pos" : "neg"}
            big
          />
          {benchmark && benchmarkTotal != null ? (
            <Stat
              label={`vs ${benchmark}`}
              value={excess != null ? formatPct(excess) : "—"}
              tone={(excess ?? 0) >= 0 ? "pos" : "neg"}
              big
            />
          ) : (
            <Stat label="Trading days" value={String(data.dates.length)} />
          )}
        </div>
      </div>

      <div className="rounded-xl border border-edge bg-panel p-4 lg:col-span-3 overflow-x-auto">
        <h3 className="text-sm font-semibold text-muted mb-3">Per-holding contribution</h3>
        <table className="w-full text-sm min-w-[560px]">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr className="text-left">
              <th className="py-2 pr-3 font-medium">Ticker</th>
              <th className="py-2 pr-3 font-medium text-right">Weight</th>
              <th className="py-2 pr-3 font-medium text-right">Start</th>
              <th className="py-2 pr-3 font-medium text-right">End</th>
              <th className="py-2 pr-3 font-medium text-right">Return</th>
              <th className="py-2 pr-3 font-medium text-right">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const t = data.totals[h.ticker];
              if (!t) {
                return (
                  <tr key={h.ticker} className="border-t border-edge">
                    <td className="py-2 pr-3 font-mono">{h.ticker || "—"}</td>
                    <td className="py-2 pr-3 text-right font-mono">{((h.weight / totalWeight) * 100).toFixed(1)}%</td>
                    <td colSpan={4} className="py-2 pr-3 text-right text-muted text-xs">no data</td>
                  </tr>
                );
              }
              const w = (h.weight || 0) / totalWeight;
              const contrib = t.totalReturn * w;
              return (
                <tr key={h.ticker} className="border-t border-edge">
                  <td className="py-2 pr-3 font-mono">{h.ticker}</td>
                  <td className="py-2 pr-3 text-right font-mono">{(w * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-3 text-right font-mono">{formatMoney(t.startPrice)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{formatMoney(t.endPrice)}</td>
                  <td className={`py-2 pr-3 text-right font-mono ${t.totalReturn >= 0 ? "text-pos" : "text-neg"}`}>
                    {formatPct(t.totalReturn)}
                  </td>
                  <td className={`py-2 pr-3 text-right font-mono font-semibold ${contrib >= 0 ? "text-pos" : "text-neg"}`}>
                    {formatPct(contrib)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-edge font-semibold">
              <td className="py-2 pr-3">PORTFOLIO</td>
              <td className="py-2 pr-3 text-right font-mono">100%</td>
              <td className="py-2 pr-3 text-right font-mono text-muted">{data.dates[0]}</td>
              <td className="py-2 pr-3 text-right font-mono text-muted">{data.dates[data.dates.length - 1]}</td>
              <td className={`py-2 pr-3 text-right font-mono ${data.portfolioTotal >= 0 ? "text-pos" : "text-neg"}`}>
                {formatPct(data.portfolioTotal)}
              </td>
              <td className={`py-2 pr-3 text-right font-mono ${data.portfolioTotal >= 0 ? "text-pos" : "text-neg"}`}>
                {formatPct(data.portfolioTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  big = false,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  big?: boolean;
}) {
  const color = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-white";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 font-mono ${big ? "text-xl sm:text-2xl font-semibold" : "text-sm"} ${color}`}>{value}</div>
    </div>
  );
}
