"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PORTFOLIOS, RANGE_OPTIONS } from "@/lib/portfolios";
import type { Holding, PricesResponse } from "@/lib/types";
import { alignAndCompute, formatPct } from "@/lib/returns";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import { PerformanceChart } from "@/components/PerformanceChart";
import { PortfolioStats } from "@/components/PortfolioStats";

export default function Home() {
  const [activeId, setActiveId] = useState<string>(DEFAULT_PORTFOLIOS[0].id);
  const [holdingsById, setHoldingsById] = useState<Record<string, Holding[]>>(() =>
    Object.fromEntries(DEFAULT_PORTFOLIOS.map((p) => [p.id, p.holdings.map((h) => ({ ...h }))])),
  );
  const [benchmarkById, setBenchmarkById] = useState<Record<string, string>>(() =>
    Object.fromEntries(DEFAULT_PORTFOLIOS.map((p) => [p.id, p.benchmark || "SMH"])),
  );
  const [rangeId, setRangeId] = useState<string>("1mo");
  const [showHoldings, setShowHoldings] = useState(false);
  const [data, setData] = useState<PricesResponse | null>(null);
  const [benchData, setBenchData] = useState<PricesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => DEFAULT_PORTFOLIOS.find((p) => p.id === activeId) || DEFAULT_PORTFOLIOS[0],
    [activeId],
  );
  const holdings = holdingsById[activeId] || [];
  const benchmark = benchmarkById[activeId] || "SMH";
  const range = RANGE_OPTIONS.find((r) => r.id === rangeId) || RANGE_OPTIONS[1];

  const setHoldings = (h: Holding[]) => setHoldingsById((s) => ({ ...s, [activeId]: h }));
  const setBenchmark = (b: string) => setBenchmarkById((s) => ({ ...s, [activeId]: b }));

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("portfolios.v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.holdingsById) setHoldingsById(parsed.holdingsById);
        if (parsed.benchmarkById) setBenchmarkById(parsed.benchmarkById);
        if (parsed.activeId) setActiveId(parsed.activeId);
      }
    } catch {}
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(
        "portfolios.v1",
        JSON.stringify({ holdingsById, benchmarkById, activeId }),
      );
    } catch {}
  }, [holdingsById, benchmarkById, activeId]);

  // Fetch prices when active portfolio / range changes.
  useEffect(() => {
    const tickers = holdings.map((h) => h.ticker.trim().toUpperCase()).filter(Boolean);
    if (tickers.length === 0) {
      setData(null);
      setBenchData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = `/api/prices?tickers=${encodeURIComponent(tickers.join(","))}&range=${range.yahoo}&interval=${range.interval}`;
    const benchUrl = benchmark
      ? `/api/prices?tickers=${encodeURIComponent(benchmark)}&range=${range.yahoo}&interval=${range.interval}`
      : null;
    Promise.all([
      fetch(url).then((r) => r.json()),
      benchUrl ? fetch(benchUrl).then((r) => r.json()) : Promise.resolve(null),
    ])
      .then(([px, bx]) => {
        if (cancelled) return;
        if (px?.error) throw new Error(px.error);
        setData(px);
        setBenchData(bx);
      })
      .catch((e) => !cancelled && setError(e.message || "fetch failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings.map((h) => h.ticker).join(","), benchmark, rangeId]);

  const aligned = useMemo(
    () => (data ? alignAndCompute(data.series, holdings) : null),
    [data, holdings],
  );

  // Align benchmark to portfolio dates (intersection).
  const benchAligned = useMemo(() => {
    if (!aligned || !benchData?.series?.[0]) return null;
    const s = benchData.series[0];
    if (s.error || s.dates.length === 0) return null;
    const map: Record<string, number> = {};
    for (let i = 0; i < s.dates.length; i++) map[s.dates[i]] = s.closes[i];
    const aligned_prices = aligned.dates.map((d) => map[d]).filter((v): v is number => Number.isFinite(v));
    if (aligned_prices.length < 2) return null;
    const base = aligned_prices[0];
    const series = aligned.dates.map((d) => {
      const v = map[d];
      return Number.isFinite(v) ? v / base - 1 : null;
    });
    return { series: series as (number | null)[], total: aligned_prices[aligned_prices.length - 1] / base - 1 };
  }, [aligned, benchData]);

  const benchmarkSeriesForChart = useMemo(() => {
    if (!benchAligned) return null;
    return benchAligned.series.map((v) => (v == null ? 0 : v)) as number[];
  }, [benchAligned]);

  const errorTickers =
    data?.series.filter((s) => s.error).map((s) => `${s.ticker} (${s.error})`) ?? [];
  const allFailed = data ? data.series.length > 0 && data.series.every((s) => s.error) : false;
  const rateLimited = data ? data.series.some((s) => /429|rate|too many/i.test(s.error || "")) : false;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Semi Portfolio Tracker
        </h1>
        <p className="text-sm text-muted mt-1">
          Live returns for any ticker basket. Edit weights, swap names, change the window.
        </p>
      </header>

      {/* Portfolio selector */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {DEFAULT_PORTFOLIOS.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${
              activeId === p.id
                ? "bg-accent text-white border-accent"
                : "bg-panel text-muted border-edge hover:bg-panel2"
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => {
            if (!confirm("Reset this portfolio to defaults?")) return;
            setHoldingsById((s) => ({
              ...s,
              [activeId]: (DEFAULT_PORTFOLIOS.find((p) => p.id === activeId)?.holdings || []).map((h) => ({ ...h })),
            }));
          }}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs border border-edge text-muted hover:text-white"
        >
          Reset to default
        </button>
      </div>

      {active.description && (
        <p className="text-xs text-muted mb-4 italic">{active.description}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Left rail: portfolio editor */}
        <div className="space-y-4">
          <PortfolioBuilder
            holdings={holdings}
            onChange={setHoldings}
            benchmark={benchmark}
            onBenchmarkChange={setBenchmark}
          />
        </div>

        {/* Main: chart + stats */}
        <div className="space-y-4">
          {/* Range selector */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 bg-panel border border-edge rounded-lg p-1">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRangeId(r.id)}
                  className={`px-2.5 py-1 text-xs font-mono rounded ${
                    rangeId === r.id ? "bg-accent text-white" : "text-muted hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={showHoldings}
                onChange={(e) => setShowHoldings(e.target.checked)}
                className="accent-accent"
              />
              Show individual holdings
            </label>
          </div>

          {loading && <div className="text-xs text-muted">Loading prices…</div>}
          {error && <div className="text-xs text-neg">{error}</div>}
          {allFailed && rateLimited && (
            <div className="rounded-lg border border-yellow-600/40 bg-yellow-900/20 p-3 text-xs text-yellow-200">
              <div className="font-semibold mb-1">Yahoo Finance is rate-limiting this server.</div>
              <p className="text-yellow-200/80">
                To enable a stable price feed, add a free <a href="https://twelvedata.com/pricing" target="_blank" rel="noreferrer" className="underline hover:text-white">Twelve Data</a> API
                key as the <code className="px-1 rounded bg-black/30">TWELVEDATA_API_KEY</code> environment variable in Vercel
                (Project → Settings → Environment Variables), then redeploy. 800 requests/day free, no credit card.
              </p>
            </div>
          )}
          {!allFailed && errorTickers.length > 0 && (
            <div className="text-xs text-neg">No data for: {errorTickers.join(", ")}</div>
          )}

          <PerformanceChart
            data={aligned}
            benchmark={benchmark}
            benchmarkReturns={benchmarkSeriesForChart}
            showHoldings={showHoldings}
          />

          <PortfolioStats
            data={aligned}
            holdings={holdings}
            benchmark={benchmark}
            benchmarkTotal={benchAligned?.total ?? null}
          />
        </div>
      </div>

      <footer className="mt-8 pt-6 border-t border-edge text-xs text-muted">
        <p>
          Prices via Yahoo Finance (unofficial). Cached 5 min. Computes cumulative returns from the first
          common trading day in the window. Forward-looking financial ratios coming next.
        </p>
      </footer>
    </div>
  );
}
