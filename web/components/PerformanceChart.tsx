"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import type { AlignedReturns } from "@/lib/returns";

type Props = {
  data: AlignedReturns | null;
  benchmark?: string | null;
  benchmarkReturns?: number[] | null;
  showHoldings?: boolean;
};

const COLORS = ["#5b8def", "#9b6bff", "#3ecf8e", "#f59e0b", "#ec4899", "#06b6d4", "#fb923c", "#84cc16"];

export function PerformanceChart({ data, benchmark, benchmarkReturns, showHoldings = false }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.dates.map((d, i) => {
      const row: Record<string, any> = { date: d, Portfolio: data.portfolio[i] };
      if (benchmarkReturns && benchmark) row[benchmark] = benchmarkReturns[i];
      if (showHoldings) {
        for (const t of Object.keys(data.byTicker)) row[t] = data.byTicker[t][i];
      }
      return row;
    });
  }, [data, benchmark, benchmarkReturns, showHoldings]);

  if (!data) {
    return (
      <div className="rounded-xl border border-edge bg-panel p-8 text-center text-muted text-sm">
        No data — pick a portfolio or check tickers.
      </div>
    );
  }

  const seriesKeys = showHoldings
    ? ["Portfolio", ...(benchmark ? [benchmark] : []), ...Object.keys(data.byTicker)]
    : ["Portfolio", ...(benchmark ? [benchmark] : [])];

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="h-[320px] sm:h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#252a36" strokeDasharray="2 4" />
            <XAxis
              dataKey="date"
              stroke="#7d8694"
              tick={{ fontSize: 11 }}
              minTickGap={28}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis
              stroke="#7d8694"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "#12151c",
                border: "1px solid #252a36",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#7d8694" }}
              formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {seriesKeys.map((k, i) => {
              const isPortfolio = k === "Portfolio";
              const isBench = benchmark && k === benchmark;
              return (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={isPortfolio ? "#5b8def" : isBench ? "#9b6bff" : COLORS[(i + 2) % COLORS.length]}
                  strokeWidth={isPortfolio ? 2.5 : isBench ? 2 : 1.25}
                  strokeDasharray={isBench ? "4 4" : undefined}
                  dot={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
