"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SalesReport } from "@/lib/actions/reports";
import type { Branch } from "@/lib/actions/branches";

interface ReportsChartProps {
  initialReport: SalesReport;
  branches: Branch[];
  accountId: string;
}

type DateRange = "7d" | "30d" | "90d" | "custom";

export default function ReportsChart({ initialReport, branches, accountId }: ReportsChartProps) {
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [report, setReport] = useState<SalesReport>(initialReport);
  const [loading, setLoading] = useState(false);

  const getDateRange = useCallback((): { from: string; to: string } => {
    const now = new Date();
    const to = now.toISOString().split("T")[0];
    let from: string;

    if (dateRange === "7d") {
      from = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
    } else if (dateRange === "30d") {
      from = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
    } else if (dateRange === "90d") {
      from = new Date(now.getTime() - 90 * 86400000).toISOString().split("T")[0];
    } else {
      from = customFrom || new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
    }

    return { from, to: customTo || to };
  }, [dateRange, customFrom, customTo]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange();
    const branchId = branchFilter === "all" ? undefined : branchFilter;

    const res = await fetch(
      `/api/actions/reports?accountId=${accountId}&dateFrom=${from}&dateTo=${to}${branchId ? `&branchId=${branchId}` : ""}`
    );
    const data = await res.json();
    setReport(data);
    setLoading(false);
  }, [accountId, branchFilter, getDateRange]);

  const exportCsv = () => {
    const headers = ["Date", "Revenue", "Orders"];
    const rows = report.revenueByDay.map((d) => [
      d.date,
      d.revenue.toFixed(2),
      d.order_count.toString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    {
      labelKey: "dash.reports.totalRevenue",
      value: `TSh ${report.totalRevenue.toLocaleString()}`,
      icon: "payments",
      colour: "text-primary",
    },
    {
      labelKey: "dash.reports.orderCount",
      value: report.orderCount.toString(),
      icon: "shopping_cart",
      colour: "text-secondary",
    },
    {
      labelKey: "dash.reports.avgOrderValue",
      value: `TSh ${Math.round(report.averageOrderValue).toLocaleString()}`,
      icon: "trending_up",
      colour: "text-amber-600",
    },
  ];

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex bg-surface-base border border-outline-variant rounded overflow-hidden">
            {([["7d", "7d"], ["30d", "30d"], ["90d", "90d"], ["custom", t("dash.reports.custom")]] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setDateRange(value as DateRange)}
                className={`px-4 py-2 text-xs font-label-md transition-colors ${
                  dateRange === value
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {dateRange === "custom" && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-2 bg-surface-base border border-outline-variant rounded text-sm focus:outline-none focus:border-primary"
              />
              <span className="text-on-surface-variant">-</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-2 bg-surface-base border border-outline-variant rounded text-sm focus:outline-none focus:border-primary"
              />
            </>
          )}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface-base border border-outline-variant rounded text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">{t("dash.reports.allBranches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button
            onClick={loadReport}
            disabled={loading}
            className="px-4 py-2.5 bg-primary text-on-primary rounded hover:opacity-90 transition-colors text-sm font-label-md disabled:opacity-50"
          >
            {t("dash.reports.apply")}
          </button>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface-base border border-outline-variant text-on-surface-variant rounded hover:bg-surface-container transition-colors text-sm font-label-md"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          {t("dash.reports.export")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.labelKey} className="bg-surface-base border border-outline-variant rounded p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-[20px] ${kpi.colour}`}>{kpi.icon}</span>
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-xs">
                {t(kpi.labelKey)}
              </span>
            </div>
            <div className={`font-headline-lg text-headline-lg ${kpi.colour}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface-base border border-outline-variant rounded p-6 mb-8">
        <h2 className="font-headline-md text-headline-md text-ink-deep mb-6">
          {t("dash.reports.revenueByDay")}
        </h2>
        <div className="h-72">
          {report.revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickFormatter={(v) => `TSh ${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`TSh ${value.toLocaleString()}`, "Revenue"]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#6366f1" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-on-surface-variant text-sm">
              {t("dash.reports.noData")}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface-base border border-outline-variant rounded overflow-x-auto">
        <div className="px-6 py-4 border-b border-outline-variant">
          <h2 className="font-headline-md text-headline-md text-ink-deep">
            {t("dash.reports.topProducts")}
          </h2>
        </div>
        {report.topProducts.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">
            {t("dash.reports.noProducts")}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="text-left px-6 py-3 font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                  {t("dash.reports.product")}
                </th>
                <th className="text-right px-6 py-3 font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                  {t("dash.reports.quantity")}
                </th>
                <th className="text-right px-6 py-3 font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                  {t("dash.reports.revenue")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {report.topProducts.map((product) => (
                <tr key={product.product_id} className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-body-md text-body-md text-ink-deep">{product.generic_name}</p>
                      {product.brand_name && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{product.brand_name}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-body-sm text-body-sm text-on-surface-variant">
                    {product.total_quantity.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-body-md text-body-md text-ink-deep">
                    TSh {product.total_revenue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
