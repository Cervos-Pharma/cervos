/**
 * @route POST /api/reports/intelligence/html
 * @description Generates a self-contained HTML intelligence report with embedded
 *   data — no external DB calls at render time. All data is serialized as JSON
 *   and embedded in the page so it works offline / as a shared artifact.
 *   Includes inline CSS for print, interactive charts (Chart.js via CDN), and
 *   a Leaflet 2D map of branch locations.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkIpRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  getIntelligenceOverview,
  getBranchIntelligenceMetrics,
  getNetworkHealthMetrics,
  getRevenueMetrics,
  getLogisticsIntelligence,
  getUserActivityMetrics,
} from "@/lib/actions/hq";
import type {
  IntelligenceOverview,
  BranchIntelligenceMetrics,
  NetworkHealthMetrics,
  RevenueMetrics,
  LogisticsMetrics,
  UserActivityMetrics,
} from "@/lib/actions/hq";

interface ReportRequest {
  from_date?: string;
  to_date?: string;
  region?: string;
  sections: string[];
}

export async function POST(req: NextRequest) {
  // Report generation is expensive (multi-table aggregations) — throttle hard.
  const rl = checkIpRateLimit(req, "intel-report", 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  try {
    const body: ReportRequest = await req.json();
    const { sections = ["summary"] } = body;

    const periodDays = 30;
    const [
      overviewResult,
      branchResult,
      networkResult,
      revenueResult,
      logisticsResult,
      userResult,
    ] = await Promise.all([
      getIntelligenceOverview(periodDays),
      getBranchIntelligenceMetrics(periodDays),
      getNetworkHealthMetrics(),
      getRevenueMetrics(periodDays),
      getLogisticsIntelligence(periodDays),
      getUserActivityMetrics(periodDays),
    ]);

    const overview: IntelligenceOverview | null = overviewResult.data;
    const branch: BranchIntelligenceMetrics | null = branchResult.data;
    const network: NetworkHealthMetrics | null = networkResult.data;
    const revenue: RevenueMetrics | null = revenueResult.data;
    const logistics: LogisticsMetrics | null = logisticsResult.data;
    const users: UserActivityMetrics | null = userResult.data;

    const embedded = {
      generatedAt: new Date().toISOString(),
      periodDays,
      overview,
      branch,
      network,
      revenue,
      logistics,
      users,
    };

    const html = buildHtmlReport(embedded, sections);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="cervos-intel-${new Date().toISOString().slice(0, 10)}.html"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Report generation failed" },
      { status: 500 }
    );
  }
}

function buildHtmlReport(data: {
  generatedAt: string;
  periodDays: number;
  overview: IntelligenceOverview | null;
  branch: BranchIntelligenceMetrics | null;
  network: NetworkHealthMetrics | null;
  revenue: RevenueMetrics | null;
  logistics: LogisticsMetrics | null;
  users: UserActivityMetrics | null;
}, sections: string[]): string {
  const json = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cervos Intelligence Report — ${new Date(data.generatedAt).toLocaleDateString()}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1c1b1f; background: #f8f7ff; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }

    .header { background: linear-gradient(135deg, #6750A4, #9747FF); color: white; padding: 40px; border-radius: 16px; margin-bottom: 32px; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header p { opacity: 0.85; font-size: 14px; }

    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e7e0ec; }
    .card h2 { font-size: 18px; font-weight: 600; color: #1c1b1f; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #6750A4; }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-box { background: white; border: 1px solid #e7e0ec; border-radius: 10px; padding: 20px; }
    .stat-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #49454f; margin-bottom: 6px; }
    .stat-box .value { font-size: 28px; font-weight: 700; color: #1c1b1f; }
    .stat-box .sub { font-size: 12px; color: #79747e; margin-top: 2px; }
    .stat-box.danger .value { color: #b3261e; }
    .stat-box.success .value { color: #146c2e; }

    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #f8f7ff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #49454f; border-bottom: 2px solid #e7e0ec; }
    td { padding: 10px 12px; border-bottom: 1px solid #e7e0ec; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8f7ff; }
    .mono { font-family: 'Consolas', monospace; font-size: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-critical { background: #f9dede; color: #b3261e; }
    .badge-warning { background: #fff0c2; color: #7d5260; }
    .badge-ok { background: #dff2e8; color: #146c2e; }

    .chart-wrap { position: relative; height: 260px; margin-top: 12px; }
    #map { height: 400px; border-radius: 10px; border: 1px solid #e7e0ec; }

    .section-header { font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #6750A4; font-weight: 700; margin: 28px 0 12px; }

    @media print {
      body { background: white; }
      .card { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; }
      .container { padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
<div class="container" id="report">

  <div class="header">
    <h1>Cervos Pharmacy OS — Intelligence Report</h1>
    <p>Generated: ${new Date(data.generatedAt).toLocaleString()} &nbsp;|&nbsp; Period: Last ${data.periodDays} days</p>
  </div>

  ${buildSummarySection(data.overview)}

  ${sections.includes("branch") ? buildBranchSection(data.branch) : ""}
  ${sections.includes("network") ? buildNetworkSection(data.network) : ""}
  ${sections.includes("revenue") ? buildRevenueSection(data.revenue) : ""}
  ${sections.includes("logistics") ? buildLogisticsSection(data.logistics) : ""}
  ${sections.includes("users") ? buildUsersSection(data.users) : ""}

  <div class="card no-print" style="text-align:center; margin-top: 40px;">
    <p style="color:#79747e; font-size: 13px;">Cervos Intelligence Report — Generated automatically from live data</p>
    <button onclick="window.print()" style="margin-top:12px; padding: 10px 24px; background:#6750A4; color: white; border: none; border-radius: 8px; cursor:pointer; font-size: 14px;">Print / Save as PDF</button>
  </div>

</div>

<script>window.__CERVIOS_DATA__ = ${json};</script>
<script>
// ── Render charts once DOM is ready ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const d = window.__CERVIOS_DATA__;

  // Revenue trend
  if (d.revenue?.revenueByDay?.length) {
    new Chart(document.getElementById('revenueTrend'), {
      type: 'line',
      data: {
        labels: d.revenue.revenueByDay.map(r => r.date.slice(5)),
        datasets: [{ label: 'Revenue (TZS)', data: d.revenue.revenueByDay.map(r => r.amount), borderColor: '#6750A4', tension: 0.3, fill: false, pointRadius: 2 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  // Expiry distribution
  if (d.logistics?.stockAlertsSummary?.expiringBatches?.length) {
    new Chart(document.getElementById('expiryDist'), {
      type: 'bar',
      data: {
        labels: d.logistics.stockAlertsSummary.expiringBatches.map(b => ("" + b.daysUntil + "d")),
        datasets: [{ label: 'Batches', data: d.logistics.stockAlertsSummary.expiringBatches.map(b => b.count), backgroundColor: '#b3261e' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  // 2D Leaflet map
  if (d.branch?.branchLocations?.length) {
    const valid = d.branch.branchLocations.filter(b => b.lat && b.lng);
    if (valid.length > 0) {
      const map = L.map('branchMap').setView([-6.7924, 39.2083], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
      const maxR = Math.max(...valid.map(b => b.revenue), 1);
      valid.forEach(b => {
        const r = Math.max(4, Math.min(20, (b.revenue / maxR) * 20));
        const color = b.revenue > maxR * 0.5 ? '#146C2E' : b.revenue > maxR * 0.2 ? '#0061A4' : '#B3261E';
        L.circleMarker([b.lat, b.lng], { radius: r, fillColor: color, color: '#fff', weight: 1.5, fillOpacity: 0.75 })
          .bindPopup(\`<strong>\${b.branchName}</strong><br/><span style="color:#666">\${b.accountName}</span><br/>TZS \${b.revenue.toLocaleString()}\`)
          .addTo(map);
      });
      if (valid.length > 1) {
        const group = L.featureGroup(valid.map(b => L.circleMarker([b.lat, b.lng], { radius: 0.1, interactive: false })));
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }

  // Network status pie
  if (d.network) {
    const nc = d.network;
    new Chart(document.getElementById('networkPie'), {
      type: 'doughnut',
      data: {
        labels: ['Healthy', 'At Risk', 'Locked'],
        datasets: [{ data: [nc.healthyStatus, nc.atRiskStatus, nc.lockedStatus], backgroundColor: ['#146C2E', '#B3261E', '#7D5260'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
});
</script>
</body>
</html>`;
}

function buildSummarySection(overview: IntelligenceOverview | null): string {
  if (!overview) return '<div class="card"><p class="mono">No overview data available.</p></div>';
  const s = overview.totals;
  const p = overview.period;
  return `
  <div class="section-header">Network Summary</div>
  <div class="stats-grid">
    <div class="stat-box"><div class="label">Total Accounts</div><div class="value">${s.accounts}</div><div class="sub">${s.pharmacies} pharm · ${s.suppliers} supp</div></div>
    <div class="stat-box"><div class="label">Branches</div><div class="value">${s.branches}</div><div class="sub">${s.lockedBranches} locked</div></div>
    <div class="stat-box"><div class="label">Operators</div><div class="value">${s.operators}</div></div>
    <div class="stat-box"><div class="label">Installs</div><div class="value">${s.installs}</div></div>
    <div class="stat-box"><div class="label">Quote Requests</div><div class="value">${p?.quoteRequests ?? 0}</div></div>
    <div class="stat-box"><div class="label">Sales Revenue</div><div class="value">TZS ${((p?.salesRevenue ?? 0) / 1000000).toFixed(1)}M</div><div class="sub">${p?.sales ?? 0} transactions</div></div>
    <div class="stat-box${(p?.supportTickets ?? 0) > 10 ? " danger" : ""}"><div class="label">Support Tickets</div><div class="value">${p?.supportTickets ?? 0}</div><div class="sub">${p?.openSupportTickets ?? 0} open</div></div>
    <div class="stat-box"><div class="label">New Accounts</div><div class="value">${p?.newAccounts ?? 0}</div></div>
  </div>`;
}

function buildBranchSection(branch: BranchIntelligenceMetrics | null): string {
  if (!branch) return "";
  const risk = branch.expiryRisk;
  const alerts = branch.stockAlerts;
  const hasMap = branch.branchLocations?.some(b => b.lat && b.lng);
  return `
  <div class="page-break"></div>
  <div class="section-header">Branch Intelligence</div>

  <div class="stats-grid">
    <div class="stat-box${alerts.totalOutOfStock > 0 ? " danger" : ""}"><div class="label">Out of Stock Items</div><div class="value">${alerts.totalOutOfStock}</div></div>
    <div class="stat-box${risk.expiringIn30Days > 0 ? " danger" : ""}"><div class="label">Expiring ≤30d</div><div class="value">${risk.expiringIn30Days}</div></div>
    <div class="stat-box${risk.expired > 0 ? " danger" : ""}"><div class="label">Expired Batches</div><div class="value">${risk.expired}</div></div>
    <div class="stat-box"><div class="label">Low Stock Items</div><div class="value">${alerts.totalLowStock}</div></div>
  </div>

  ${hasMap ? `<div class="card"><h2>Branch Locations Map</h2><div id="branchMap"></div></div>` : ""}

  <div class="card"><h2>Top 10 Branches by Revenue</h2>
    <table>
      <thead><tr><th>#</th><th>Branch</th><th>Account</th><th>Revenue</th><th>Transactions</th></tr></thead>
      <tbody>
        ${branch.topBranchesByRevenue.slice(0, 10).map((b, i) => `
        <tr><td class="mono">${i + 1}</td><td>${b.branchName}</td><td class="mono">${b.accountName}</td>
          <td class="mono">TZS ${b.revenue.toLocaleString()}</td><td class="mono">${b.transactionCount}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>

  <div class="card"><h2>Expiry Risk</h2>
    <table>
      <thead><tr><th>Branch</th><th>Account</th><th>Expiring Batches</th><th>Days Until Expiry</th></tr></thead>
      <tbody>
        ${risk.atRiskBranches.slice(0, 20).map(b => `
        <tr><td>${b.branchName}</td><td class="mono">${b.accountName}</td>
          <td class="mono">${b.expiringBatches}</td>
          <td><span class="badge ${b.daysUntilExpiry <= 0 ? "badge-critical" : "badge-warning"}">${b.daysUntilExpiry <= 0 ? "EXPIRED" : `${b.daysUntilExpiry}d`}</span></td></tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

function buildNetworkSection(network: NetworkHealthMetrics | null): string {
  if (!network) return "";
  return `
  <div class="page-break"></div>
  <div class="section-header">Network Health</div>
  <div class="stats-grid">
    <div class="stat-box"><div class="label">Total Branches</div><div class="value">${network.totalBranches}</div></div>
    <div class="stat-box success"><div class="label">Online Now</div><div class="value">${network.onlineNow}</div></div>
    <div class="stat-box success"><div class="label">Healthy</div><div class="value">${network.healthyStatus}</div></div>
    <div class="stat-box${network.atRiskStatus > 0 ? " danger" : ""}"><div class="label">At Risk</div><div class="value">${network.atRiskStatus}</div></div>
    <div class="stat-box${network.lockedStatus > 0 ? " danger" : ""}"><div class="label">Locked</div><div class="value">${network.lockedStatus}</div></div>
    <div class="stat-box"><div class="label">Avg Batches/Branch</div><div class="value">${network.avgBatchesPerBranch}</div></div>
    <div class="stat-box${network.expiringBatchesThisMonth > 0 ? " danger" : ""}"><div class="label">Expiring (30d)</div><div class="value">${network.expiringBatchesThisMonth}</div></div>
    <div class="stat-box"><div class="label">Out of Stock</div><div class="value">${network.outOfStockProducts}</div></div>
  </div>
  <div class="card"><h2>Network Status Distribution</h2><div class="chart-wrap"><canvas id="networkPie"></canvas></div></div>`;
}

function buildRevenueSection(revenue: RevenueMetrics | null): string {
  if (!revenue) return "";
  return `
  <div class="page-break"></div>
  <div class="section-header">Revenue</div>
  <div class="stats-grid">
    <div class="stat-box"><div class="label">Total Revenue</div><div class="value">TZS ${(revenue.totalRevenue / 1000000).toFixed(1)}M</div></div>
    <div class="stat-box"><div class="label">MTD Revenue</div><div class="value">TZS ${(revenue.mtdRevenue / 1000000).toFixed(1)}M</div></div>
    <div class="stat-box"><div class="label">YTD Revenue</div><div class="value">TZS ${(revenue.ytdRevenue / 1000000).toFixed(1)}M</div></div>
    <div class="stat-box"><div class="label">Avg Order Value</div><div class="value">TZS ${(revenue.avgOrderValue / 1000).toFixed(0)}K</div></div>
    <div class="stat-box"><div class="label">Total Orders</div><div class="value">${revenue.totalOrders}</div></div>
  </div>
  <div class="card"><h2>Revenue Trend</h2><div class="chart-wrap"><canvas id="revenueTrend"></canvas></div></div>
  ${revenue.topAccountsByRevenue.length > 0 ? `<div class="card"><h2>Top 10 Accounts by Revenue</h2>
    <table><thead><tr><th>#</th><th>Account</th><th>Revenue</th></tr></thead><tbody>
      ${revenue.topAccountsByRevenue.slice(0, 10).map((a, i) => `<tr><td class="mono">${i+1}</td><td>${a.name}</td><td class="mono">TZS ${a.revenue.toLocaleString()}</td></tr>`).join("")}
    </tbody></table></div>` : ""}`;
}

function buildLogisticsSection(logistics: LogisticsMetrics | null): string {
  if (!logistics) return "";
  const l = logistics;
  return `
  <div class="page-break"></div>
  <div class="section-header">Logistics & Expiry</div>
  <div class="stats-grid">
    <div class="stat-box"><div class="label">Total Batches</div><div class="value">${l.logisticsSummary.totalBatches}</div></div>
    <div class="stat-box"><div class="label">Stock Value</div><div class="value">TZS ${(l.logisticsSummary.totalStockValue / 1000000).toFixed(1)}M</div></div>
    <div class="stat-box${l.logisticsSummary.outOfStockBranches > 0 ? " danger" : ""}"><div class="label">Out-of-Stock Branches</div><div class="value">${l.logisticsSummary.outOfStockBranches}</div></div>
    <div class="stat-box"><div class="label">Avg Days to Expiry</div><div class="value">${l.logisticsSummary.avgDaysToExpiry}d</div></div>
    <div class="stat-box${l.stockAlertsSummary.totalExpiring > 0 ? " danger" : ""}"><div class="label">Expiring ≤90d</div><div class="value">${l.stockAlertsSummary.totalExpiring}</div></div>
    <div class="stat-box${l.stockAlertsSummary.totalLowStock > 0 ? " warning" : ""}"><div class="label">Low Stock Items</div><div class="value">${l.stockAlertsSummary.totalLowStock}</div></div>
    <div class="stat-box${l.reorderRecommendations.filter(r => r.urgency !== "ok").length > 0 ? " danger" : "success"}"><div class="label">Reorder Alerts</div><div class="value">${l.reorderRecommendations.filter(r => r.urgency !== "ok").length}</div></div>
  </div>
  <div class="card"><h2>Expiry Distribution</h2><div class="chart-wrap"><canvas id="expiryDist"></canvas></div></div>
  ${l.reorderRecommendations.filter(r => r.urgency !== "ok").length > 0 ? `<div class="card"><h2>Reorder Recommendations</h2>
    <table><thead><tr><th>Product</th><th>Category</th><th>Daily Use</th><th>Stock</th><th>Days Left</th><th>Reorder Pt</th><th>Urgency</th></tr></thead><tbody>
      ${l.reorderRecommendations.filter(r => r.urgency !== "ok").slice(0, 20).map(r => `
        <tr><td>${r.genericName}</td><td class="mono">${r.category ?? "—"}</td><td class="mono">${r.avgDailyUsage}/d</td>
          <td class="mono">${r.currentStock}</td>
          <td class="mono ${r.daysOfStockRemaining < 7 ? "danger" : ""}">${r.daysOfStockRemaining}d</td>
          <td class="mono">${r.reorderPoint}</td>
          <td><span class="badge ${r.urgency === "critical" ? "badge-critical" : "badge-warning"}">${r.urgency}</span></td></tr>`).join("")}
    </tbody></table></div>` : ""}`;
}

function buildUsersSection(users: UserActivityMetrics | null): string {
  if (!users) return "";
  const u = users;
  return `
  <div class="page-break"></div>
  <div class="section-header">User Activity</div>
  <div class="stats-grid">
    <div class="stat-box"><div class="label">Total Installs</div><div class="value">${u.installStats.totalInstalls}</div></div>
    <div class="stat-box success"><div class="label">Active Installs</div><div class="value">${u.installStats.activeInstalls}</div></div>
    <div class="stat-box"><div class="label">Total Operators</div><div class="value">${u.operatorStats.totalOperators}</div></div>
    <div class="stat-box"><div class="label">DAU / WAU</div><div class="value">${u.dauWauMetrics.dau} / ${u.dauWauMetrics.wau}</div></div>
    <div class="stat-box"><div class="label">Peak Hour</div><div class="value">${u.sessionInsights.peakHour}:00</div></div>
    <div class="stat-box"><div class="label">Avg Actions/Session</div><div class="value">${u.sessionInsights.avgActionsPerSession}</div></div>
  </div>`;
}
