"use client";

import { useMemo } from "react";
import type { Holding } from "@/lib/types";

type Props = {
  holdings: Holding[];
  onChange: (h: Holding[]) => void;
  benchmark: string;
  onBenchmarkChange: (b: string) => void;
};

// Common reference indices/ETFs surfaced as one-tap chips. Using ETFs
// (not index symbols like ^GSPC / ^IXIC) so the same string works across
// every price provider — Yahoo, Twelve Data, etc.
const BENCHMARK_CHIPS: { label: string; ticker: string; hint: string }[] = [
  { label: "S&P 500", ticker: "SPY", hint: "SPY" },
  { label: "Nasdaq 100", ticker: "QQQ", hint: "QQQ" },
  { label: "Semis", ticker: "SMH", hint: "SMH" },
  { label: "Russell 2k", ticker: "IWM", hint: "IWM" },
];

export function PortfolioBuilder({ holdings, onChange, benchmark, onBenchmarkChange }: Props) {
  const total = useMemo(
    () => holdings.reduce((acc, h) => acc + (Number(h.weight) || 0), 0),
    [holdings],
  );

  const update = (i: number, patch: Partial<Holding>) => {
    const next = holdings.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const remove = (i: number) => {
    const next = holdings.slice();
    next.splice(i, 1);
    onChange(next);
  };

  const add = () => onChange([...holdings, { ticker: "", weight: 0 }]);

  const equalWeight = () => {
    const n = holdings.length || 1;
    onChange(holdings.map((h) => ({ ...h, weight: 1 / n })));
  };

  const normalize = () => {
    if (total === 0) return;
    onChange(holdings.map((h) => ({ ...h, weight: (Number(h.weight) || 0) / total })));
  };

  const weightTone =
    total > 1.005 || total < 0.995 ? "text-yellow-400" : "text-pos";

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Holdings</h3>
        <span className={`text-[11px] font-mono ${weightTone}`}>
          {(total * 100).toFixed(1)}%
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={equalWeight}
          className="flex-1 px-2 py-1.5 rounded text-xs bg-panel2 hover:bg-edge text-muted hover:text-white transition whitespace-nowrap"
        >
          Equal weight
        </button>
        <button
          onClick={normalize}
          className="flex-1 px-2 py-1.5 rounded text-xs bg-panel2 hover:bg-edge text-muted hover:text-white transition whitespace-nowrap"
        >
          Normalize
        </button>
        <button
          onClick={add}
          className="px-3 py-1.5 rounded text-xs bg-accent/20 text-accent hover:bg-accent/30 transition whitespace-nowrap"
          aria-label="Add holding"
        >
          + Add
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_88px_28px] gap-2 mb-1.5 px-1 text-[10px] uppercase tracking-wider text-muted">
        <div>Ticker</div>
        <div className="text-right">Weight %</div>
        <div></div>
      </div>

      {/* Rows */}
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
        {holdings.map((h, i) => {
          const pct = Number.isFinite(h.weight) ? h.weight * 100 : 0;
          return (
            <div key={i} className="grid grid-cols-[1fr_88px_28px] gap-2 items-center">
              <input
                type="text"
                value={h.ticker}
                onChange={(e) => update(i, { ticker: e.target.value.toUpperCase() })}
                placeholder="AVGO"
                spellCheck={false}
                autoCapitalize="characters"
                className="bg-panel2 border border-edge rounded px-2 py-1.5 text-sm font-mono uppercase focus:outline-none focus:border-accent min-w-0"
              />
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="100"
                value={pct ? +pct.toFixed(2) : ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  update(i, { weight: Number.isFinite(v) ? v / 100 : 0 });
                }}
                placeholder="0"
                className="bg-panel2 border border-edge rounded px-2 py-1.5 text-sm font-mono text-right focus:outline-none focus:border-accent min-w-0"
              />
              <button
                onClick={() => remove(i)}
                className="text-muted hover:text-neg text-base leading-none flex items-center justify-center"
                aria-label="Remove"
                title="Remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Benchmark */}
      <div className="mt-4 pt-4 border-t border-edge">
        <label className="text-[11px] uppercase tracking-wider text-muted">Benchmark</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
          {BENCHMARK_CHIPS.map((c) => {
            const active = benchmark.toUpperCase() === c.ticker;
            return (
              <button
                key={c.ticker}
                onClick={() => onBenchmarkChange(c.ticker)}
                title={`${c.label} (${c.ticker})`}
                className={`px-2 py-1 text-[11px] rounded border transition whitespace-nowrap ${
                  active
                    ? "bg-accent2/20 border-accent2 text-accent2"
                    : "bg-panel2 border-edge text-muted hover:text-white hover:border-edge"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={benchmark}
          onChange={(e) => onBenchmarkChange(e.target.value.toUpperCase())}
          placeholder="SPY, QQQ, SMH..."
          spellCheck={false}
          autoCapitalize="characters"
          className="w-full bg-panel2 border border-edge rounded px-2 py-1.5 text-sm font-mono uppercase focus:outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
