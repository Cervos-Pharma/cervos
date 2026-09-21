/**
 * @file components/SupplierAnalyticsChart.tsx
 * @description Analytics dashboard for supplier accounts.
 *
 * Renders a pure-CSS bar chart of monthly metrics (quote requests, confirmed orders,
 * revenue), a top-products table, and KPI strip with conversion rate.
 *
 * Chart metric is selectable (quote requests / confirmed / revenue) via toggle buttons.
 * "Export CSV" downloads the analytics data as a CSV file.
 */
"use client";

import { useState } from "react";

/** Monthly aggregated sales data for the bar chart. */
interface MonthlyData {
  /** Display label, e.g. "Jan 2026" */
  month: string;
  /** Total quote requests received */
  quoteRequests: number;
  /** Orders confirmed/accepted */
  confirmed: number;
  /** Total revenue in TZS */
  revenue: number;
}

interface SupplierAnalyticsChartProps {
  /** 12 months of aggregated data, ordered chronologically. */
  data: MonthlyData[];
  /** Top products by request volume and revenue. */
  topProducts: { name: string; requests: number; revenue: number }[];
  /** Overall quote-to-order conversion rate as a percentage (0–100). */
  conversionRate: number;
}

export default function SupplierAnalyticsChart({
  data,
  topProducts,
  conversionRate,
}: SupplierAnalyticsChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [metric, setMetric] = useState<"quoteRequests" | "confirmed" | "revenue">("quoteRequests");

  const values = data.map((d) => d[metric]);
  const maxVal = Math.max(...values, 1);

  const metricLabels = {
    quoteRequests: "Quote Requests",
    confirmed: "Confirmed Orders",
    revenue: "Revenue (TZS)",
  };

  const totalRequests = data.reduce((s, d) => s + d.quoteRequests, 0);
  const totalConfirmed = data.reduce((s, d) => s + d.confirmed, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);

  const BAR_HEIGHT = 160;
  const BAR_WIDTH = Math.max(24, Math.floor(600 / Math.max(data.length, 1)) - 8);

  return (
    <div className="flex-1 min-w-0 p-4 sm:p-8 flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest border border-outline-variant p-4 relative">
          <div className="absolute top-0 right-0 w-4 h-4 border-l border-b border-outline-variant" />
          <p className="font-mono text-label-md text-on-surface-variant uppercase mb-1">Total Requests (12m)</p>
          <p className="text-headline-md font-headline-md text-ink-deep">{totalRequests.toLocaleString()}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-4 relative">
          <div className="absolute top-0 right-0 w-4 h-4 border-l border-b border-outline-variant" />
          <p className="font-mono text-label-md text-on-surface-variant uppercase mb-1">Confirmed Orders</p>
          <p className="text-headline-md font-headline-md text-primary-container">{totalConfirmed.toLocaleString()}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-4 relative">
          <div className="absolute top-0 right-0 w-4 h-4 border-l border-b border-outline-variant" />
          <p className="font-mono text-label-md text-on-surface-variant uppercase mb-1">Conversion Rate</p>
          <p className="text-headline-md font-headline-md text-tertiary">{conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 relative">
          <div className="absolute top-0 right-0 w-5 h-5 border-l border-b border-outline-variant" />
          <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
            <div>
              <p className="font-mono text-label-md text-on-surface-variant uppercase mb-1">Quote Request Volume</p>
              <p className="text-headline-md font-headline-md text-ink-deep">{metricLabels[metric]}</p>
            </div>
            <div className="flex gap-2">
              {(["quoteRequests", "confirmed", "revenue"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`font-mono text-label-md px-2 py-1 border uppercase transition-colors text-[10px] ${
                    metric === m
                      ? "bg-ink-deep text-white border-ink-deep"
                      : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {m === "quoteRequests" ? "Requests" : m === "confirmed" ? "Confirmed" : "Revenue"}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="relative" style={{ height: BAR_HEIGHT + 40 }}>
            {/* Y-axis guidelines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-outline-variant opacity-40"
                style={{ bottom: 32 + pct * BAR_HEIGHT }}
              >
                <span className="absolute -left-1 -top-2.5 font-mono text-[10px] text-on-surface-variant transform -translate-x-full pr-1">
                  {metric === "revenue"
                    ? `${((maxVal * pct) / 1000).toFixed(0)}k`
                    : Math.round(maxVal * pct)}
                </span>
              </div>
            ))}

            {/* Bars */}
            <div className="absolute bottom-8 left-6 sm:left-8 right-0 flex items-end gap-1 sm:gap-2 h-full" style={{ height: BAR_HEIGHT }}>
              {data.map((d, i) => {
                const val = d[metric];
                const barH = maxVal > 0 ? (val / maxVal) * BAR_HEIGHT : 0;
                const isHovered = hoveredIdx === i;
                return (
                  <div
                    key={d.month}
                    className="flex flex-col items-center flex-1 min-w-0"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{ height: BAR_HEIGHT }}
                  >
                    <div className="flex flex-col justify-end flex-1 w-full relative">
                      {isHovered && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink-deep text-white font-mono text-[10px] px-2 py-1 whitespace-nowrap z-10">
                          {metric === "revenue" ? `TZS ${val.toLocaleString()}` : val}
                        </div>
                      )}
                      <div
                        className={`w-full transition-all cursor-pointer ${
                          isHovered ? "bg-primary" : "bg-primary-container"
                        }`}
                        style={{ height: barH }}
                      />
                    </div>
                    <div className="font-mono text-[9px] text-on-surface-variant uppercase mt-1 text-center truncate w-full">
                      {d.month.split(" ")[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue total */}
          <div className="mt-4 pt-4 border-t border-outline-variant flex justify-between">
            <span className="font-mono text-label-md text-on-surface-variant uppercase">12-Month Revenue</span>
            <span className="font-mono text-label-md text-ink-deep font-bold">TZS {totalRevenue.toLocaleString()}</span>
          </div>
        </div>

        {/* Top products */}
        <div className="bg-surface-container-lowest border border-outline-variant p-6 relative flex flex-col gap-4">
          <div className="absolute top-0 right-0 w-5 h-5 border-l border-b border-outline-variant" />
          <div>
            <p className="font-mono text-label-md text-on-surface-variant uppercase mb-1">Top Products</p>
            <p className="text-headline-md font-headline-md text-ink-deep">By Request Volume</p>
          </div>
          <div className="flex flex-col gap-3 flex-1">
            {topProducts.map((p, i) => {
              const maxReq = Math.max(...topProducts.map((t) => t.requests), 1);
              const pct = (p.requests / maxReq) * 100;
              return (
                <div key={p.name}>
                  <div className="flex justify-between font-mono text-[10px] text-on-surface-variant mb-1">
                    <span className="truncate pr-2 font-semibold text-on-surface">{p.name}</span>
                    <span>{p.requests} req</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container border border-outline-variant relative">
                    <div
                      className={`absolute top-0 left-0 h-full ${
                        i === 0 ? "bg-primary-container" :
                        i === 1 ? "bg-primary" :
                        "bg-on-surface-variant"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="font-mono text-[10px] text-on-surface-variant mt-0.5">
                    TZS {p.revenue.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-outline-variant">
            <div className="flex justify-between font-mono text-label-md">
              <span className="text-on-surface-variant uppercase">Conversion</span>
              <span className="text-tertiary font-bold">{conversionRate.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-surface-container border border-outline-variant relative mt-2">
              <div
                className="absolute top-0 left-0 h-full bg-tertiary-container"
                style={{ width: `${conversionRate}%` }}
              />
            </div>
            <p className="font-mono text-[10px] text-on-surface-variant mt-1">Of quote requests → confirmed orders</p>
          </div>
        </div>
      </div>

      {/* Monthly breakdown table — scrolls sideways on phones instead of being clipped */}
      <div className="bg-surface-container-lowest border border-outline-variant overflow-x-auto">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container">
          <span className="font-mono text-label-md text-on-surface-variant uppercase">Monthly Breakdown</span>
          <a
            href="/supplier/analytics/export"
            download
            className="font-mono text-label-md text-primary-container border border-primary-container px-3 py-1 hover:bg-surface-container-high transition-colors uppercase flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
            Export CSV
          </a>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase">Month</th>
              <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase text-right">Requests</th>
              <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase text-right">Confirmed</th>
              <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase text-right">Conv. Rate</th>
              <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase text-right">Revenue (TZS)</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => {
              const conv = d.quoteRequests > 0 ? ((d.confirmed / d.quoteRequests) * 100).toFixed(1) : "0.0";
              return (
                <tr key={d.month} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-mono text-label-md text-on-surface">{d.month}</td>
                  <td className="px-4 py-3 font-mono text-label-md text-on-surface text-right tabular-nums">{d.quoteRequests}</td>
                  <td className="px-4 py-3 font-mono text-label-md text-on-surface text-right tabular-nums">{d.confirmed}</td>
                  <td className="px-4 py-3 font-mono text-label-md text-on-surface text-right tabular-nums">{conv}%</td>
                  <td className="px-4 py-3 font-mono text-label-md text-on-surface text-right tabular-nums">{d.revenue.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
