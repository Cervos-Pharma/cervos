/**
 * @file hq/intelligence/HQIntelligenceClient.tsx
 * @description Client component for the HQ Intelligence page. Renders the
 *   overview stat cards, period-to-date metrics (quote funnel, support,
 *   sales), demographic breakdowns, and recent network activity. Period
 *   switching refetches the overview via the `getIntelligenceOverview`
 *   server action.
 */
"use client";

import { useState } from "react";
import {
  getIntelligenceOverview,
  type IntelligenceOverview,
  type DemographicsBreakdown,
  type SyncHealthMetrics,
  type EngagementMetrics,
  type NetworkHealthMetrics,
  type RevenueMetrics,
  type BranchIntelligenceMetrics,
  type MarketIntelligenceMetrics,
  type LogisticsMetrics,
  type UserActivityMetrics,
  generateIntelligenceReport,
} from "@/lib/actions/hq";
import Toast from "@/components/Toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import dynamic from "next/dynamic";

const BranchMap = dynamic(() => import("@/components/hq/BranchMap"), { ssr: false });
const NetworkGlobe = dynamic(() => import("@/components/hq/NetworkGlobe"), { ssr: false });

interface Props {
  overview: IntelligenceOverview | null;
  overviewError: string | null;
  demographics: DemographicsBreakdown | null;
  demographicsError: string | null;
  syncHealth: SyncHealthMetrics | null;
  syncHealthError: string | null;
  engagement: EngagementMetrics | null;
  engagementError: string | null;
  networkHealth: NetworkHealthMetrics | null;
  networkHealthError: string | null;
  revenue: RevenueMetrics | null;
  revenueError: string | null;
  hourlyActivity: { hour: string; actions: number }[] | null;
  hourlyActivityError: string | null;
  branchIntelligence: BranchIntelligenceMetrics | null;
  branchIntelligenceError: string | null;
  marketIntelligence: MarketIntelligenceMetrics | null;
  marketIntelligenceError: string | null;
  logisticsIntelligence: LogisticsMetrics | null;
  logisticsIntelligenceError: string | null;
  userActivity: UserActivityMetrics | null;
  userActivityError: string | null;
}

type Period = 30 | 90 | 0;
type Tab = "overview" | "sync" | "engagement" | "revenue" | "network" | "branch" | "market" | "logistics" | "users" | "reports";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  sync: "Sync Health",
  engagement: "Engagement",
  revenue: "Revenue",
  network: "Network",
  branch: "Branch",
  market: "Market",
  logistics: "Logistics",
  users: "Users",
  reports: "Reports",
};

function periodLabel(days: Period): string {
  return days === 0 ? "All time" : `Last ${days} days`;
}

function currency(amount: number): string {
  return "TZS " + Math.round(amount).toLocaleString();
}

const CHART_COLORS = ["#6750A4", "#625B71", "#7D5260", "#B3261E", "#0061A4", "#146C2E", "#7D5260"];

export default function HQIntelligenceClient({
  overview,
  overviewError,
  demographics,
  demographicsError,
  syncHealth,
  syncHealthError,
  engagement,
  engagementError,
  networkHealth,
  networkHealthError,
  revenue,
  revenueError,
  hourlyActivity,
  hourlyActivityError,
  branchIntelligence,
  branchIntelligenceError,
  marketIntelligence,
  marketIntelligenceError,
  logisticsIntelligence,
  logisticsIntelligenceError,
  userActivity,
  userActivityError,
}: Props) {
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<IntelligenceOverview | null>(overview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(overviewError);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [reportSections, setReportSections] = useState<string[]>(["summary", "revenue", "products", "logistics", "users"]);
  const [reportFromDate, setReportFromDate] = useState("");
  const [reportToDate, setReportToDate] = useState("");
  const [reportRegion, setReportRegion] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);

  async function switchPeriod(next: Period) {
    if (next === period) return;
    setPeriod(next);
    setLoading(true);
    try {
      const result = await getIntelligenceOverview(next);
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }

  const stats = data?.totals;
  const periodStats = data?.period;

  function renderOverview() {
    return (
      <>
        <div className="flex items-center gap-2 mb-8">
          {([30, 90, 0] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => switchPeriod(p)}
              disabled={loading}
              className={`px-4 py-2 font-label-md text-label-md transition-colors disabled:opacity-60 ${
                period === p
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {periodLabel(p)}
            </button>
          ))}
          {loading && (
            <div className="ml-2 w-4 h-4 border border-primary/40 border-t-primary rounded-full animate-spin" />
          )}
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
            <p className="font-body-md">Error loading intelligence: {error}</p>
          </div>
        )}

        {data && stats ? (
          <>
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
              Network totals
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
              {[
                { label: "Accounts", value: stats.accounts, sub: `${stats.pharmacies} pharm · ${stats.suppliers} supp` },
                { label: "Suspended", value: stats.suspended, danger: true },
                { label: "Branches", value: stats.branches, sub: `${stats.lockedBranches} locked` },
                { label: "Operators", value: stats.operators },
                { label: "Installs", value: stats.installs },
                { label: "Onboarding done", value: stats.onboardingCompleted },
              ].map((s) => (
                <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
                  <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p className={`font-headline-lg text-headline-lg mt-1 ${s.danger ? "text-error" : "text-ink-deep"}`}>
                    {s.value}
                  </p>
                  {s.sub && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{s.sub}</p>
                  )}
                </div>
              ))}
            </div>

            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
              {periodLabel(period)} activity
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Quote requests", value: periodStats?.quoteRequests ?? 0 },
                { label: "Support tickets", value: periodStats?.supportTickets ?? 0, sub: `${periodStats?.openSupportTickets ?? 0} open` },
                { label: "New accounts", value: periodStats?.newAccounts ?? 0 },
                { label: "Sales revenue", value: currency(periodStats?.salesRevenue ?? 0), sub: `${periodStats?.sales ?? 0} transactions` },
              ].map((s) => (
                <div key={s.label} className="bg-surface-container-low border border-outline-variant p-5">
                  <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p className="font-headline-sm text-headline-sm text-ink-deep mt-1">{s.value}</p>
                  {s.sub && <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-surface-base border border-outline-variant p-6">
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">
                  Quote funnel
                </p>
                {(data.quoteFunnel.length === 0 || data.quoteFunnel.every((f) => f.count === 0)) ? (
                  <p className="font-body-md text-on-surface-variant">No quote requests in this period.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.quoteFunnel.map((f) => {
                      const max = Math.max(...data.quoteFunnel.map((x) => x.count), 1);
                      return (
                        <div key={f.status}>
                          <div className="flex justify-between font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">
                            <span>{f.status}</span>
                            <span>{f.count}</span>
                          </div>
                          <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.round((f.count / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-surface-base border border-outline-variant p-6">
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">
                  Support tickets
                </p>
                <div className="flex flex-col gap-3">
                  {data.supportBreakdown.map((s) => (
                    <div
                      key={s.status}
                      className="flex items-center justify-between border border-outline-variant/40 px-4 py-3"
                    >
                      <span className="font-label-md text-label-md capitalize text-on-surface">{s.status}</span>
                      <span className="font-headline-md text-headline-md text-ink-deep">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
              Demographics
            </p>
            {demographicsError ? (
              <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
                <p className="font-body-md">Error loading demographics: {demographicsError}</p>
              </div>
            ) : demographics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {[
                  { title: "Account types", buckets: demographics.accountTypes },
                  { title: "Regions", buckets: demographics.regions },
                  { title: "Roles", buckets: demographics.roles },
                  { title: "Tech comfort", buckets: demographics.techComfort },
                  { title: "Goals", buckets: demographics.goals },
                ].map((group) => (
                  <div key={group.title} className="bg-surface-base border border-outline-variant p-6">
                    <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">
                      {group.title}
                    </p>
                    {group.buckets.length === 0 ? (
                      <p className="font-body-md text-on-surface-variant">No data yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {group.buckets.map((b) => {
                          const max = Math.max(...group.buckets.map((x) => x.count), 1);
                          return (
                            <div key={b.label}>
                              <div className="flex justify-between font-body-sm text-body-sm mb-1">
                                <span className="text-on-surface capitalize">{b.label}</span>
                                <span className="text-on-surface-variant font-mono">{b.count}</span>
                              </div>
                              <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-secondary rounded-full"
                                  style={{ width: `${Math.round((b.count / max) * 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
              Recent activity
            </p>
            <div className="bg-surface-base border border-outline-variant rounded overflow-hidden mb-8">
              {data.recentActivity.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-body-md text-on-surface-variant">No activity recorded yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-outline-variant/30">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="px-6 py-4 flex items-start gap-4">
                      <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">
                        {a.action === "sale" || a.action === "sale_created" ? "point_of_sale" : "bolt"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-body-md text-body-md text-ink-deep">
                          {a.accountName ?? "Unknown account"}
                          {a.branchName ? <span className="text-on-surface-variant"> · {a.branchName}</span> : null}
                        </p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          {a.action}
                          {a.detail ? <span className="font-mono text-xs"> — {a.detail.slice(0, 120)}</span> : null}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-on-surface-variant whitespace-nowrap pt-0.5">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </>
    );
  }

  function renderSyncHealth() {
    if (syncHealthError) {
      return (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
          <p className="font-body-md">Error loading sync health: {syncHealthError}</p>
        </div>
      );
    }
    if (!syncHealth) return null;

    const syncStatusData = [
      { name: "Synced <24h", value: syncHealth.syncedRecently, color: "#146C2E" },
      { name: "Synced <7d", value: syncHealth.syncedThisWeek - syncHealth.syncedRecently, color: "#0061A4" },
      { name: "Stale (7d+)", value: syncHealth.staleBranches, color: "#B3261E" },
      { name: "Never Synced", value: syncHealth.neverSynced, color: "#7D5260" },
    ].filter((d) => d.value > 0);

    return (
      <>
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
          Sync Health
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Branches", value: syncHealth.totalBranches },
            { label: "Synced <24h", value: syncHealth.syncedRecently, success: true },
            { label: "Synced <7d", value: syncHealth.syncedThisWeek },
            { label: "Stale (7d+)", value: syncHealth.staleBranches, danger: true },
            { label: "Never Synced", value: syncHealth.neverSynced, danger: true },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`font-headline-lg text-headline-lg mt-1 ${s.danger ? "text-error" : s.success ? "text-success" : "text-ink-deep"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Sync Status Distribution</p>
            {syncStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={syncStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {syncStatusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No sync data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Avg Sync Frequency</p>
            <div className="flex items-center justify-center h-[200px]">
              <div className="text-center">
                <p className="font-headline-lg text-headline-lg text-ink-deep">{syncHealth.avgSyncFrequencyHours}h</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">average between syncs</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant p-6 mb-8">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Branches by Subscription Status</p>
          {syncHealth.branchesBySyncStatus.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {syncHealth.branchesBySyncStatus.map((s) => {
                const max = Math.max(...syncHealth.branchesBySyncStatus.map((x) => x.count), 1);
                return (
                  <div key={s.status}>
                    <div className="flex justify-between font-body-sm text-body-sm mb-1">
                      <span className="text-on-surface capitalize">{s.status}</span>
                      <span className="text-on-surface-variant font-mono">{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.round((s.count / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-body-md text-on-surface-variant">No data available.</p>
          )}
        </div>
      </>
    );
  }

  function renderEngagement() {
    if (engagementError) {
      return (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
          <p className="font-body-md">Error loading engagement: {engagementError}</p>
        </div>
      );
    }
    if (!engagement) return null;

    const regionData = engagement.topRegionsByActivity.map((r) => ({
      region: r.region,
      orders: r.orderCount,
      revenue: r.revenue,
    }));

    return (
      <>
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
          Engagement
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "DAU/WAU Ratio", value: engagement.dauWauRatio.toFixed(2) },
            { label: "Active Today", value: engagement.activeUsersToday },
            { label: "Active This Week", value: engagement.activeUsersThisWeek },
            { label: "30-Day Retention", value: `${engagement.retentionRate30Day}%` },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className="font-headline-lg text-headline-lg text-ink-deep mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top Regions by Activity</p>
            {regionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={regionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="region" width={80} />
                  <Tooltip />
                  <Bar dataKey="orders" fill={CHART_COLORS[0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No region data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Hourly Activity (24h)</p>
            {hourlyActivity && hourlyActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="actions" fill={CHART_COLORS[1]} name="Actions" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No hourly data available.</p>
            )}
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant p-6 mb-8">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">New Accounts & Transactions</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-body-sm text-on-surface-variant">New Accounts (Month)</p>
              <p className="font-headline-md text-headline-md text-ink-deep">{engagement.newAccountsThisMonth}</p>
            </div>
            <div>
              <p className="font-body-sm text-on-surface-variant">Transacting Accounts (Month)</p>
              <p className="font-headline-md text-headline-md text-ink-deep">{engagement.accountsWhoTransactedThisMonth}</p>
            </div>
            <div>
              <p className="font-body-sm text-on-surface-variant">Avg Orders per Transacting Account</p>
              <p className="font-headline-md text-headline-md text-ink-deep">{engagement.avgOrdersPerTransactingAccount}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderRevenue() {
    if (revenueError) {
      return (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
          <p className="font-body-md">Error loading revenue: {revenueError}</p>
        </div>
      );
    }
    if (!revenue) return null;

    return (
      <>
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
          Revenue
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Revenue", value: currency(revenue.totalRevenue) },
            { label: "MTD Revenue", value: currency(revenue.mtdRevenue) },
            { label: "YTD Revenue", value: currency(revenue.ytdRevenue) },
            { label: "Avg Order Value", value: currency(revenue.avgOrderValue) },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className="font-headline-sm text-headline-sm text-ink-deep mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Revenue Trend (Daily)</p>
            {revenue.revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={revenue.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Line type="monotone" dataKey="amount" stroke={CHART_COLORS[0]} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No revenue data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Revenue by Region</p>
            {revenue.revenueByRegion.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenue.revenueByRegion} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="region" width={80} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Bar dataKey="amount" fill={CHART_COLORS[2]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No region data available.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Revenue by Account Type</p>
            {revenue.revenuePerAccountType.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={revenue.revenuePerAccountType}
                    dataKey="revenue"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {revenue.revenuePerAccountType.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => currency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No type data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top 10 Accounts by Revenue</p>
            {revenue.topAccountsByRevenue.length > 0 ? (
              <div className="flex flex-col gap-2">
                {revenue.topAccountsByRevenue.map((a, i) => (
                  <div key={a.accountId} className="flex items-center justify-between">
                    <span className="font-body-sm text-on-surface">{i + 1}. {a.name}</span>
                    <span className="font-mono text-xs text-on-surface-variant">{currency(a.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body-md text-on-surface-variant">No account data available.</p>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderNetwork() {
    if (networkHealthError) {
      return (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
          <p className="font-body-md">Error loading network health: {networkHealthError}</p>
        </div>
      );
    }
    if (!networkHealth) return null;

    const statusData = [
      { name: "Healthy", value: networkHealth.healthyStatus, color: "#146C2E" },
      { name: "At Risk", value: networkHealth.atRiskStatus, color: "#B3261E" },
      { name: "Locked", value: networkHealth.lockedStatus, color: "#7D5260" },
    ].filter((d) => d.value > 0);

    return (
      <>
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
          Network Health
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Branches", value: networkHealth.totalBranches },
            { label: "Online Now", value: networkHealth.onlineNow, success: true },
            { label: "Healthy", value: networkHealth.healthyStatus, success: true },
            { label: "At Risk", value: networkHealth.atRiskStatus, danger: true },
            { label: "Locked", value: networkHealth.lockedStatus, danger: true },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`font-headline-lg text-headline-lg mt-1 ${s.danger ? "text-error" : s.success ? "text-success" : "text-ink-deep"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-surface-base border border-outline-variant p-6 mb-8">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">3D Network View</p>
          <NetworkGlobe networkHealth={networkHealth} branchLocations={networkHealth.branchLocations.map((b) => ({ lat: b.lat ?? 0, lng: b.lng ?? 0, name: b.name, accountName: b.accountName, status: b.status }))} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Status Distribution</p>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-body-md text-on-surface-variant">No status data available.</p>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Inventory Health</p>
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-body-sm text-on-surface-variant">Avg Batches per Branch</p>
                <p className="font-headline-md text-headline-md text-ink-deep">{networkHealth.avgBatchesPerBranch}</p>
              </div>
              <div>
                <p className="font-body-sm text-on-surface-variant">Avg Products per Branch</p>
                <p className="font-headline-md text-headline-md text-ink-deep">{networkHealth.avgProductsPerBranch}</p>
              </div>
              <div>
                <p className="font-body-sm text-on-surface-variant">Expiring Batches (30 days)</p>
                <p className={`font-headline-md text-headline-md ${networkHealth.expiringBatchesThisMonth > 0 ? "text-error" : "text-ink-deep"}`}>
                  {networkHealth.expiringBatchesThisMonth}
                </p>
              </div>
              <div>
                <p className="font-body-sm text-on-surface-variant">Out of Stock Products</p>
                <p className={`font-headline-md text-headline-md ${networkHealth.outOfStockProducts > 0 ? "text-error" : "text-ink-deep"}`}>
                  {networkHealth.outOfStockProducts}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderBranch() {
    if (branchIntelligenceError) {
      return (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-8">
          <p className="font-body-md">Error loading branch intelligence: {branchIntelligenceError}</p>
        </div>
      );
    }
    if (!branchIntelligence) return null;

    const bi = branchIntelligence;
    const risk = bi.expiryRisk;
    const alerts = bi.stockAlerts;

    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Top Branch Revenue", value: currency(bi.topBranchesByRevenue[0]?.revenue ?? 0), sub: bi.topBranchesByRevenue[0]?.branchName ?? "-" },
            { label: "Out of Stock Items", value: alerts.totalOutOfStock, danger: alerts.totalOutOfStock > 0 },
            { label: "Expiring <=30d", value: risk.expiringIn30Days, danger: risk.expiringIn30Days > 0 },
            { label: "Expired Batches", value: risk.expired, danger: risk.expired > 0 },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`font-headline-lg text-headline-lg mt-1 ${s.danger ? "text-error" : "text-ink-deep"}`}>{s.value}</p>
              {s.sub && <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>

        {bi.branchLocations.length > 0 && (
          <div className="bg-surface-base border border-outline-variant p-6 mb-8">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Branch Locations Map</p>
            <BranchMap branches={bi.branchLocations} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top 10 Branches by Revenue</p>
            {bi.topBranchesByRevenue.length === 0 ? (
              <p className="font-body-md text-on-surface-variant">No branch revenue data.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {bi.topBranchesByRevenue.map((b, i) => (
                  <div key={b.branchId} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-on-surface-variant w-5 text-right">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="font-body-sm text-on-surface truncate">{b.branchName}</p>
                        <p className="font-mono text-xs text-on-surface-variant truncate">{b.accountName}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="font-mono text-sm text-ink-deep">{currency(b.revenue)}</p>
                      <p className="font-mono text-xs text-on-surface-variant">{b.transactionCount} txns</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top 10 Branches by Transactions</p>
            {bi.topBranchesByTransactions.length === 0 ? (
              <p className="font-body-md text-on-surface-variant">No transaction data.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {bi.topBranchesByTransactions.map((b, i) => (
                  <div key={b.branchId} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-on-surface-variant w-5 text-right">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="font-body-sm text-on-surface truncate">{b.branchName}</p>
                        <p className="font-mono text-xs text-on-surface-variant truncate">{b.accountName}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="font-mono text-sm text-ink-deep">{b.transactionCount} txns</p>
                      <p className="font-mono text-xs text-on-surface-variant">{currency(b.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {bi.bottomBranchesByRevenue.length > 0 && (
          <div className="bg-surface-base border border-outline-variant p-6 mb-8">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Bottom 5 Branches by Revenue</p>
            <div className="flex flex-col gap-2">
              {bi.bottomBranchesByRevenue.map((b) => (
                <div key={b.branchId} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                  <div className="min-w-0">
                    <p className="font-body-sm text-on-surface truncate">{b.branchName}</p>
                    <p className="font-mono text-xs text-on-surface-variant truncate">{b.accountName}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-mono text-sm text-error">{currency(b.revenue)}</p>
                    <p className="font-mono text-xs text-on-surface-variant">{b.transactionCount} txns</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Expiry Risk</p>
            <div className="flex flex-col gap-4">
              {[
                { label: "Expired", value: risk.expired, color: "text-error" },
                { label: "<= 30 days", value: risk.expiringIn30Days, color: "text-error" },
                { label: "31-60 days", value: risk.expiringIn60Days, color: "text-amber-600" },
                { label: "61-90 days", value: risk.expiringIn90Days, color: "text-on-surface-variant" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="font-body-sm text-on-surface-variant">{r.label}</span>
                  <span className={`font-headline-md ${r.value > 0 ? r.color : "text-on-surface-variant"}`}>{r.value}</span>
                </div>
              ))}
            </div>
            {risk.atRiskBranches.length > 0 && (
              <div className="mt-4 pt-4 border-t border-outline-variant/40">
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">At-Risk Branches</p>
                {risk.atRiskBranches.slice(0, 5).map((b) => (
                  <div key={b.branchId} className="flex justify-between py-1">
                    <span className="font-body-sm text-on-surface truncate">{b.branchName}</span>
                    <span className="font-mono text-xs text-error ml-2">{b.expiringBatches} batches</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Stock Alerts</p>
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="font-body-sm text-on-surface-variant">Out of Stock</span>
                <span className={`font-headline-md ${alerts.totalOutOfStock > 0 ? "text-error" : "text-on-surface-variant"}`}>
                  {alerts.totalOutOfStock}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-body-sm text-on-surface-variant">Low Stock (&lt;10 units)</span>
                <span className={`font-headline-md ${alerts.totalLowStock > 0 ? "text-amber-600" : "text-on-surface-variant"}`}>
                  {alerts.totalLowStock}
                </span>
              </div>
            </div>
            {alerts.outOfStock.length > 0 && (
              <div className="mt-4 pt-4 border-t border-outline-variant/40">
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Out of Stock Items</p>
                {alerts.outOfStock.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex justify-between py-1">
                    <span className="font-body-sm text-on-surface truncate">{item.productName}</span>
                    <span className="font-mono text-xs text-error ml-2 truncate">{item.branchName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top Products by Revenue</p>
            {bi.topProductsByRevenue.length === 0 ? (
              <p className="font-body-md text-on-surface-variant">No product data.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {bi.topProductsByRevenue.slice(0, 8).map((p) => (
                  <div key={p.productId} className="flex justify-between items-center py-1 border-b border-outline-variant/20 last:border-0">
                    <div className="min-w-0 mr-2">
                      <p className="font-body-sm text-on-surface truncate">{p.genericName}</p>
                      {p.brandName && <p className="font-mono text-xs text-on-surface-variant truncate">{p.brandName}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-xs text-ink-deep">{currency(p.revenue)}</p>
                      <p className="font-mono text-xs text-on-surface-variant">{p.unitsSold} units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {bi.topProductsByQuantity.length > 0 && (
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top Products by Units Sold</p>
            <div className="flex flex-col gap-2">
              {bi.topProductsByQuantity.slice(0, 15).map((p, i) => {
                const max = bi.topProductsByQuantity[0]?.unitsSold ?? 1;
                return (
                  <div key={p.productId} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-on-surface-variant w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-0.5">
                        <span className="font-body-sm text-on-surface truncate">{p.genericName}</span>
                        <span className="font-mono text-xs text-on-surface-variant ml-2">{p.unitsSold} units</span>
                      </div>
                      <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.round((p.unitsSold / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderMarket() {
    if (marketIntelligenceError) {
      return <div className="bg-error-container text-on-error-container p-6 rounded mb-8"><p className="font-body-md">Error: {marketIntelligenceError}</p></div>;
    }
    if (!marketIntelligence) return null;
    const m = marketIntelligence;

    const categoryData = m.productPerformance.reduce((acc: Record<string, { count: number; revenue: number }>, p) => {
      const cat = p.category ?? "Uncategorized";
      if (!acc[cat]) acc[cat] = { count: 0, revenue: 0 };
      acc[cat].count += p.unitsSold;
      acc[cat].revenue += p.revenue;
      return acc;
    }, {});
    const categoryChart = Object.entries(categoryData).map(([cat, v]) => ({ category: cat, ...v })).sort((a, b) => b.revenue - a.revenue);

    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Quotes", value: m.marketSummary.totalQuotes },
            { label: "Total Orders", value: m.marketSummary.totalOrders },
            { label: "Total Revenue", value: currency(m.marketSummary.totalRevenue) },
            { label: "Avg Order Value", value: currency(m.marketSummary.avgOrderValue) },
            { label: "Conversion Rate", value: `${m.marketSummary.conversionRate}%`, success: m.marketSummary.conversionRate > 20 },
            { label: "Active Suppliers", value: m.supplierPerformance.length },
            { label: "Top Region", value: m.marketSummary.topRegion ?? "—" },
            { label: "Top Product", value: m.marketSummary.topProduct ?? "—" },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`font-headline-sm text-headline-sm mt-1 ${s.success ? "text-success" : "text-ink-deep"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Product Categories by Revenue</p>
            {categoryChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryChart.slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="category" width={100} />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Bar dataKey="revenue" fill={CHART_COLORS[0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-on-surface-variant">No category data.</p>}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Regional Revenue</p>
            {m.regionalBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={m.regionalBreakdown.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="region" width={80} />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Bar dataKey="revenue" fill={CHART_COLORS[2]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-on-surface-variant">No region data.</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Supplier Performance</p>
            {m.supplierPerformance.length === 0 ? <p className="text-on-surface-variant">No supplier data.</p> : (
              <div className="flex flex-col gap-2">
                {m.supplierPerformance.slice(0, 12).map((s) => (
                  <div key={s.supplierId} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                    <div className="min-w-0 mr-3">
                      <p className="font-body-sm text-on-surface truncate">{s.supplierName}</p>
                      <p className="font-mono text-xs text-on-surface-variant">{s.totalQuotes} quotes · {s.conversionRate}% conv</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-sm text-ink-deep">{currency(s.totalOrderValue)}</p>
                      <p className="font-mono text-xs text-secondary">{s.convertedQuotes} converted</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Order Trends</p>
            {m.orderTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={m.orderTrends.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS[0]} name="Revenue" />
                  <Line type="monotone" dataKey="orderCount" stroke={CHART_COLORS[1]} name="Orders" />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-on-surface-variant">No order data.</p>}
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant p-6 mb-8">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Engagement Funnel</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {m.engagementFunnel.map((f) => (
              <div key={f.stage} className="text-center">
                <p className="font-headline-md text-headline-md text-ink-deep">{f.count}</p>
                <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase">{f.stage}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top 30 Products by Revenue</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-outline-variant">
                <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">#</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">Product</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">Category</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Units</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Revenue</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Avg Price</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Orders</th>
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/30">
                {m.productPerformance.slice(0, 30).map((p, i) => (
                  <tr key={p.productId} className="hover:bg-surface-container-low/50">
                    <td className="py-2 px-3 font-mono text-xs text-on-surface-variant">{i + 1}</td>
                    <td className="py-2 px-3">
                      <p className="font-body-sm text-on-surface">{p.genericName}</p>
                      {p.brandName && <p className="font-mono text-xs text-on-surface-variant">{p.brandName}</p>}
                    </td>
                    <td className="py-2 px-3"><span className="font-mono text-xs text-on-surface-variant">{p.category ?? "—"}</span></td>
                    <td className="py-2 px-3 text-right font-mono text-sm text-ink-deep">{p.unitsSold.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-mono text-sm text-ink-deep">{currency(p.revenue)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs text-on-surface-variant">{currency(p.avgPrice)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs text-on-surface-variant">{p.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  function renderLogistics() {
    if (logisticsIntelligenceError) {
      return <div className="bg-error-container text-on-error-container p-6 rounded mb-8"><p className="font-body-md">Error: {logisticsIntelligenceError}</p></div>;
    }
    if (!logisticsIntelligence) return null;
    const l = logisticsIntelligence;
    const criticalExpiry = l.expiryHeatmap.filter((e) => e.status === "critical" || e.status === "expired");

    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Batches", value: l.logisticsSummary.totalBatches },
            { label: "Stock Value", value: currency(l.logisticsSummary.totalStockValue) },
            { label: "Out-of-Stock Branches", value: l.logisticsSummary.outOfStockBranches, danger: l.logisticsSummary.outOfStockBranches > 0 },
            { label: "Avg Days to Expiry", value: `${l.logisticsSummary.avgDaysToExpiry}d` },
            { label: "Expiring <=90d", value: l.stockAlertsSummary.totalExpiring, danger: l.stockAlertsSummary.totalExpiring > 0 },
            { label: "Low Stock Items", value: l.stockAlertsSummary.totalLowStock, danger: l.stockAlertsSummary.totalLowStock > 0 },
            { label: "Avg Batches/Branch", value: l.logisticsSummary.avgBatchesPerBranch },
            { label: "Reorder Alerts", value: l.reorderRecommendations.filter((r) => r.urgency !== "ok").length, danger: true },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`font-headline-sm text-headline-sm mt-1 ${s.danger ? "text-error" : "text-ink-deep"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Expiry Heatmap — Critical Batches</p>
            {criticalExpiry.length === 0 ? (
              <p className="text-on-surface-variant">No critical expiry batches. All clear!</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {criticalExpiry.slice(0, 30).map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                    <div className="min-w-0 mr-3">
                      <p className="font-body-sm text-on-surface truncate">{e.genericName}</p>
                      <p className="font-mono text-xs text-on-surface-variant">{e.branchName} · {e.category ?? "—"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-mono text-sm font-semibold ${e.status === "expired" ? "text-error" : "text-amber-600"}`}>
                        {e.status === "expired" ? "EXPIRED" : `${e.daysUntilExpiry}d`}
                      </p>
                      <p className="font-mono text-xs text-on-surface-variant">qty: {e.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Expiry Distribution</p>
            {l.stockAlertsSummary.expiringBatches.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={l.stockAlertsSummary.expiringBatches}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="daysUntil" tickFormatter={(v) => `${v}d`} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#B3261E" name="Batches" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-on-surface-variant">No expiry data.</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Out-of-Stock Products</p>
            {l.stockAlertsSummary.outOfStockProducts.length === 0 ? (
              <p className="text-on-surface-variant">No out-of-stock products.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {l.stockAlertsSummary.outOfStockProducts.slice(0, 20).map((p) => (
                  <div key={p.productId} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                    <p className="font-body-sm text-on-surface">{p.genericName}</p>
                    <span className="font-mono text-xs text-error font-semibold">{p.branchCount} branches</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Low Stock (&lt;10 units)</p>
            {l.stockAlertsSummary.lowStockProducts.length === 0 ? (
              <p className="text-on-surface-variant">No low-stock products.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {l.stockAlertsSummary.lowStockProducts.slice(0, 20).map((p) => (
                  <div key={p.productId} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                    <p className="font-body-sm text-on-surface">{p.genericName}</p>
                    <span className="font-mono text-xs text-amber-600 font-semibold">~{p.avgQuantity} avg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant p-6 mb-8">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Reorder Recommendations</p>
          {l.reorderRecommendations.filter((r) => r.urgency !== "ok").length === 0 ? (
            <p className="text-on-surface-variant">No reorder recommendations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-outline-variant">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">Product</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">Category</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Daily Use</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Stock</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Days Left</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Reorder Pt</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Urgency</th>
                </tr></thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {l.reorderRecommendations.filter((r) => r.urgency !== "ok").slice(0, 25).map((r) => (
                    <tr key={r.productId} className="hover:bg-surface-container-low/50">
                      <td className="py-2 px-3 font-body-sm text-on-surface">{r.genericName}</td>
                      <td className="py-2 px-3 font-mono text-xs text-on-surface-variant">{r.category ?? "—"}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-ink-deep">{r.avgDailyUsage}/d</td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-ink-deep">{r.currentStock}</td>
                      <td className={`py-2 px-3 text-right font-mono text-sm font-semibold ${r.daysOfStockRemaining < 7 ? "text-error" : "text-amber-600"}`}>{r.daysOfStockRemaining}d</td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-on-surface-variant">{r.reorderPoint}</td>
                      <td className="py-2 px-3 text-right"><span className={`font-mono text-xs px-2 py-0.5 rounded font-semibold ${r.urgency === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{r.urgency}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {l.stockMovements.length > 0 && (
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Recent Stock Movements ({l.stockMovements.length} total)</p>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {l.stockMovements.slice(0, 50).map((m, i) => (
                <div key={i} className="flex items-center gap-4 py-1.5 border-b border-outline-variant/10 last:border-0 text-xs">
                  <span className="font-mono text-on-surface-variant w-20 flex-shrink-0">{m.date}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${m.movementType === "sale" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{m.movementType}</span>
                  <span className="font-body-sm text-on-surface flex-1 truncate">{m.genericName}</span>
                  <span className="font-mono text-on-surface-variant">{m.branchName}</span>
                  <span className="font-mono text-ink-deep">x{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderUsers() {
    if (userActivityError) {
      return <div className="bg-error-container text-on-error-container p-6 rounded mb-8"><p className="font-body-md">Error: {userActivityError}</p></div>;
    }
    if (!userActivity) return null;
    const u = userActivity;

    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Installs", value: u.installStats.totalInstalls },
            { label: "Active Installs", value: u.installStats.activeInstalls, success: true },
            { label: "Total Operators", value: u.operatorStats.totalOperators },
            { label: "DAU / WAU", value: `${u.dauWauMetrics.dau} / ${u.dauWauMetrics.wau}` },
            { label: "DAU/WAU Ratio", value: u.dauWauMetrics.dauWauRatio.toFixed(2) },
            { label: "Peak Hour", value: `${u.sessionInsights.peakHour}:00` },
            { label: "Most Active Day", value: u.sessionInsights.mostActiveDay },
            { label: "Avg Actions/User", value: u.sessionInsights.avgActionsPerSession },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`font-headline-sm text-headline-sm mt-1 ${s.success ? "text-success" : "text-ink-deep"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Windows", value: u.installStats.windowsInstalls, color: "#0061A4" },
            { label: "macOS", value: u.installStats.macInstalls, color: "#6750A4" },
            { label: "Linux", value: u.installStats.linuxInstalls, color: "#146C2E" },
          ].map((s) => (
            <div key={s.label} className="bg-surface-base border border-outline-variant p-5">
              <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label} Installs</p>
              <p className="font-headline-md text-headline-md mt-1" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Operator Roles</p>
            {u.operatorStats.byRole.length === 0 ? <p className="text-on-surface-variant">No operator data.</p> : (
              <div className="flex flex-col gap-3">
                {u.operatorStats.byRole.map((r) => (
                  <div key={r.role} className="flex items-center justify-between">
                    <span className="font-body-sm text-on-surface capitalize">{r.role}</span>
                    <span className="font-headline-md text-headline-md text-ink-deep">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-base border border-outline-variant p-6">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Hourly Activity (24h)</p>
            {u.dauWauMetrics.hourlyActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={u.dauWauMetrics.hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="actions" fill={CHART_COLORS[0]} name="Actions" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-on-surface-variant">No hourly data.</p>}
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant p-6 mb-8">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Top 20 Operators by Activity</p>
          {u.operatorStats.topOperatorsByActivity.length === 0 ? <p className="text-on-surface-variant">No operator activity.</p> : (
            <div className="flex flex-col gap-2">
              {u.operatorStats.topOperatorsByActivity.slice(0, 20).map((op, i) => {
                const max = u.operatorStats.topOperatorsByActivity[0]?.actionCount ?? 1;
                return (
                  <div key={op.operatorId} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-on-surface-variant w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-0.5">
                        <span className="font-body-sm text-on-surface truncate">{op.name}</span>
                        <span className="font-mono text-xs text-on-surface-variant ml-2">{op.actionCount} actions</span>
                      </div>
                      <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((op.actionCount / max) * 100)}%` }} />
                      </div>
                      <p className="font-mono text-xs text-on-surface-variant">{op.branchName}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-surface-base border border-outline-variant p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">User Activity Trail</p>
          {u.userActivityTrail.length === 0 ? <p className="text-on-surface-variant">No user activity recorded.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-outline-variant">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">Operator</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">Account</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">Branch</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">Role</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Actions</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-on-surface-variant">Last Seen</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant">Recent</th>
                </tr></thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {u.userActivityTrail.map((u) => (
                    <tr key={u.userId} className="hover:bg-surface-container-low/50">
                      <td className="py-2 px-3 font-body-sm text-on-surface">{u.name}</td>
                      <td className="py-2 px-3 font-mono text-xs text-on-surface-variant">{u.accountName}</td>
                      <td className="py-2 px-3 font-mono text-xs text-on-surface-variant">{u.branchName}</td>
                      <td className="py-2 px-3"><span className="font-mono text-xs capitalize text-on-surface-variant">{u.role}</span></td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-ink-deep font-semibold">{u.actionCount}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-on-surface-variant">{new Date(u.lastSeen).toLocaleString()}</td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {u.recentActions.slice(0, 3).map((a, i) => (
                            <span key={i} className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant truncate max-w-[100px]" title={a.action}>
                              {a.action}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  async function handleGenerateReport() {
    setGeneratingReport(true);
    try {
      const result = await generateIntelligenceReport({
        from_date: reportFromDate || undefined,
        to_date: reportToDate || undefined,
        region: reportRegion || undefined,
        sections: reportSections as ("summary" | "revenue" | "products" | "users" | "logistics")[],
      });
      if (result.error) {
        setToast({ message: result.error, type: "error" });
      } else if (result.data) {
        const blob = new Blob([result.data], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cervos-intel-report-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setToast({ message: "Report downloaded.", type: "success" });
      }
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleExportHtml() {
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/reports/intelligence/html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: reportSections }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setToast({ message: err.error ?? "Export failed", type: "error" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cervos-intel-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ message: "Interactive HTML report downloaded.", type: "success" });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Export failed", type: "error" });
    } finally {
      setGeneratingReport(false);
    }
  }

  function renderReports() {
    const ALL_SECTIONS = [
      { key: "summary", label: "Network Summary" },
      { key: "revenue", label: "Revenue & Suppliers" },
      { key: "products", label: "Top Products" },
      { key: "logistics", label: "Logistics & Expiry" },
      { key: "users", label: "User Activity" },
    ];

    return (
      <>
        <div className="bg-surface-base border border-outline-variant rounded-xl p-6 mb-8">
          <h2 className="font-headline-md text-headline-md text-ink-deep mb-4">Generate Intelligence Report</h2>
          <p className="font-body-sm text-on-surface-variant mb-6">
            Filter and download a comprehensive intelligence report. Reports include all selected sections with the latest data from the network.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">From Date</label>
              <input type="date" value={reportFromDate} onChange={(e) => setReportFromDate(e.target.value)} className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">To Date</label>
              <input type="date" value={reportToDate} onChange={(e) => setReportToDate(e.target.value)} className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Region Filter</label>
              <input type="text" value={reportRegion} onChange={(e) => setReportRegion(e.target.value)} placeholder="e.g. Dar es Salaam" className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-on-surface-variant mb-2">Sections to Include</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setReportSections((prev) => prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key])}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${reportSections.includes(s.key) ? "bg-primary text-on-primary" : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={generatingReport || reportSections.length === 0}
            className="px-6 py-3 rounded-md bg-primary text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generatingReport ? "Generating..." : "Generate & Download Report"}
          </button>
          <button
            onClick={handleExportHtml}
            disabled={generatingReport || reportSections.length === 0}
            className="px-6 py-3 rounded-md border border-primary text-primary font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {generatingReport ? "Exporting..." : "Export as Interactive HTML"}
          </button>
        </div>

        <div className="bg-surface-base border border-outline-variant rounded-xl p-6">
          <h2 className="font-headline-md text-headline-md text-ink-deep mb-4">Quick Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Full Network Report", sections: ["summary", "revenue", "products", "logistics", "users"], desc: "Everything — all sections" },
              { label: "Revenue & Market", sections: ["summary", "revenue", "products"], desc: "Revenue, suppliers, products" },
              { label: "Operations & Logistics", sections: ["summary", "logistics", "users"], desc: "Stock, expiry, user activity" },
              { label: "Executive Summary", sections: ["summary"], desc: "High-level network overview" },
              { label: "Product Deep Dive", sections: ["products"], desc: "Top products analysis only" },
              { label: "User Audit Trail", sections: ["users"], desc: "Operator activity only" },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={async () => {
                  setReportSections(preset.sections);
                  setGeneratingReport(true);
                  try {
                    const result = await generateIntelligenceReport({
                      from_date: reportFromDate || undefined,
                      to_date: reportToDate || undefined,
                      region: reportRegion || undefined,
                      sections: preset.sections as ("summary" | "revenue" | "products" | "users" | "logistics")[],
                    });
                    if (result.data) {
                      const blob = new Blob([result.data], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `cervos-${preset.label.toLowerCase().replace(/ /g, "-")}-${new Date().toISOString().slice(0, 10)}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setToast({ message: `${preset.label} downloaded.`, type: "success" });
                    } else if (result.error) {
                      setToast({ message: result.error, type: "error" });
                    }
                  } finally {
                    setGeneratingReport(false);
                  }
                }}
                disabled={generatingReport}
                className="text-left p-4 rounded-xl border border-outline-variant hover:border-primary/50 hover:bg-surface-container-low transition-all disabled:opacity-50"
              >
                <p className="font-label-md text-label-md text-on-surface font-semibold mb-1">{preset.label}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{preset.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-8 border-b border-outline-variant pb-4">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-label-md text-label-md transition-colors ${
              activeTab === tab
                ? "bg-primary text-on-primary"
                : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "overview" && renderOverview()}
      {activeTab === "sync" && renderSyncHealth()}
      {activeTab === "engagement" && renderEngagement()}
      {activeTab === "revenue" && renderRevenue()}
      {activeTab === "network" && renderNetwork()}
      {activeTab === "branch" && renderBranch()}
      {activeTab === "market" && renderMarket()}
      {activeTab === "logistics" && renderLogistics()}
      {activeTab === "users" && renderUsers()}
      {activeTab === "reports" && renderReports()}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
