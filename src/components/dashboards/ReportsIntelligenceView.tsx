"use client";

import { useMemo, useState } from "react";
import { formatTzs } from "@cervos/core";
import { arrayToCSV, downloadCSV, exportCleanPdfReport } from "@/lib/export";
import type { ProfileCapabilities } from "@/lib/workspace/permissions";
import {
  classifyReorderUrgency,
  detectSalesAnomalies,
  holtLinearForecast,
  linearTrendRegression,
  mineBasketAffinities,
} from "@/lib/workspace/edge-ml";
import {
  branchComparison,
  buildDailySeries,
  businessHealthScore,
  comparePeriods,
  expiryRiskProjection,
  forecastRevenue,
  generateInsights,
  hourWeekHeatmap,
  inventoryValuation,
  paymentMix,
  productIntelligence,
  profitAndLoss,
  staffPerformance,
  supplierSpend,
  type IntelBatch,
  type IntelExpense,
  type IntelOrder,
  type IntelSale,
  type LotRisk,
  type ProductIntel,
  type ReportView,
} from "@/lib/workspace/intelligence";

export type ExtendedReportView = ReportView | "my_perf";

export interface ReportProfileMeta {
  id: string;
  username?: string;
  displayName: string;
  role: string;
  centreId: string;
  capabilities?: ProfileCapabilities;
}

interface ReportsIntelligenceViewProps {
  activeView: ExtendedReportView;
  onSelectView: (view: ExtendedReportView) => void;
  onNavigateTab: (tab: "overview" | "operations" | "inventory" | "network" | "billing" | "team") => void;
  onSwitchCentre?: (centreId: string) => void;
  orgName: string;
  orgLogoUrl?: string | null;
  activeCentreName: string;
  activeProfileId?: string;
  activeProfileName?: string;
  activeProfileRole?: string;
  capabilities?: ProfileCapabilities;
  profiles?: ReportProfileMeta[];
  sales: IntelSale[];
  batches: IntelBatch[];
  orders: IntelOrder[];
  expenses: IntelExpense[];
  centres: Array<{ id: string; name: string }>;
  activeCentreId?: string;
  accent: string;
  isDark: boolean;
  isSw: boolean;
}

const SUB_TABS: Array<{ id: ExtendedReportView; label: string; swLabel: string; orgOnly?: boolean; financeOnly?: boolean }> = [
  { id: "brief", label: "Business Summary", swLabel: "Muhtasari wa Biashara", orgOnly: true },
  { id: "sales", label: "Sales & Rush Hours", swLabel: "Mauzo & Saa za Kilele", orgOnly: true },
  { id: "products", label: "Products & Profit", swLabel: "Bidhaa & Faida", orgOnly: true },
  { id: "stock", label: "Expiry Risk", swLabel: "Hatari ya Kuisha Muda", orgOnly: true },
  { id: "people", label: "Team & Branches", swLabel: "Timu & Matawi", orgOnly: true },
  { id: "procurement", label: "Suppliers & P&L", swLabel: "Wasambazaji & Faida Halisi", orgOnly: true, financeOnly: true },
  { id: "my_perf", label: "My Performance", swLabel: "Utendaji Wangu" },
];

const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_SW = ["J3", "J4", "J5", "Alh", "Ij", "Jmos", "Jpili"];

type SelectedDetail =
  | { kind: "product"; item: ProductIntel }
  | { kind: "lot"; item: LotRisk }
  | { kind: "staff"; item: ReturnType<typeof staffPerformance>[number] }
  | { kind: "branch"; item: ReturnType<typeof branchComparison>[number] }
  | { kind: "supplier"; item: ReturnType<typeof supplierSpend>[number] }
  | null;

export default function ReportsIntelligenceView({
  activeView: rawActiveView,
  onSelectView,
  onNavigateTab,
  onSwitchCentre,
  orgName,
  orgLogoUrl,
  activeCentreName,
  activeProfileId,
  activeProfileName,
  activeProfileRole,
  capabilities,
  profiles = [],
  sales,
  batches,
  orders,
  expenses,
  centres,
  activeCentreId,
  accent,
  isDark,
  isSw,
}: ReportsIntelligenceViewProps) {
  const canViewOrg = capabilities ? capabilities.canViewOrgReports : true;
  const canViewFinance = capabilities ? capabilities.canViewFinance : true;
  const canExport = capabilities ? capabilities.canExportReports : true;
  const effectiveView: ExtendedReportView = !canViewOrg ? "my_perf" : rawActiveView;

  const [windowDays, setWindowDays] = useState<14 | 30>(30);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [compareBranchA, setCompareBranchA] = useState<string>("");
  const [compareBranchB, setCompareBranchB] = useState<string>("");
  const [hoverProdChartIdx, setHoverProdChartIdx] = useState<number | null>(null);
  const [hoverWfIdx, setHoverWfIdx] = useState<number | null>(null);

  // Pre-export prompt state (asks format, preferred language & plain-language summary toggle)
  const [exportModalMode, setExportModalMode] = useState<"csv" | "pdf" | null>(null);
  const [exportLang, setExportLang] = useState<"EN" | "SW">(isSw ? "SW" : "EN");
  const [includeNarrative, setIncludeNarrative] = useState(true);

  // Hover point explanation states
  const [hoverDayIdx, setHoverDayIdx] = useState<number | null>(null);
  const [hoverForecastIdx, setHoverForecastIdx] = useState<number | null>(null);
  const [hoverHeatCell, setHoverHeatCell] = useState<{ day: number; hour: number; value: number } | null>(null);
  const [hoverCatName, setHoverCatName] = useState<string | null>(null);
  const [hoverBucketIdx, setHoverBucketIdx] = useState<number | null>(null);

  // Listing detail inspector
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail>(null);

  const scopedSales = useMemo(
    () => (branchFilter === "all" ? sales : sales.filter((s) => s.centreId === branchFilter)),
    [sales, branchFilter]
  );
  const scopedBatches = useMemo(
    () => (branchFilter === "all" ? batches : batches.filter((b) => b.centreId === branchFilter)),
    [batches, branchFilter]
  );

  // Operator's own personal sales & performance (accessible even when Org Reports is restricted)
  const mySales = useMemo(() => {
    const matched = sales.filter(
      (s) =>
        (activeProfileId && s.profileId === activeProfileId) ||
        (activeProfileName && s.actorName.toLowerCase() === activeProfileName.toLowerCase())
    );
    return matched.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [sales, activeProfileId, activeProfileName]);

  const myStats = useMemo(() => {
    const totalRev = mySales.reduce((acc, s) => acc + s.totalTzs, 0);
    const totalUnits = mySales.reduce((acc, s) => acc + (s.itemCount || 1), 0);
    const rxTx = mySales.filter((s) => Boolean(s.prescriptionRef)).length;
    const avgBasket = mySales.length > 0 ? Math.round(totalRev / mySales.length) : 0;
    const prodTally = new Map<string, { brand: string; qty: number; rev: number }>();
    for (const s of mySales) {
      for (const ln of s.lines ?? []) {
        const prev = prodTally.get(ln.productId) ?? { brand: ln.brandName, qty: 0, rev: 0 };
        prev.qty += ln.qty;
        prev.rev += ln.qty * ln.unitPriceTzs;
        prodTally.set(ln.productId, prev);
      }
    }
    const topProducts = Array.from(prodTally.values()).sort((a, b) => b.rev - a.rev).slice(0, 5);
    return {
      totalRev,
      totalUnits,
      txCount: mySales.length,
      rxPct: mySales.length > 0 ? Math.round((rxTx / mySales.length) * 100) : 0,
      avgBasket,
      topProducts,
      daily: buildDailySeries(mySales, windowDays),
    };
  }, [mySales, windowDays]);

  const fmt = (n: number) => formatTzs(n);

  const series = useMemo(() => buildDailySeries(scopedSales, windowDays), [scopedSales, windowDays]);
  const full30 = useMemo(() => buildDailySeries(scopedSales, 30), [scopedSales]);
  const rev7 = useMemo(() => comparePeriods(full30, 7, "revenue"), [full30]);
  const profit7 = useMemo(() => comparePeriods(full30, 7, "profit"), [full30]);
  const seasonalForecast = useMemo(() => forecastRevenue(full30, 7), [full30]);
  const heat = useMemo(() => hourWeekHeatmap(scopedSales), [scopedSales]);

  // Lightweight On-Device Edge ML Engine calculations
  const holtForecast = useMemo(() => holtLinearForecast(full30, 7), [full30]);
  const trendOls = useMemo(() => linearTrendRegression(series), [series]);
  const anomalies = useMemo(() => detectSalesAnomalies(series, 2.1), [series]);
  const affinities = useMemo(() => mineBasketAffinities(scopedSales, 2), [scopedSales]);

  const products = useMemo(
    () => productIntelligence(scopedSales, scopedBatches, { windowDays }),
    [scopedSales, scopedBatches, windowDays]
  );
  const urgencyList = useMemo(() => classifyReorderUrgency(products), [products]);
  const velocityMap = useMemo(() => new Map(products.map((p) => [p.productId, p.velocityPerDay])), [products]);
  const lotRisk = useMemo(() => expiryRiskProjection(scopedBatches, velocityMap), [scopedBatches, velocityMap]);
  const valuation = useMemo(() => inventoryValuation(scopedBatches), [scopedBatches]);
  const mix = useMemo(() => paymentMix(scopedSales), [scopedSales]);
  const staff = useMemo(() => staffPerformance(scopedSales), [scopedSales]);
  const branches = useMemo(() => branchComparison(sales, batches, centres), [sales, batches, centres]);
  const suppliers = useMemo(() => supplierSpend(orders), [orders]);
  const pnl = useMemo(
    () => profitAndLoss(scopedSales, expenses, { days: windowDays, subscriptionMonthlyTzs: 45000 }),
    [scopedSales, expenses, windowDays]
  );

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { category: string; revenue: number; profit: number; units: number }>();
    for (const p of products) {
      const prev = map.get(p.category) ?? { category: p.category, revenue: 0, profit: 0, units: 0 };
      prev.revenue += p.revenue;
      prev.profit += p.grossProfit;
      prev.units += p.unitsSold;
      map.set(p.category, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [products]);

  const heldEscrowTzs = useMemo(
    () => orders.filter((o) => o.escrowStatus === "escrow_held").reduce((s, o) => s + o.totalTzs, 0),
    [orders]
  );

  const digitalSharePct = useMemo(() => {
    const digital = mix.filter((m) => m.method !== "cash").reduce((s, m) => s + m.sharePct, 0);
    return Math.round(digital);
  }, [mix]);

  const health = useMemo(
    () =>
      businessHealthScore({
        grossMarginPct: pnl.grossMarginPct,
        revenueDeltaPct: rev7.deltaPct,
        writeOffTzs: lotRisk.projectedWriteOffTzs,
        stockAtCost: valuation.atCost,
        stockoutRiskCount: products.filter((p) => p.status === "stockout_risk").length,
        productCount: products.length,
        digitalSharePct,
      }),
    [pnl.grossMarginPct, rev7.deltaPct, lotRisk.projectedWriteOffTzs, valuation.atCost, products, digitalSharePct]
  );

  const insights = useMemo(
    () =>
      generateInsights({
        products,
        lotRisk,
        revenue7: rev7,
        heat,
        mix,
        staff,
        heldEscrowTzs,
        fmt,
      }),
    [products, lotRisk, rev7, heat, mix, staff, heldEscrowTzs]
  );

  const cardCls = isDark
    ? "bg-[#11161F]/95 border-slate-800/90 text-slate-100 shadow-lg"
    : "bg-white border-[#EAECF0] text-[#111317] shadow-[0_6px_28px_rgba(15,23,42,0.035)]";
  const mutedCls = isDark ? "text-slate-400" : "text-[#8B929E]";
  const chipCls = isDark
    ? "bg-[#171D28] border-slate-800 text-slate-200"
    : "bg-[#F8FAFC] border-[#EAECF0] text-[#111317]";

  const healthComponentLabel = (key: string) => {
    if (!isSw) return key;
    if (key === "Margin") return "Faida ya Mauzo";
    if (key === "Growth") return "Ukuaji";
    if (key === "Stock freshness") return "Upya wa Stoo";
    if (key === "Availability") return "Upatikanaji Dawa";
    return "Malipo ya Kidijitali";
  };

  const healthGradeLabel = (grade: string) => {
    if (!isSw) return grade;
    if (grade === "Excellent") return "Bora Sana";
    if (grade === "Strong") return "Nzuri";
    if (grade === "Fair") return "Wastani";
    return "Inahitaji Umakini";
  };

  const statusLabel = (st: ProductIntel["status"]) => {
    if (!isSw) {
      if (st === "stockout_risk") return "Low Soon";
      if (st === "dead_stock") return "No Sales 30d";
      if (st === "overstock") return "Extra Stock";
      return "Healthy";
    }
    if (st === "stockout_risk") return "Inaisha Karibu";
    if (st === "dead_stock") return "Haijauzwa 30d";
    if (st === "overstock") return "Stoo Nyingi";
    return "Nzuri";
  };

  const buildNaturalLanguageNarrative = (lang: "EN" | "SW", staffActor?: string) => {
    const sw = lang === "SW";
    if (staffActor) {
      const targetSales = sales.filter((s) => s.actorName === staffActor);
      const rev = targetSales.reduce((acc, s) => acc + s.totalTzs, 0);
      const rx = targetSales.filter((s) => Boolean(s.prescriptionRef)).length;
      return sw
        ? `${staffActor} ametoa risiti ${targetSales.length} zenye jumla ya ${fmt(rev)} (${rx} za cheti cha daktari). Takwimu hizi zinatoka kwenye kumbukumbu za moja kwa moja za kaunta.`
        : `${staffActor} issued ${targetSales.length} receipt(s) totaling ${fmt(rev)} (${rx} prescription-verified). Figures reflect live verified counter activity.`;
    }
    if (effectiveView === "my_perf") {
      return sw
        ? `${activeProfileName || "Mhudumu"} ameuza ${fmt(myStats.totalRev)} kupitia risiti ${myStats.txCount} (wastani ${fmt(myStats.avgBasket)} kwa risiti) katika siku ${windowDays} zilizopita.`
        : `${activeProfileName || "Operator"} completed ${myStats.txCount} receipt(s) totaling ${fmt(myStats.totalRev)} (average basket ${fmt(myStats.avgBasket)}) over ${windowDays} days.`;
    }
    if (effectiveView === "stock") {
      return sw
        ? `Thamani ya stoo iliyopo ni ${fmt(valuation.atRetail)}. Kuna takriban ${fmt(lotRisk.projectedWriteOffTzs)} hatarini kupotea iwapo dawa za siku 30 hazitauzwa mapema.`
        : `Active stock sits at ${fmt(valuation.atRetail)} retail value. Velocity modeling flags ${fmt(lotRisk.projectedWriteOffTzs)} at 30-day expiry risk unless rotated via FEFO or transferred.`;
    }
    return sw
      ? `Katika siku ${windowDays} zilizopita, ${orgName} (${activeCentreName}) imeuza ${fmt(pnl.revenue)} kwa faida ghafi ya ${pnl.grossMarginPct}% (faida halisi ${fmt(pnl.netProfit)}). Afya ya biashara ni ${health.total}/100 (${healthGradeLabel(health.grade)}).`
      : `Over the last ${windowDays} days, ${orgName} (${activeCentreName}) recorded ${fmt(pnl.revenue)} in counter sales at a ${pnl.grossMarginPct}% gross margin (net ${fmt(pnl.netProfit)}). Shop Health stands at ${health.total}/100 (${health.grade}).`;
  };

  const runConfirmedExport = (mode: "csv" | "pdf", chosenLang: "EN" | "SW", withNarrative: boolean) => {
    const sw = chosenLang === "SW";
    if (mode === "csv") {
      if (effectiveView === "my_perf") {
        const csv = arrayToCSV(
          mySales.map((s) => ({
            Receipt: s.id,
            Date: s.createdAt.slice(0, 16).replace("T", " "),
            Method: s.paymentMethod.toUpperCase(),
            Items: s.itemCount,
            Total: s.totalTzs,
            RxRef: s.prescriptionRef || "-",
          })),
          [
            { key: "Receipt", header: sw ? "Namba ya Risiti" : "Receipt ID" },
            { key: "Date", header: sw ? "Tarehe" : "Date" },
            { key: "Method", header: sw ? "Njia ya Malipo" : "Payment" },
            { key: "Items", header: sw ? "Idadi" : "Items" },
            { key: "Total", header: sw ? "Jumla (TZS)" : "Total (TZS)" },
            { key: "RxRef", header: sw ? "Cheti (Rx)" : "Rx Ref" },
          ]
        );
        downloadCSV(csv, `cervos-my-shift-${chosenLang.toLowerCase()}.csv`);
        return;
      }

      if (effectiveView === "products") {
        const csv = arrayToCSV(
          products.map((p) => ({
            Brand: p.brandName,
            Generic: p.genericName,
            Tier: p.abcClass === "A" ? (sw ? "Kundi A (80%)" : "Top 80% (A)") : p.abcClass,
            Sold: p.unitsSold,
            Revenue: p.revenue,
            Profit: p.grossProfit,
            Margin: `${p.marginPct}%`,
            PerDay: p.velocityPerDay,
            OnHand: p.onHand,
            DaysLeft: p.daysOfCover ?? (sw ? "Nyingi" : "Plenty"),
            Reorder: p.reorderQty,
          })),
          [
            { key: "Brand", header: sw ? "Dawa" : "Medicine" },
            { key: "Generic", header: sw ? "Jina la Kisayansi" : "Generic" },
            { key: "Tier", header: sw ? "Daraja la Mauzo" : "Sales Tier" },
            { key: "Sold", header: sw ? "Zilizouzwa" : "Units Sold" },
            { key: "Revenue", header: sw ? "Mapato (TZS)" : "Revenue (TZS)" },
            { key: "Profit", header: sw ? "Faida (TZS)" : "Profit (TZS)" },
            { key: "Margin", header: sw ? "Asilimia Faida" : "Profit %" },
            { key: "PerDay", header: sw ? "Kwa Siku" : "Sold / Day" },
            { key: "OnHand", header: sw ? "Zilizopo" : "In Stock" },
            { key: "DaysLeft", header: sw ? "Siku Zilizobaki" : "Days Left" },
            { key: "Reorder", header: sw ? "Agiza Tena" : "Order Qty" },
          ]
        );
        downloadCSV(csv, `cervos-products-${windowDays}d-${chosenLang.toLowerCase()}.csv`);
        return;
      }

      if (effectiveView === "stock") {
        const csv = arrayToCSV(
          lotRisk.lots.map((l) => ({
            Brand: l.brandName,
            Batch: l.batchNumber,
            Qty: l.quantity,
            Expiry: l.expiryDate,
            DaysLeft: l.daysToExpiry,
            ProjSold: l.projectedSold,
            AtRisk: l.atRiskUnits,
            LossTzs: l.atRiskValueTzs,
          })),
          [
            { key: "Brand", header: sw ? "Dawa" : "Medicine" },
            { key: "Batch", header: sw ? "Namba ya Kundi" : "Batch" },
            { key: "Qty", header: sw ? "Idadi Iliyopo" : "In Stock" },
            { key: "Expiry", header: sw ? "Tarehe ya Kuisha" : "Expiry Date" },
            { key: "DaysLeft", header: sw ? "Siku Zilizobaki" : "Days Left" },
            { key: "ProjSold", header: sw ? "Zinazotarajiwa Kuuzwa" : "Likely Sold" },
            { key: "AtRisk", header: sw ? "Zitakazobaki Hatari" : "Unsold Risk Units" },
            { key: "LossTzs", header: sw ? "Hasara Tarajiwa (TZS)" : "Est. Loss Risk (TZS)" },
          ]
        );
        downloadCSV(csv, `cervos-expiry-risk-${chosenLang.toLowerCase()}.csv`);
        return;
      }

      const csv = arrayToCSV(
        series.map((d) => ({
          Date: d.date,
          Revenue: d.revenue,
          Cost: d.cogs,
          Profit: d.profit,
          Receipts: d.tx,
          Units: d.units,
        })),
        [
          { key: "Date", header: sw ? "Tarehe" : "Date" },
          { key: "Revenue", header: sw ? "Mauzo (TZS)" : "Sales (TZS)" },
          { key: "Cost", header: sw ? "Gharama ya Dawa (TZS)" : "Stock Cost (TZS)" },
          { key: "Profit", header: sw ? "Faida Ghafi (TZS)" : "Gross Profit (TZS)" },
          { key: "Receipts", header: sw ? "Risiti" : "Receipts" },
          { key: "Units", header: sw ? "Pakiti" : "Packs" },
        ]
      );
      downloadCSV(csv, `cervos-sales-${windowDays}d-${chosenLang.toLowerCase()}.csv`);
      return;
    }

    const branchTitle =
      branchFilter === "all"
        ? sw ? `Matawi Yote (${centres.length})` : `All Branches (${centres.length})`
        : centres.find((c) => c.id === branchFilter)?.name || activeCentreName;

    const currentTabObj = SUB_TABS.find((t) => t.id === effectiveView) ?? SUB_TABS[0];

    const tables =
      effectiveView === "my_perf"
        ? [
            {
              title: sw ? "Risiti Zangu za Hivi Karibuni" : "My Recent Counter Receipts",
              headers: sw ? ["Tarehe", "Njia", "Vitu", "Jumla (TZS)", "Cheti"] : ["Date", "Payment", "Items", "Total (TZS)", "Rx Ref"],
              rows: mySales.slice(0, 20).map((s) => [
                s.createdAt.slice(0, 16).replace("T", " "),
                s.paymentMethod.toUpperCase(),
                String(s.itemCount),
                fmt(s.totalTzs),
                s.prescriptionRef || "-",
              ]),
            },
          ]
        : effectiveView === "products"
          ? [
              {
                title: sw ? "Bidhaa, Faida & Kiasi cha Kuagiza" : "Product Margins, Pace & Reorder Plan",
                headers: sw
                  ? ["Dawa", "Daraja", "Zimeuzwa", "Mapato", "Faida %", "Kwa Siku", "Siku Zilizobaki", "Agiza"]
                  : ["Medicine", "Tier", "Sold", "Sales", "Profit %", "Per Day", "Days Left", "Reorder"],
                rows: products.map((p) => [
                  p.brandName,
                  p.abcClass,
                  String(p.unitsSold),
                  fmt(p.revenue),
                  `${p.marginPct}%`,
                  `${p.velocityPerDay}`,
                  p.daysOfCover === null ? "-" : `${p.daysOfCover}d`,
                  p.reorderQty > 0 ? `+${p.reorderQty}` : "-",
                ]),
              },
            ]
          : effectiveView === "stock"
            ? [
                {
                  title: sw ? "Makundi Yaliyo Hatarini Kuisha Muda" : "FEFO Expiry Write-Off Exposure by Batch",
                  headers: sw
                    ? ["Dawa (Batch)", "Kuisha", "Siku", "Zipo", "Zitauzwa", "Zitakazoharibika", "Hasara (TZS)"]
                    : ["Medicine (Batch)", "Expiry", "Days Left", "In Stock", "Likely Sold", "At Risk", "Est. Loss"],
                  rows: lotRisk.lots.map((l) => [
                    `${l.brandName} (${l.batchNumber})`,
                    l.expiryDate,
                    `${l.daysToExpiry}d`,
                    String(l.quantity),
                    String(l.projectedSold),
                    String(l.atRiskUnits),
                    fmt(l.atRiskValueTzs),
                  ]),
                },
              ]
            : effectiveView === "people"
              ? [
                  {
                    title: sw ? "Utendaji wa Timu ya Kaunta" : "Staff Counter Performance",
                    headers: sw ? ["Mfanyakazi", "Risiti", "Wastani Risiti", "Mauzo", "Faida"] : ["Staff", "Receipts", "Avg Basket", "Sales", "Profit"],
                    rows: staff.map((s) => [s.actor, String(s.tx), fmt(s.aov), fmt(s.revenue), fmt(s.profit)]),
                  },
                  {
                    title: sw ? "Ulinganisho wa Matawi" : "Branch Comparison",
                    headers: sw ? ["Tawi", "Mauzo", "Faida %", "Thamani Stoo", "Mzunguko"] : ["Branch", "Sales", "Margin %", "Stock Cost", "Turn/Yr"],
                    rows: branches.map((b) => [b.name, fmt(b.revenue), `${b.marginPct}%`, fmt(b.stockAtCost), `${b.turnover}x`]),
                  },
                ]
              : [
                  {
                    title: sw ? "Taarifa ya Faida na Hasara (P&L)" : `${windowDays}-Day Profit & Loss Statement`,
                    headers: sw ? ["Kipengele", "Kiasi (TZS)"] : ["Line Item", "Amount (TZS)"],
                    rows: [
                      [sw ? "Mapato ya Mauzo" : "Counter Sales Revenue", fmt(pnl.revenue)],
                      [sw ? "Gharama ya Dawa (COGS)" : "Cost of Stock Sold", `-${fmt(pnl.cogs)}`],
                      [sw ? `Faida Ghafi (${pnl.grossMarginPct}%)` : `Gross Profit (${pnl.grossMarginPct}%)`, fmt(pnl.grossProfit)],
                      [sw ? "Gharama za Uendeshaji & Mpango" : "Operating Bills & Plan", `-${fmt(pnl.opex)}`],
                      [sw ? `Faida Halisi (${pnl.netMarginPct}%)` : `Net Operating Profit (${pnl.netMarginPct}%)`, fmt(pnl.netProfit)],
                      [sw ? "Kiwango cha Kuuza Kila Siku Kufidia Gharama" : "Daily Break-Even Target", pnl.breakEvenDailyRevenue ? `${fmt(pnl.breakEvenDailyRevenue)}/day` : "-"],
                    ],
                  },
                ];

    const metrics =
      effectiveView === "my_perf"
        ? [
            { label: sw ? "Mauzo Yangu" : "My Sales", value: fmt(myStats.totalRev), hint: `${myStats.txCount} tx` },
            { label: sw ? "Pakiti Nilizouza" : "Units Sold", value: String(myStats.totalUnits) },
            { label: sw ? "Wastani wa Risiti" : "Avg Basket", value: fmt(myStats.avgBasket) },
            { label: sw ? "Cheti (Rx)" : "Rx Share", value: `${myStats.rxPct}%` },
          ]
        : [
            {
              label: sw ? "Mapato" : "Total Sales",
              value: fmt(pnl.revenue),
              hint: `${pnl.grossMarginPct}% ${sw ? "faida ghafi" : "gross margin"}`,
            },
            {
              label: sw ? "Faida Halisi" : "Net Profit",
              value: fmt(pnl.netProfit),
              hint: `${sw ? "Baada ya matumizi" : "After expenses"}`,
            },
            {
              label: sw ? "Afya ya Duka" : "Shop Health",
              value: `${health.total}/100`,
              hint: sw ? healthGradeLabel(health.grade) : health.grade,
            },
            {
              label: sw ? "Hatari Kuisha Muda" : "Expiry Risk",
              value: fmt(lotRisk.projectedWriteOffTzs),
              hint: sw ? "Dawa zisipouzwa kabla ya muda" : "Projected unsold exposure",
            },
          ];

    exportCleanPdfReport({
      orgName,
      logoDataUrl: orgLogoUrl,
      branchName: branchTitle,
      title: sw ? currentTabObj.swLabel : currentTabObj.label,
      subtitle: sw
        ? `Ripoti ya siku ${windowDays} · Akili ya Ndani ya Kifaa`
        : `${windowDays}-Day Clean Operational Statement · On-Device Edge ML`,
      generatedLabel: new Date().toISOString().slice(0, 16).replace("T", " "),
      lang: chosenLang,
      narrative: withNarrative ? buildNaturalLanguageNarrative(chosenLang) : undefined,
      metrics,
      highlights: withNarrative
        ? effectiveView === "my_perf"
          ? myStats.topProducts.slice(0, 3).map((tp) => `${tp.brand}: ${tp.qty} packs (${fmt(tp.rev)})`)
          : [
              ...insights.slice(0, 3).map((i) => `${i.title}: ${i.detail}`),
              trendOls.direction === "rising"
                ? sw
                  ? `Uchambuzi wa kifaa: Mauzo yanaongezeka takriban ${fmt(trendOls.slopePerDayTzs)} kwa siku.`
                  : `Edge trend: Daily sales rising by ~${fmt(trendOls.slopePerDayTzs)} per day.`
                : sw
                  ? `Uchambuzi wa kifaa: Wastani wa mauzo ni ${fmt(trendOls.meanDailyTzs)} kwa siku.`
                  : `Edge trend: Steady baseline averaging ${fmt(trendOls.meanDailyTzs)}/day.`,
            ]
        : undefined,
      tables,
    });
  };

  const exportOperatorStatement = (actorName: string) => {
    const chosen: "EN" | "SW" = isSw ? "SW" : "EN";
    const sw = chosen === "SW";
    const actorSales = sales.filter((s) => s.actorName === actorName);
    const total = actorSales.reduce((a, s) => a + s.totalTzs, 0);
    const units = actorSales.reduce((a, s) => a + (s.itemCount || 1), 0);
    const avg = actorSales.length > 0 ? Math.round(total / actorSales.length) : 0;
    exportCleanPdfReport({
      orgName,
      logoDataUrl: orgLogoUrl,
      branchName: activeCentreName,
      title: sw ? `Utendaji wa ${actorName}` : `Staff Report: ${actorName}`,
      subtitle: sw ? "Kumbukumbu ya zamu na mauzo ya kaunta" : "Operator profile & counter sales breakdown",
      generatedLabel: new Date().toISOString().slice(0, 16).replace("T", " "),
      lang: chosen,
      narrative: buildNaturalLanguageNarrative(chosen, actorName),
      metrics: [
        { label: sw ? "Mauzo" : "Sales", value: fmt(total) },
        { label: sw ? "Risiti" : "Receipts", value: String(actorSales.length) },
        { label: sw ? "Pakiti" : "Packs", value: String(units) },
        { label: sw ? "Wastani" : "Avg Basket", value: fmt(avg) },
      ],
      tables: [
        {
          title: sw ? "Risiti za Hivi Karibuni" : "Recent Counter Receipts",
          headers: sw ? ["Tarehe", "Njia", "Vitu", "Jumla (TZS)"] : ["Date", "Payment", "Items", "Total (TZS)"],
          rows: actorSales.slice(0, 18).map((s) => [
            s.createdAt.slice(0, 16).replace("T", " "),
            s.paymentMethod.toUpperCase(),
            String(s.itemCount),
            fmt(s.totalTzs),
          ]),
        },
      ],
    });
  };

  const navigateTarget = (target: string) => {
    if (
      target === "brief" ||
      target === "sales" ||
      target === "products" ||
      target === "stock" ||
      target === "people" ||
      target === "procurement"
    ) {
      onSelectView(target);
      return;
    }
    onNavigateTab(target as "inventory" | "network" | "operations" | "billing");
  };

  const maxDayRev = Math.max(1, ...series.map((d) => d.revenue));
  const maxHolt = Math.max(1, ...holtForecast.map((f) => f.high), ...seasonalForecast.map((f) => f.high));
  const maxCatRev = Math.max(1, ...categoryBreakdown.map((c) => c.revenue));

  const horizonBuckets = useMemo(
    () => [
      { label: isSw ? "Zimeisha Muda" : "Expired", data: lotRisk.buckets.expired, color: "#F43F5E" },
      { label: isSw ? "Siku 0-30" : "0-30 Days", data: lotRisk.buckets.d0_30, color: "#F59E0B" },
      { label: isSw ? "Siku 31-90" : "31-90 Days", data: lotRisk.buckets.d31_90, color: "#3B82F6" },
      { label: isSw ? "Siku 91-180" : "91-180 Days", data: lotRisk.buckets.d91_180, color: "#10B981" },
      { label: isSw ? "Siku 180+" : "180+ Days", data: lotRisk.buckets.d180_plus, color: "#64748B" },
    ],
    [lotRisk.buckets, isSw]
  );
  const maxBucketVal = Math.max(1, ...horizonBuckets.map((b) => b.data.valueTzs));

  return (
    <div className="space-y-4 animate-stage-pop">
      {/* Clean Top Controls Bar */}
      <div className={`rounded-[24px] border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 ${cardCls}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {SUB_TABS.filter((t) => {
            if (t.orgOnly && !canViewOrg) return false;
            if (t.financeOnly && !canViewFinance) return false;
            return true;
          }).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectView(t.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                effectiveView === t.id
                  ? "text-white shadow-xs"
                  : isDark
                    ? "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
                    : "bg-[#F3F4F6] text-[#111317] hover:bg-slate-200/70"
              }`}
              style={effectiveView === t.id ? { backgroundColor: accent } : undefined}
            >
              {isSw ? t.swLabel : t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canViewOrg && centres.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
            >
              <option value="all">{isSw ? "Matawi Yote" : "All Branches"}</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div className={`inline-flex rounded-full border p-0.5 ${chipCls}`}>
            {([14, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                  windowDays === d ? "text-white" : mutedCls
                }`}
                style={windowDays === d ? { backgroundColor: accent } : undefined}
              >
                {d}d
              </button>
            ))}
          </div>

          {canExport && (
            <>
              <button
                type="button"
                onClick={() => {
                  setExportLang(isSw ? "SW" : "EN");
                  setExportModalMode("csv");
                }}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
              >
                {isSw ? "Pakua CSV" : "Export CSV"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportLang(isSw ? "SW" : "EN");
                  setExportModalMode("pdf");
                }}
                className="px-3.5 py-1.5 rounded-full text-white text-xs font-semibold cursor-pointer shadow-xs"
                style={{ backgroundColor: accent }}
              >
                {isSw ? "Chapisha / PDF Safi" : "Clean PDF / Print"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* PRE-EXPORT PREFERENCES DIALOG (ASK FORMAT, LANG, EXPLAINER)  */}
      {/* ============================================================ */}
      {exportModalMode && (
        <div
          className={`rounded-[24px] border p-5 sm:p-6 space-y-4 animate-stage-pop ring-2 ${cardCls}`}
          style={{ borderColor: accent }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                {isSw ? "ANDAA RIPOTI YA KUTOA" : "EXPORT & LANGUAGE OPTIONS"}
              </div>
              <h3 className="text-base font-bold mt-0.5">
                {isSw
                  ? "Chagua Lugha & Maelezo ya Ripoti Kabla ya Kupakua"
                  : "Confirm Export Language & Plain-Language Narrative"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setExportModalMode(null)}
              className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
            >
              {isSw ? "Funga" : "Cancel"} &times;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className={`p-3.5 rounded-2xl border space-y-2 ${chipCls}`}>
              <div className={`text-[10px] font-bold uppercase ${mutedCls}`}>
                {isSw ? "1. Muundo wa Faili" : "1. Output Format"}
              </div>
              <div className="flex gap-2">
                {(["pdf", "csv"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setExportModalMode(m)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                      exportModalMode === m ? "text-white border-transparent" : chipCls
                    }`}
                    style={exportModalMode === m ? { backgroundColor: accent } : undefined}
                  >
                    {m === "pdf" ? (isSw ? "PDF Safi + Nembo" : "Clean PDF + Logo") : "CSV Table"}
                  </button>
                ))}
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border space-y-2 ${chipCls}`}>
              <div className={`text-[10px] font-bold uppercase ${mutedCls}`}>
                {isSw ? "2. Lugha ya Ripoti" : "2. Output Language"}
              </div>
              <div className="flex gap-2">
                {(["EN", "SW"] as const).map((lg) => (
                  <button
                    key={lg}
                    type="button"
                    onClick={() => setExportLang(lg)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                      exportLang === lg ? "text-white border-transparent" : chipCls
                    }`}
                    style={exportLang === lg ? { backgroundColor: accent } : undefined}
                  >
                    {lg === "EN" ? "English" : "Kiswahili"}
                  </button>
                ))}
              </div>
            </div>

            <label className={`p-3.5 rounded-2xl border flex items-start gap-2.5 cursor-pointer ${chipCls}`}>
              <input
                type="checkbox"
                checked={includeNarrative}
                onChange={(e) => setIncludeNarrative(e.target.checked)}
                className="mt-1 rounded"
              />
              <div>
                <div className="font-semibold">
                  {isSw ? "Ongeza Maelezo ya Lugha Rahisi" : "Include Plain-Language Explainability"}
                </div>
                <div className={`text-[10px] mt-0.5 ${mutedCls}`}>
                  {isSw
                    ? "Huongeza ufafanuzi wa Edge ML na nembo ya kampuni yako."
                    : "Embeds your company logo, plain narrative & ML takeaways."}
                </div>
              </div>
            </label>
          </div>

          <div className={`p-3 rounded-2xl border text-[11px] leading-relaxed ${chipCls} ${mutedCls}`}>
            <strong className="mr-1.5">{exportLang === "SW" ? "Hakikisho:" : "Preview Note:"}</strong>
            {buildNaturalLanguageNarrative(exportLang)}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setExportModalMode(null)}
              className={`px-4 py-2 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
            >
              {isSw ? "Ghairi" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => {
                runConfirmedExport(exportModalMode, exportLang, includeNarrative);
                setExportModalMode(null);
              }}
              className="px-5 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              {exportModalMode === "pdf"
                ? exportLang === "SW"
                  ? "Chapisha / Hifadhi PDF ->"
                  : "Print / Save Clean PDF ->"
                : exportLang === "SW"
                  ? "Pakua CSV ->"
                  : "Download CSV ->"}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* INSPECTOR DETAIL CARD MODAL (OPENS WHEN CLICKING ANY LISTING)*/}
      {/* ============================================================ */}
      {selectedDetail && (
        <div
          className={`rounded-[24px] border p-5 sm:p-6 space-y-4 animate-stage-pop ring-2 ${cardCls}`}
          style={{ borderColor: accent }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                {selectedDetail.kind === "product"
                  ? isSw ? "UCHAMBUZI WA DAWA" : "PRODUCT DETAIL CARD"
                  : selectedDetail.kind === "lot"
                    ? isSw ? "UCHAMBUZI WA KUNDI (BATCH)" : "BATCH EXPIRY CARD"
                    : selectedDetail.kind === "staff"
                      ? isSw ? "UTENDAJI WA MHUDUMU" : "STAFF PERFORMANCE CARD"
                      : selectedDetail.kind === "branch"
                        ? isSw ? "HALI YA TAWI" : "BRANCH DETAIL CARD"
                        : isSw ? "MUHTASARI WA MSAMBAZAJI" : "SUPPLIER DETAIL CARD"}
              </div>
              <h3 className="text-lg font-bold mt-0.5">
                {selectedDetail.kind === "product"
                  ? `${selectedDetail.item.brandName} (${selectedDetail.item.genericName})`
                  : selectedDetail.kind === "lot"
                    ? `${selectedDetail.item.brandName} · ${selectedDetail.item.batchNumber}`
                    : selectedDetail.kind === "staff"
                      ? selectedDetail.item.actor
                      : selectedDetail.kind === "branch"
                        ? selectedDetail.item.name
                        : selectedDetail.item.supplier}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDetail(null)}
              className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
            >
              {isSw ? "Funga" : "Close"} &times;
            </button>
          </div>

          {selectedDetail.kind === "product" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Mauzo" : "Sales"}</div>
                  <div className="font-bold text-sm mt-0.5">{fmt(selectedDetail.item.revenue)}</div>
                </div>
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Faida Iliyoingia" : "Profit Earned"}</div>
                  <div className="font-bold text-sm text-emerald-500 mt-0.5">
                    {fmt(selectedDetail.item.grossProfit)} ({selectedDetail.item.marginPct}%)
                  </div>
                </div>
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Kasi ya Uuzaji" : "Daily Pace"}</div>
                  <div className="font-bold text-sm mt-0.5">
                    {selectedDetail.item.velocityPerDay} {isSw ? "pakiti/siku" : "packs/day"}
                  </div>
                </div>
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Siku Zilizobaki" : "Stock Cover"}</div>
                  <div className="font-bold text-sm mt-0.5">
                    {selectedDetail.item.daysOfCover === null
                      ? isSw ? "Nyingi" : "Plenty"
                      : `${selectedDetail.item.daysOfCover} ${isSw ? "siku" : "days"}`}
                  </div>
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${mutedCls}`}>
                {isSw
                  ? `Dawa hii ipo Kundi ${selectedDetail.item.abcClass} na inachangia ${selectedDetail.item.revenueSharePct}% ya mauzo. Kuna pakiti ${selectedDetail.item.onHand} halali rafuni. ${
                      selectedDetail.item.reorderQty > 0
                        ? `Tunashauri kuagiza pakiti ${selectedDetail.item.reorderQty} ili kufunika wiki 3 ijayo.`
                        : "Stoo inatosha kwa wiki 3 zijazo."
                    }`
                  : `Tier ${selectedDetail.item.abcClass} item contributing ${selectedDetail.item.revenueSharePct}% of shop revenue. You currently hold ${selectedDetail.item.onHand} valid packs. ${
                      selectedDetail.item.reorderQty > 0
                        ? `Recommended restock: +${selectedDetail.item.reorderQty} packs for 21-day cover.`
                        : "Stock cover is comfortable for the next 3 weeks."
                    }`}
              </p>
              {affinities.filter((a) => a.aId === selectedDetail.item.productId || a.bId === selectedDetail.item.productId).length > 0 && (
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[11px]">
                  <strong>{isSw ? "Kawaida Huuzwa Pamoja Na:" : "Often Bought Together With:"}</strong>{" "}
                  {affinities
                    .filter((a) => a.aId === selectedDetail.item.productId || a.bId === selectedDetail.item.productId)
                    .map((a) =>
                      a.aId === selectedDetail.item.productId
                        ? `${a.bName} (${a.confidencePct}% · ${a.lift}x)`
                        : `${a.aName} (${a.confidencePct}% · ${a.lift}x)`
                    )
                    .join(", ")}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab("inventory")}
                  className="px-4 py-2 rounded-full border text-xs font-semibold cursor-pointer"
                >
                  {isSw ? "Kagua Makundi Kwenye Stoo" : "Inspect Batches"} &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab("network")}
                  className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  {isSw ? "Agiza Kwenye Bohari" : "Order Wholesale Restock"} &rarr;
                </button>
              </div>
            </div>
          )}

          {selectedDetail.kind === "lot" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Tarehe ya Kuisha" : "Expiry Date"}</div>
                  <div className="font-bold font-mono mt-0.5">{selectedDetail.item.expiryDate}</div>
                </div>
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Siku Zilizobaki" : "Days Remaining"}</div>
                  <div className="font-bold mt-0.5">{selectedDetail.item.daysToExpiry}d</div>
                </div>
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Zitauzwa Kabla ya Muda" : "Likely Sold in Time"}</div>
                  <div className="font-bold text-emerald-500 mt-0.5">{selectedDetail.item.projectedSold} packs</div>
                </div>
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Thamani Hatarini" : "At-Risk Cost"}</div>
                  <div className="font-bold text-rose-500 mt-0.5">{fmt(selectedDetail.item.atRiskValueTzs)}</div>
                </div>
              </div>
              <p className={mutedCls}>
                {isSw
                  ? "Kwa kasi ya sasa ya mauzo, pakiti zilizo hatarini zinapaswa kuwekwa mbele kwenye rafu (FEFO), kuuzwa kwa punguzo, au kuhamishiwa tawi lenye mahitaji makubwa."
                  : "Based on current daily sales velocity, unsold units before expiry should be moved to front-counter FEFO display, discounted, or transferred to another branch."}
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab("inventory")}
                className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                {isSw ? "Funga / Rekebisha Kundi Kwenye Stoo" : "Quarantine or Adjust Batch"} &rarr;
              </button>
            </div>
          )}

          {selectedDetail.kind === "staff" && (() => {
            const actor = selectedDetail.item.actor;
            const matchedProfile = profiles.find((p) => p.displayName.toLowerCase() === actor.toLowerCase());
            const actorSales = sales.filter((s) => s.actorName === actor);
            const totalReceipts = sales.length || 1;
            const sharePct = Math.round((actorSales.length / totalReceipts) * 100);
            const topProdsMap = new Map<string, number>();
            for (const s of actorSales) {
              for (const ln of s.lines ?? []) {
                topProdsMap.set(ln.brandName, (topProdsMap.get(ln.brandName) ?? 0) + ln.qty);
              }
            }
            const topProds = Array.from(topProdsMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
            const ctrName = matchedProfile
              ? centres.find((c) => c.id === matchedProfile.centreId)?.name || activeCentreName
              : activeCentreName;

            return (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {matchedProfile?.username && (
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] font-mono font-bold text-[10px]">
                        @{matchedProfile.username}
                      </span>
                    )}
                    {matchedProfile?.role && (
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] uppercase ${chipCls}`}>
                        {matchedProfile.role.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className={`text-[11px] ${mutedCls}`}>{ctrName} &middot; {sharePct}% {isSw ? "ya risiti" : "of receipts"}</span>
                  </div>
                  {canExport && (
                    <button
                      type="button"
                      onClick={() => exportOperatorStatement(actor)}
                      className="px-3.5 py-1.5 rounded-full text-white text-[11px] font-semibold cursor-pointer"
                      style={{ backgroundColor: accent }}
                    >
                      {isSw ? "Chapisha Ripoti ya Mhudumu (PDF)" : "Print Staff PDF Statement"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-2xl border ${chipCls}`}>
                    <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Jumla ya Mauzo" : "Total Sales"}</div>
                    <div className="font-bold mt-0.5">{fmt(selectedDetail.item.revenue)}</div>
                  </div>
                  <div className={`p-3 rounded-2xl border ${chipCls}`}>
                    <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Faida Iliyotengenezwa" : "Profit Generated"}</div>
                    <div className="font-bold text-emerald-500 mt-0.5">{fmt(selectedDetail.item.profit)}</div>
                  </div>
                  <div className={`p-3 rounded-2xl border ${chipCls}`}>
                    <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Idadi ya Risiti" : "Receipts Issued"}</div>
                    <div className="font-bold mt-0.5">{selectedDetail.item.tx}</div>
                  </div>
                  <div className={`p-3 rounded-2xl border ${chipCls}`}>
                    <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Wastani wa Risiti" : "Average Receipt"}</div>
                    <div className="font-bold mt-0.5">{fmt(selectedDetail.item.aov)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className={`p-3.5 rounded-2xl border space-y-1.5 ${chipCls}`}>
                    <div className={`text-[10px] font-bold uppercase ${mutedCls}`}>
                      {isSw ? "Dawa Zilizouzwa Zaidi na Mhudumu" : "Top Dispensed Medicines"}
                    </div>
                    {topProds.length === 0 ? (
                      <div className={mutedCls}>{isSw ? "Hakuna maelezo ya dawa." : "No itemized lines logged yet."}</div>
                    ) : (
                      topProds.map(([name, qty]) => (
                        <div key={name} className="flex justify-between">
                          <span className="font-medium">{name}</span>
                          <span className="font-mono font-bold">{qty}x</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className={`p-3.5 rounded-2xl border space-y-1.5 ${chipCls}`}>
                    <div className={`text-[10px] font-bold uppercase ${mutedCls}`}>
                      {isSw ? "Vibali Vilivyowashwa" : "Active Role Permissions"}
                    </div>
                    {matchedProfile?.capabilities ? (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(matchedProfile.capabilities)
                          .filter(([, allowed]) => Boolean(allowed))
                          .map(([key]) => (
                            <span key={key} className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-semibold">
                              {key.replace(/^can/, "")}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <div className={mutedCls}>{isSw ? "Kaunta & Ripoti Binafsi" : "Counter & Personal Shift Report"}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {selectedDetail.kind === "branch" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Mauzo" : "Revenue"}</div>
                  <div className="font-bold mt-0.5">{fmt(selectedDetail.item.revenue)}</div>
                </div>
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Faida Ghafi" : "Margin"}</div>
                  <div className="font-bold text-emerald-500 mt-0.5">{selectedDetail.item.marginPct}%</div>
                </div>
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Thamani ya Stoo" : "Stock at Cost"}</div>
                  <div className="font-bold mt-0.5">{fmt(selectedDetail.item.stockAtCost)}</div>
                </div>
                <div className={`p-3 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Mzunguko/Mwaka" : "Turnover/Yr"}</div>
                  <div className="font-bold mt-0.5">{selectedDetail.item.turnover}x</div>
                </div>
              </div>
              {onSwitchCentre && (
                <button
                  type="button"
                  onClick={() => onSwitchCentre(selectedDetail.item.centreId)}
                  className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  {isSw ? `Ingia ${selectedDetail.item.name}` : `Switch to ${selectedDetail.item.name}`} &rarr;
                </button>
              )}
            </div>
          )}

          {selectedDetail.kind === "supplier" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className={`p-3 rounded-2xl border ${chipCls}`}>
                <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Manunuzi Yote" : "Total Spend"}</div>
                <div className="font-bold mt-0.5">{fmt(selectedDetail.item.spend)}</div>
              </div>
              <div className={`p-3 rounded-2xl border ${chipCls}`}>
                <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Idadi ya Oda" : "Orders"}</div>
                <div className="font-bold mt-0.5">{selectedDetail.item.orders}</div>
              </div>
              <div className={`p-3 rounded-2xl border ${chipCls}`}>
                <div className={`text-[10px] ${mutedCls}`}>Kasri Held</div>
                <div className="font-bold text-amber-500 mt-0.5">{fmt(selectedDetail.item.held)}</div>
              </div>
              <div className={`p-3 rounded-2xl border ${chipCls}`}>
                <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Muda wa Kufika" : "Avg Delivery Lead"}</div>
                <div className="font-bold mt-0.5">
                  {selectedDetail.item.avgLeadDays === null ? (isSw ? "Inasubiri" : "Pending") : `${selectedDetail.item.avgLeadDays}d`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SUBPAGE: BUSINESS SUMMARY + EDGE ML BRIEF                    */}
      {/* ============================================================ */}
      {effectiveView === "brief" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-5 rounded-[24px] border p-6 flex flex-col justify-between gap-4 ${cardCls}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className={`text-[11px] uppercase tracking-wider font-semibold ${mutedCls}`}>
                    {isSw ? "Alama ya Afya ya Duka" : "Overall Shop Health Score"}
                  </div>
                  <div className="text-2xl font-bold mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                    {health.total}/100 &middot; {healthGradeLabel(health.grade)}
                  </div>
                  <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-[#E2F575] text-[#111317] text-[10px] font-bold">
                    {isSw ? "Moja kwa Moja" : "Live Health Ring"}
                  </span>
                </div>

                {/* Business Health Ring above Margin */}
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="38"
                      fill="none"
                      stroke={isDark ? "#1E293B" : "#E2E8F0"}
                      strokeWidth="9"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="38"
                      fill="none"
                      stroke={health.total >= 75 ? "#10B981" : health.total >= 50 ? accent : "#F59E0B"}
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 38}
                      strokeDashoffset={2 * Math.PI * 38 * (1 - Math.max(0, Math.min(100, health.total)) / 100)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold tabular-nums leading-none" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                      {health.total}
                    </span>
                    <span className={`text-[9px] font-bold uppercase mt-0.5 ${mutedCls}`}>/ 100</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {health.components.map((c) => (
                  <div key={c.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{healthComponentLabel(c.key)}</span>
                      <span className="font-mono font-bold tabular-nums">{c.score}%</span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${c.score}%`,
                          backgroundColor: c.score >= 70 ? "#10B981" : c.score >= 45 ? accent : "#F59E0B",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plain-Language Ranked Insights */}
            <div className={`lg:col-span-7 rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">
                    {isSw ? "Mambo Muhimu ya Kushughulikia" : "Clear Business Takeaways"}
                  </h2>
                  <p className={`text-[11px] ${mutedCls}`}>
                    {isSw
                      ? "Bonyeza hoja yoyote kufungua ukurasa wake au kuchukua hatua mara moja"
                      : "Click any card to jump directly into its report or take action"}
                  </p>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase" style={{ color: accent }}>
                  {insights.length} {isSw ? "hoja" : "signals"}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {insights.map((ins) => {
                  const tone =
                    ins.severity === "critical"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
                      : ins.severity === "warning"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                        : ins.severity === "positive"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                          : "border-blue-500/35 bg-blue-500/10 text-blue-500";
                  return (
                    <button
                      key={ins.id}
                      type="button"
                      onClick={() => navigateTarget(ins.target)}
                      className={`w-full text-left p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition-transform hover:-translate-y-0.5 cursor-pointer ${chipCls}`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${tone}`}>
                            {ins.severity}
                          </span>
                          <span className="text-xs font-bold">{ins.title}</span>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${mutedCls}`}>{ins.detail}</p>
                      </div>
                      <span className="text-xs font-semibold shrink-0" style={{ color: accent }}>
                        {ins.metric ? `${ins.metric} ` : ""}&rarr;
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* On-Device Edge ML Panel: Trend Slope, Basket Pairs & Anomaly Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-5 rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                    {isSw ? "AKILI YA KIFAA (EDGE ML)" : "ON-DEVICE EDGE ML"}
                  </div>
                  <h2 className="text-sm font-semibold mt-0.5">
                    {isSw ? "Mwelekeo wa Mauzo & Siku Zisizo za Kawaida" : "Live Trend Slope & Anomaly Check"}
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-bold">
                  Offline Ready
                </span>
              </div>

              <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${chipCls}`}>
                <div className="font-bold">
                  {trendOls.direction === "rising"
                    ? isSw ? `Mauzo Yanapanda (+${fmt(trendOls.slopePerDayTzs)}/siku)` : `Sales Rising (+${fmt(trendOls.slopePerDayTzs)}/day)`
                    : trendOls.direction === "cooling"
                      ? isSw ? `Mauzo Yanapungua (${fmt(trendOls.slopePerDayTzs)}/siku)` : `Sales Cooling (${fmt(trendOls.slopePerDayTzs)}/day)`
                      : isSw ? `Mauzo Yako Imara (~${fmt(trendOls.meanDailyTzs)}/siku)` : `Steady Pace (~${fmt(trendOls.meanDailyTzs)}/day)`}
                </div>
                <div className={`text-[11px] ${mutedCls}`}>
                  {isSw
                    ? `Kipimo cha kuaminika (R2): ${Math.round(trendOls.rSquared * 100)}%`
                    : `Linear trend confidence (R2): ${Math.round(trendOls.rSquared * 100)}% over ${windowDays}d`}
                </div>
              </div>

              {anomalies.length === 0 ? (
                <div className={`p-3 rounded-2xl border text-[11px] ${chipCls} ${mutedCls}`}>
                  {isSw
                    ? "Hakuna mabadiliko ya ghafla yasiyo ya kawaida katika kipindi hiki."
                    : "No abnormal daily sales spikes or drops detected in this period."}
                </div>
              ) : (
                <div className="space-y-2">
                  {anomalies.slice(0, 2).map((an) => (
                    <div key={an.date} className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${chipCls}`}>
                      <div>
                        <span className={`font-bold ${an.kind === "spike" ? "text-emerald-500" : "text-amber-500"}`}>
                          {an.kind === "spike" ? (isSw ? "Kilele" : "Unusual Spike") : isSw ? "Kupungua" : "Quiet Dip"} &middot; {an.date}
                        </span>
                        <div className={`text-[10px] ${mutedCls}`}>
                          {fmt(an.revenue)} vs {fmt(an.baselineTzs)} {isSw ? "kawaida" : "typical"}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] font-bold">Z={an.zScore}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Market Basket Co-Dispense Pairs (Apriori-style on-device) */}
            <div className={`lg:col-span-7 rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                    {isSw ? "UCHAMBUZI WA KIKAPU CHA MTEJA" : "ON-DEVICE BASKET PAIRING"}
                  </div>
                  <h2 className="text-sm font-semibold mt-0.5">
                    {isSw ? "Dawa Zinazonunuliwa Pamoja Mara Nyingi" : "Medicines Frequently Sold Together"}
                  </h2>
                </div>
                <span className={`text-[11px] ${mutedCls}`}>{isSw ? "Mpangilio wa rafu" : "Shelf placement guide"}</span>
              </div>

              {affinities.length === 0 ? (
                <div className={`p-4 rounded-2xl border text-xs ${chipCls} ${mutedCls}`}>
                  {isSw
                    ? "Endelea kuuza vitu vingi kwenye risiti moja ili kuona jozi zinazoendana."
                    : "Record more multi-item counter receipts to uncover cross-selling medicine pairs."}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {affinities.slice(0, 4).map((pair) => (
                    <div key={`${pair.aId}_${pair.bId}`} className={`p-3.5 rounded-2xl border text-xs space-y-1 ${chipCls}`}>
                      <div className="font-bold">
                        {pair.aName} + {pair.bName}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-500 font-semibold">
                          {pair.confidencePct}% {isSw ? "pamoja" : "together"} ({pair.pairCount}x)
                        </span>
                        <span className={`font-mono ${mutedCls}`}>{pair.lift}x lift</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Headline KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button type="button" onClick={() => onSelectView("sales")} className={`rounded-[24px] border p-5 text-left cursor-pointer ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>{isSw ? `Mauzo ya Siku ${windowDays}` : `${windowDays}-Day Total Sales`}</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {fmt(pnl.revenue)}
              </div>
              <div className="text-[11px] font-semibold mt-1 text-emerald-500">
                {isSw ? "Faida Ghafi" : "Gross Profit"} {pnl.grossMarginPct}%
              </div>
            </button>

            <button type="button" onClick={() => onSelectView("procurement")} className={`rounded-[24px] border p-5 text-left cursor-pointer ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>{isSw ? "Faida Baada ya Bili" : "Net Profit (After Bills)"}</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {fmt(pnl.netProfit)}
              </div>
              <div className={`text-[11px] mt-1 ${mutedCls}`}>
                {isSw ? "Matumizi" : "Expenses"}: {fmt(pnl.opex)}
              </div>
            </button>

            <button type="button" onClick={() => onSelectView("stock")} className={`rounded-[24px] border p-5 text-left cursor-pointer ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>{isSw ? "Thamani ya Dawa Dukani" : "Shop Stock Value (Retail)"}</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {fmt(valuation.atRetail)}
              </div>
              <div className="text-[11px] text-amber-500 font-semibold mt-1">
                {isSw ? "Hatari Kuisha Muda" : "Expiry Risk"}: {fmt(lotRisk.projectedWriteOffTzs)}
              </div>
            </button>

            <button type="button" onClick={() => onSelectView("products")} className={`rounded-[24px] border p-5 text-left cursor-pointer ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>{isSw ? "Dawa Zinazokaribia Kuisha" : "Restock Needed Soon"}</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {urgencyList.filter((u) => u.tier === "urgent" || u.tier === "soon").length} SKUs
              </div>
              <div className="text-11px font-semibold mt-1" style={{ color: accent }}>
                {isSw ? "Tazama Kiasi cha Kuagiza" : "See Order Plan"} &rarr;
              </div>
            </button>
          </div>

          {/* Side-by-Side Period & Branch Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {isSw ? "Ulinganisho: Siku 7 Hizi vs 7 Zilizopita" : "Side-by-Side: This 7 Days vs Prior 7 Days"}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    (rev7.deltaPct ?? 0) >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
                  }`}
                >
                  {rev7.deltaPct === null ? "Flat" : rev7.deltaPct >= 0 ? `+${rev7.deltaPct}%` : `${rev7.deltaPct}%`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className={`p-3.5 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Wiki Hii (Mauzo)" : "This 7d Sales"}</div>
                  <div className="text-lg font-bold tabular-nums mt-0.5">{fmt(rev7.current)}</div>
                  <div className={`text-[11px] mt-1 ${mutedCls}`}>
                    {isSw ? "Faida:" : "Profit:"} {fmt(profit7.current)}
                  </div>
                </div>
                <div className={`p-3.5 rounded-2xl border ${chipCls}`}>
                  <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Wiki Iliyopita" : "Previous 7d Sales"}</div>
                  <div className="text-lg font-bold tabular-nums mt-0.5">{fmt(rev7.previous)}</div>
                  <div className={`text-[11px] mt-1 ${mutedCls}`}>
                    {isSw ? "Faida:" : "Profit:"} {fmt(profit7.previous)}
                  </div>
                </div>
              </div>
            </div>

            <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {branches.length > 1
                    ? isSw ? "Ulinganisho wa Matawi (Sambamba)" : "Side-by-Side: Branch Performance"
                    : isSw ? "Ulinganisho wa Malipo" : "Side-by-Side: Digital vs Cash"}
                </h3>
                <button
                  type="button"
                  onClick={() => onSelectView("people")}
                  className="text-xs font-semibold hover:underline cursor-pointer"
                  style={{ color: accent }}
                >
                  {isSw ? "Zote" : "Full View"} &rarr;
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {(branches.length > 1 ? branches.slice(0, 2) : mix.slice(0, 2).map((m, i) => ({
                  centreId: m.method,
                  name: m.method.toUpperCase(),
                  revenue: m.amount,
                  marginPct: m.sharePct,
                  stockAtCost: i,
                }))).map((item) => (
                  <div key={item.centreId} className={`p-3.5 rounded-2xl border ${chipCls}`}>
                    <div className="font-bold truncate">{item.name}</div>
                    <div className="text-lg font-bold tabular-nums mt-0.5">{fmt(item.revenue)}</div>
                    <div className="text-[11px] text-emerald-500 font-semibold mt-1">
                      {branches.length > 1 ? `${item.marginPct}% ${isSw ? "faida" : "margin"}` : `${item.marginPct}% share`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUBPAGE: SALES, HOVER CHARTS, HEATMAP & HOLT FORECAST        */}
      {/* ============================================================ */}
      {effectiveView === "sales" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Interactive 30d Daily Revenue & Profit Chart with Hover Point Explainer */}
            <div className={`lg:col-span-8 rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {isSw ? `Mauzo na Faida ya Siku ${windowDays}` : `${windowDays}-Day Sales vs Profit Earned`}
                  </h2>
                  <p className={`text-[11px] ${mutedCls}`}>
                    {isSw ? "Wiki hii vs iliyopita:" : "This week vs last:"}{" "}
                    <strong className={rev7.deltaPct !== null && rev7.deltaPct >= 0 ? "text-emerald-500" : "text-amber-500"}>
                      {rev7.deltaPct === null ? "-" : `${rev7.deltaPct >= 0 ? "+" : ""}${rev7.deltaPct}%`}
                    </strong>{" "}
                    &middot; {isSw ? "Faida:" : "Profit:"}{" "}
                    <strong>{profit7.deltaPct === null ? "-" : `${profit7.deltaPct >= 0 ? "+" : ""}${profit7.deltaPct}%`}</strong>
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums">{fmt(pnl.revenue)}</span>
              </div>

              {/* Hover Point Explanation Banner */}
              <div className={`px-3.5 py-2 rounded-2xl border text-[11px] flex flex-wrap items-center justify-between gap-2 ${chipCls}`}>
                {hoverDayIdx !== null && series[hoverDayIdx] ? (
                  <>
                    <span>
                      <strong>{series[hoverDayIdx].date}</strong> &middot;{" "}
                      {isSw
                        ? `Mauzo ${fmt(series[hoverDayIdx].revenue)} (${series[hoverDayIdx].tx} risiti, pakiti ${series[hoverDayIdx].units})`
                        : `Sold ${fmt(series[hoverDayIdx].revenue)} across ${series[hoverDayIdx].tx} receipts (${series[hoverDayIdx].units} packs)`}
                    </span>
                    <span className="font-bold text-emerald-500">
                      {isSw ? "Faida:" : "Profit Earned:"} {fmt(series[hoverDayIdx].profit)}
                    </span>
                  </>
                ) : (
                  <span className={mutedCls}>
                    {isSw
                      ? "Weka mshale juu ya nguzo yoyote kuona maelezo ya siku hiyo."
                      : "Hover over any day bar below for exact sales, receipt count, and profit earned."}
                  </span>
                )}
              </div>

              <div className="flex items-end gap-1 h-44 pt-2">
                {series.map((d, idx) => {
                  const hPct = Math.max(4, Math.round((d.revenue / maxDayRev) * 100));
                  const pPct = Math.max(2, Math.round((d.profit / maxDayRev) * 100));
                  const active = hoverDayIdx === idx;
                  return (
                    <div
                      key={d.date}
                      onMouseEnter={() => setHoverDayIdx(idx)}
                      onMouseLeave={() => setHoverDayIdx(null)}
                      className="flex-1 h-full flex flex-col justify-end items-center gap-1 cursor-crosshair"
                    >
                      <div className="w-full h-full flex items-end justify-center">
                        <div
                          className={`w-full max-w-[16px] rounded-t-md relative overflow-hidden transition-all duration-200 ${
                            active ? "scale-x-125 ring-2 ring-[#E2F575]" : ""
                          }`}
                          style={{
                            height: `${hPct}%`,
                            backgroundColor: isDark ? "rgba(56,189,248,0.28)" : "rgba(16,57,185,0.22)",
                          }}
                        >
                          <div
                            className="absolute bottom-0 inset-x-0 rounded-t-sm"
                            style={{
                              height: `${Math.min(100, Math.round((pPct / Math.max(1, hPct)) * 100))}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={`flex items-center justify-between text-[10px] font-mono ${mutedCls}`}>
                <span>{series[0]?.date}</span>
                <span>{isSw ? "Kijani/Bluu = Faida · Kivuli = Mauzo Yote" : "Solid Fill = Profit Earned · Tint = Total Sales"}</span>
                <span>{series[series.length - 1]?.date}</span>
              </div>
            </div>

            {/* 7-Day Holt ML Forecast + Hover Band */}
            <div className={`lg:col-span-4 rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <div>
                <h2 className="text-sm font-semibold">
                  {isSw ? "Utabiri wa Siku 7 Zijazo (Holt ML)" : "Next 7 Days Forecast (Edge ML)"}
                </h2>
                <p className={`text-[11px] ${mutedCls}`}>
                  {isSw ? "Weka mshale kuona kiwango cha juu na chini" : "Hover a day to inspect predicted range"}
                </p>
              </div>
              <div className="space-y-2">
                {holtForecast.map((f, idx) => {
                  const wPct = Math.max(12, Math.round((f.predicted / maxHolt) * 100));
                  const seas = seasonalForecast[idx];
                  const isHov = hoverForecastIdx === idx;
                  return (
                    <div
                      key={f.date}
                      onMouseEnter={() => setHoverForecastIdx(idx)}
                      onMouseLeave={() => setHoverForecastIdx(null)}
                      className={`p-2 rounded-xl transition-colors cursor-default ${isHov ? chipCls : ""}`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium font-mono text-[11px]">{f.date.slice(5)}</span>
                        <span className="font-semibold tabular-nums">{fmt(f.predicted)}</span>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden mt-1 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                        <div className="h-full rounded-full" style={{ width: `${wPct}%`, backgroundColor: accent }} />
                      </div>
                      {isHov && (
                        <div className={`text-[10px] mt-1 ${mutedCls}`}>
                          {isSw
                            ? `Kiwango: ${fmt(f.low)} - ${fmt(f.high)} (Msimu: ${fmt(seas?.expected ?? f.predicted)})`
                            : `Likely band: ${fmt(f.low)} - ${fmt(f.high)} (Weekday avg: ${fmt(seas?.expected ?? f.predicted)})`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Category Revenue vs Profit Comparison Chart (New Chart!) */}
          <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">
                  {isSw ? "Mauzo na Faida kwa Kundi la Dawa" : "Sales vs Profit by Medicine Category"}
                </h2>
                <p className={`text-[11px] ${mutedCls}`}>
                  {hoverCatName
                    ? (() => {
                        const c = categoryBreakdown.find((x) => x.category === hoverCatName);
                        return c
                          ? `${c.category}: ${fmt(c.revenue)} ${isSw ? "mauzo" : "sales"}, ${fmt(c.profit)} ${isSw ? "faida" : "profit"} (${c.units} ${isSw ? "pakiti" : "packs"})`
                          : "";
                      })()
                    : isSw
                      ? "Weka mshale kuona faida halisi ya kila kundi la dawa."
                      : "Hover any category to inspect exact profit margin and pack volume."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categoryBreakdown.map((c) => {
                const rW = Math.max(8, Math.round((c.revenue / maxCatRev) * 100));
                const pW = Math.max(4, Math.round((c.profit / maxCatRev) * 100));
                return (
                  <div
                    key={c.category}
                    onMouseEnter={() => setHoverCatName(c.category)}
                    onMouseLeave={() => setHoverCatName(null)}
                    className={`p-3 rounded-2xl border space-y-1.5 text-xs ${chipCls}`}
                  >
                    <div className="flex justify-between font-semibold">
                      <span>{c.category}</span>
                      <span className="tabular-nums">{fmt(c.revenue)}</span>
                    </div>
                    <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div className="h-full rounded-full opacity-35" style={{ width: `${rW}%`, backgroundColor: accent }} />
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pW}%` }} />
                    </div>
                    <div className={`text-[10px] flex justify-between ${mutedCls}`}>
                      <span>{c.units} {isSw ? "pakiti zimeuzwa" : "packs sold"}</span>
                      <span className="text-emerald-500 font-semibold">{isSw ? "Faida:" : "Profit:"} {fmt(c.profit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7 x 14 Hourly Trading Rush Heatmap + Payment Channel Donut/Bars */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-8 rounded-[24px] border p-6 space-y-3 overflow-x-auto ${cardCls}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {isSw ? "Saa za Kazi Nyingi Kaunta (J3-Jpili)" : "Busiest Counter Hours (Mon-Sun x 08:00-21:00)"}
                  </h2>
                  <p className={`text-[11px] ${mutedCls}`}>
                    {hoverHeatCell
                      ? `${(isSw ? WEEKDAYS_SW : WEEKDAYS_EN)[hoverHeatCell.day]} ${String(hoverHeatCell.hour).padStart(2, "0")}:00 -> ${fmt(hoverHeatCell.value)}`
                      : isSw
                        ? `Kilele: ${WEEKDAYS_SW[heat.peak.day]} saa ${String(heat.peak.hour).padStart(2, "0")}:00 (${fmt(heat.peak.value)}) · Weka mshale kuchunguza`
                        : `Peak slot: ${WEEKDAYS_EN[heat.peak.day]} ${String(heat.peak.hour).padStart(2, "0")}:00 (${fmt(heat.peak.value)}) · Hover cells to inspect`}
                  </p>
                </div>
              </div>
              <div className="min-w-[520px] space-y-1.5">
                <div className="grid grid-cols-[44px_repeat(14,minmax(0,1fr))] gap-1 text-[9px] font-mono text-center opacity-70">
                  <div />
                  {Array.from({ length: 14 }, (_, i) => i + heat.startHour).map((h) => (
                    <div key={h}>{String(h).padStart(2, "0")}</div>
                  ))}
                </div>
                {heat.grid.map((row, wd) => (
                  <div key={wd} className="grid grid-cols-[44px_repeat(14,minmax(0,1fr))] gap-1 items-center">
                    <div className={`text-[10px] font-semibold ${mutedCls}`}>{(isSw ? WEEKDAYS_SW : WEEKDAYS_EN)[wd]}</div>
                    {row.map((val, hi) => {
                      const intensity = val / heat.max;
                      const hr = hi + heat.startHour;
                      return (
                        <div
                          key={hi}
                          onMouseEnter={() => setHoverHeatCell({ day: wd, hour: hr, value: val })}
                          onMouseLeave={() => setHoverHeatCell(null)}
                          className="h-6 rounded-md transition-transform hover:scale-110 cursor-crosshair"
                          style={{
                            backgroundColor: val === 0 ? (isDark ? "#1E293B" : "#F1F5F9") : accent,
                            opacity: val === 0 ? 0.55 : Math.max(0.22, intensity),
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className={`lg:col-span-4 rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <h2 className="text-sm font-semibold">{isSw ? "Njia za Malipo" : "How Customers Paid"}</h2>
              <div className="space-y-2.5">
                {mix.map((m) => (
                  <div key={m.method} className={`p-3 rounded-2xl border space-y-1.5 text-xs ${chipCls}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase">{m.method}</span>
                      <span className="font-semibold tabular-nums">{fmt(m.amount)}</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div className="h-full rounded-full" style={{ width: `${m.sharePct}%`, backgroundColor: accent }} />
                    </div>
                    <div className={`text-[10px] flex justify-between ${mutedCls}`}>
                      <span>{m.tx} {isSw ? "risiti" : "receipts"}</span>
                      <span style={{ color: accent }} className="font-bold">{m.sharePct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUBPAGE: PRODUCTS, PROFIT & CLICKABLE DETAIL CARDS           */}
      {/* ============================================================ */}
      {effectiveView === "products" && (
        <div className="space-y-4">
          {/* Interactive ABC Profit Margin & Volume Visual Chart */}
          {products.length > 0 && (
            <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {isSw ? "Chati ya Faida na Kasi ya Kila Dawa" : "Product Revenue vs Margin % Chart"}
                  </h2>
                  <p className={`text-[11px] ${mutedCls}`}>
                    {isSw ? "Weka mshale kwenye nguzo kuona maelezo ya dawa." : "Hover any medicine bar to inspect revenue, margin %, and days left."}
                  </p>
                </div>
                {hoverProdChartIdx !== null && products[hoverProdChartIdx] && (
                  <span className={`px-3 py-1 rounded-full border text-[11px] font-semibold ${chipCls}`}>
                    {products[hoverProdChartIdx].brandName}: {fmt(products[hoverProdChartIdx].revenue)} &middot;{" "}
                    {products[hoverProdChartIdx].marginPct}% GM &middot;{" "}
                    {products[hoverProdChartIdx].daysOfCover ?? "Plenty"}d cover
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 items-end h-36 pt-2">
                {(() => {
                  const top6 = products.slice(0, 6);
                  const maxRev = Math.max(1, ...top6.map((x) => x.revenue));
                  return top6.map((p, idx) => (
                    <button
                      key={p.productId}
                      type="button"
                      onClick={() => setSelectedDetail({ kind: "product", item: p })}
                      onMouseEnter={() => setHoverProdChartIdx(idx)}
                      onMouseLeave={() => setHoverProdChartIdx(null)}
                      className="h-full flex flex-col justify-end items-center gap-1 cursor-pointer text-center"
                    >
                      <span className="text-[10px] font-bold text-emerald-500">{p.marginPct}%</span>
                      <div className="w-full flex-1 flex items-end justify-center">
                        <div
                          className={`w-10 rounded-t-xl transition-all duration-200 ${hoverProdChartIdx === idx ? "ring-2 ring-[#E2F575] scale-105" : ""}`}
                          style={{
                            height: `${Math.max(18, Math.round((p.revenue / maxRev) * 100))}%`,
                            backgroundColor: p.abcClass === "A" ? accent : isDark ? "#334155" : "#94A3B8",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold truncate w-full">{p.brandName}</span>
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}

          <div className={`rounded-[24px] border p-6 space-y-4 overflow-x-auto ${cardCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">
                {isSw ? "Faida, Kasi & Mipango ya Kuagiza Dawa" : "Product Sales Tiers, Profit & Restock Plan"}
              </h2>
              <p className={`text-[11px] ${mutedCls}`}>
                {isSw
                  ? "Bonyeza mstari wowote wa dawa kuona kadi yake kamili na dawa zinazoendana nayo."
                  : "Tier A brings 80% of revenue. Click any medicine row to open its full analysis card."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("network")}
              className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              {isSw ? "Agiza Kwenye Bohari" : "Open Wholesale Catalog"} &rarr;
            </button>
          </div>

          <table className="w-full min-w-[780px] text-xs">
            <thead>
              <tr className={`border-b text-left text-[10px] uppercase tracking-wider ${mutedCls}`}>
                <th className="py-2 pr-3">{isSw ? "Dawa" : "Medicine"}</th>
                <th className="py-2 px-2">{isSw ? "Daraja" : "Tier"}</th>
                <th className="py-2 px-2">{isSw ? "Zimeuzwa" : "Sold"}</th>
                <th className="py-2 px-2">{isSw ? "Mapato" : "Sales"}</th>
                <th className="py-2 px-2">{isSw ? "Faida %" : "Profit %"}</th>
                <th className="py-2 px-2">{isSw ? "Kwa Siku" : "Per Day"}</th>
                <th className="py-2 px-2">{isSw ? "Zilizo Rafuni" : "In Stock"}</th>
                <th className="py-2 px-2">{isSw ? "Siku Zilizobaki" : "Days Left"}</th>
                <th className="py-2 px-2">{isSw ? "Agiza Tena" : "Order Qty"}</th>
                <th className="py-2 pl-2">{isSw ? "Hali" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/20">
              {products.map((p) => (
                <tr
                  key={p.productId}
                  onClick={() => setSelectedDetail({ kind: "product", item: p })}
                  className="hover:bg-blue-500/8 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold underline decoration-dotted underline-offset-2">{p.brandName}</div>
                    <div className={`text-[10px] ${mutedCls}`}>{p.genericName}</div>
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.abcClass === "A"
                          ? "bg-[#E2F575] text-[#111317]"
                          : p.abcClass === "B"
                            ? "bg-blue-500/15 text-blue-500"
                            : "bg-slate-500/15 text-slate-500"
                      }`}
                    >
                      {p.abcClass}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 tabular-nums">{p.unitsSold}</td>
                  <td className="py-2.5 px-2 font-semibold tabular-nums">{fmt(p.revenue)}</td>
                  <td className="py-2.5 px-2 font-semibold text-emerald-500 tabular-nums">{p.marginPct}%</td>
                  <td className="py-2.5 px-2 tabular-nums">{p.velocityPerDay}/d</td>
                  <td className="py-2.5 px-2 tabular-nums">{p.onHand}</td>
                  <td className="py-2.5 px-2 tabular-nums">{p.daysOfCover === null ? "-" : `${p.daysOfCover}d`}</td>
                  <td className="py-2.5 px-2 font-bold tabular-nums">{p.reorderQty > 0 ? `+${p.reorderQty}` : "-"}</td>
                  <td className="py-2.5 pl-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === "stockout_risk"
                          ? "bg-rose-500/15 text-rose-500"
                          : p.status === "dead_stock"
                            ? "bg-amber-500/15 text-amber-500"
                            : "bg-emerald-500/15 text-emerald-500"
                      }`}
                    >
                      {statusLabel(p.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUBPAGE: EXPIRY WRITE-OFF HORIZON CHART & BATCH LISTINGS     */}
      {/* ============================================================ */}
      {effectiveView === "stock" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {horizonBuckets.map((b, idx) => (
              <button
                key={b.label}
                type="button"
                onMouseEnter={() => setHoverBucketIdx(idx)}
                onMouseLeave={() => setHoverBucketIdx(null)}
                onClick={() => onNavigateTab("inventory")}
                className={`rounded-[22px] border p-4 text-left cursor-pointer ${cardCls}`}
              >
                <div className={`text-[11px] font-medium ${mutedCls}`}>{b.label}</div>
                <div className="text-xl font-bold tabular-nums mt-1" style={{ color: b.color }}>
                  {fmt(b.data.valueTzs)}
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden mt-2 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(8, Math.round((b.data.valueTzs / maxBucketVal) * 100))}%`,
                      backgroundColor: b.color,
                    }}
                  />
                </div>
                <div className={`text-[10px] mt-1.5 ${mutedCls}`}>
                  {b.data.units} {isSw ? "pakiti" : "packs at cost"}
                </div>
              </button>
            ))}
          </div>

          {hoverBucketIdx !== null && (
            <div className={`px-4 py-2.5 rounded-2xl border text-xs ${chipCls}`}>
              <strong>{horizonBuckets[hoverBucketIdx].label}:</strong>{" "}
              {fmt(horizonBuckets[hoverBucketIdx].data.valueTzs)} ({horizonBuckets[hoverBucketIdx].data.units}{" "}
              {isSw ? "pakiti za dawa katika kundi hili." : "packs sitting in this expiry window."})
            </div>
          )}

          <div className={`rounded-[24px] border p-6 space-y-4 overflow-x-auto ${cardCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">
                  {isSw ? "Makadirio ya Mauzo ya FEFO vs Hasara ya Kuisha Muda" : "Batch Expiry Exposure (Click a Batch)"}
                </h2>
                <p className={`text-[11px] ${mutedCls}`}>
                  {isSw
                    ? "Bonyeza kundi lolote kuona pakiti ngapi zitauzwa kabla ya kuisha muda."
                    : "Click any batch row to see how many units will likely clear in time vs remain at risk."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("inventory")}
                className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                {isSw ? "Simamia Makundi" : "Manage Stock Lots"} &rarr;
              </button>
            </div>

            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className={`border-b text-left text-[10px] uppercase tracking-wider ${mutedCls}`}>
                  <th className="py-2 pr-3">{isSw ? "Dawa & Kundi" : "Medicine & Batch"}</th>
                  <th className="py-2 px-2">{isSw ? "Kuisha Muda" : "Expiry"}</th>
                  <th className="py-2 px-2">{isSw ? "Siku" : "Days Left"}</th>
                  <th className="py-2 px-2">{isSw ? "Zipo" : "In Stock"}</th>
                  <th className="py-2 px-2">{isSw ? "Zitauzwa" : "Likely Sold"}</th>
                  <th className="py-2 px-2">{isSw ? "Zitakazobaki" : "At Risk"}</th>
                  <th className="py-2 pl-2">{isSw ? "Hasara Tarajiwa" : "Est. Loss"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/20">
                {lotRisk.lots.map((l) => (
                  <tr
                    key={l.batchId}
                    onClick={() => setSelectedDetail({ kind: "lot", item: l })}
                    className="hover:bg-blue-500/8 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold underline decoration-dotted underline-offset-2">{l.brandName}</span>{" "}
                      <span className={`font-mono text-[10px] ${mutedCls}`}>({l.batchNumber})</span>
                    </td>
                    <td className="py-2.5 px-2 font-mono">{l.expiryDate}</td>
                    <td className={`py-2.5 px-2 font-bold ${l.daysToExpiry < 0 ? "text-rose-500" : l.daysToExpiry <= 30 ? "text-amber-500" : ""}`}>
                      {l.daysToExpiry}d
                    </td>
                    <td className="py-2.5 px-2 tabular-nums">{l.quantity}</td>
                    <td className="py-2.5 px-2 text-emerald-500 font-semibold tabular-nums">{l.projectedSold}</td>
                    <td className="py-2.5 px-2 font-bold tabular-nums">{l.atRiskUnits}</td>
                    <td className="py-2.5 pl-2 font-bold text-rose-500 tabular-nums">{fmt(l.atRiskValueTzs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUBPAGE: TEAM & SIDE-BY-SIDE BRANCH ARENA                    */}
      {/* ============================================================ */}
      {effectiveView === "people" && (() => {
        const bA = branches.find((b) => b.centreId === compareBranchA) ?? branches[0];
        const bB = branches.find((b) => b.centreId === compareBranchB) ?? branches[1] ?? branches[0];
        const maxRevCmp = Math.max(1, bA?.revenue ?? 0, bB?.revenue ?? 0);
        const maxStockCmp = Math.max(1, bA?.stockAtCost ?? 0, bB?.stockAtCost ?? 0);

        return (
          <div className="space-y-4">
            {/* True Side-by-Side Branch Visual Comparison Arena */}
            {bA && bB && (
              <div className={`rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {isSw ? "Ulinganisho wa Tawi kwa Tawi (Sambamba)" : "Side-by-Side Branch Comparison Chart"}
                    </h2>
                    <p className={`text-[11px] ${mutedCls}`}>
                      {isSw ? "Linganisha matawi mawili moja kwa moja kwenye mauzo, faida na stoo." : "Direct metric & bar comparison between two branch locations."}
                    </p>
                  </div>
                  {branches.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <select
                        value={bA.centreId}
                        onChange={(e) => setCompareBranchA(e.target.value)}
                        className={`px-3 py-1.5 rounded-full border font-semibold ${chipCls}`}
                      >
                        {branches.map((b) => <option key={b.centreId} value={b.centreId}>{b.name}</option>)}
                      </select>
                      <span className="font-bold opacity-60">vs</span>
                      <select
                        value={bB.centreId}
                        onChange={(e) => setCompareBranchB(e.target.value)}
                        className={`px-3 py-1.5 rounded-full border font-semibold ${chipCls}`}
                      >
                        {branches.map((b) => <option key={b.centreId} value={b.centreId}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* 2-Column Side-by-Side Branch Visual Bars */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-2xl border space-y-3 ${chipCls}`}>
                    <div className="text-xs font-bold">{isSw ? "Mauzo vs Thamani Stoo" : "Sales & Stock Side-by-Side"}</div>
                    {[
                      {
                        label: isSw ? "Mauzo (Sales)" : "Sales Revenue",
                        aVal: fmt(bA.revenue),
                        bVal: fmt(bB.revenue),
                        aPct: Math.max(8, Math.round((bA.revenue / maxRevCmp) * 100)),
                        bPct: Math.max(8, Math.round((bB.revenue / maxRevCmp) * 100)),
                      },
                      {
                        label: isSw ? "Thamani ya Stoo" : "Stock at Cost",
                        aVal: fmt(bA.stockAtCost),
                        bVal: fmt(bB.stockAtCost),
                        aPct: Math.max(8, Math.round((bA.stockAtCost / maxStockCmp) * 100)),
                        bPct: Math.max(8, Math.round((bB.stockAtCost / maxStockCmp) * 100)),
                      },
                    ].map((row) => (
                      <div key={row.label} className="space-y-1.5 text-[11px]">
                        <div className={`font-semibold ${mutedCls}`}>{row.label}</div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-24 truncate font-medium">{bA.name}</span>
                            <div className="flex-1 h-3 rounded-full bg-slate-500/15 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${row.aPct}%`, backgroundColor: accent }} />
                            </div>
                            <span className="w-24 text-right font-bold tabular-nums">{row.aVal}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-24 truncate font-medium">{bB.name}</span>
                            <div className="flex-1 h-3 rounded-full bg-slate-500/15 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.bPct}%` }} />
                            </div>
                            <span className="w-24 text-right font-bold tabular-nums">{row.bVal}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Side-by-Side Scorecard Split Columns */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { item: bA, color: accent },
                      { item: bB, color: "#10B981" },
                    ].map(({ item, color }, idx) => (
                      <div key={`${item.centreId}-${idx}`} className={`p-4 rounded-2xl border space-y-2.5 ${chipCls}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-bold truncate">{item.name}</span>
                        </div>
                        <div>
                          <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Mauzo" : "Revenue"}</div>
                          <div className="text-base font-bold tabular-nums">{fmt(item.revenue)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-500/15">
                          <div>
                            <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Faida %" : "Margin"}</div>
                            <div className="font-bold text-emerald-500">{item.marginPct}%</div>
                          </div>
                          <div>
                            <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Mzunguko" : "Turn/Yr"}</div>
                            <div className="font-bold tabular-nums">{item.turnover}x</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
                <h2 className="text-sm font-semibold">{isSw ? "Utendaji wa Timu ya Kaunta" : "Staff Sales League"}</h2>
                <div className="space-y-2.5">
                  {staff.map((s) => (
                    <button
                      key={s.actor}
                      type="button"
                      onClick={() => setSelectedDetail({ kind: "staff", item: s })}
                      className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-xs text-left cursor-pointer hover:border-blue-400 transition-colors ${chipCls}`}
                    >
                      <div>
                        <div className="font-bold">{s.actor}</div>
                        <div className={`text-[11px] ${mutedCls}`}>
                          {s.tx} {isSw ? "risiti" : "receipts"} &middot; {isSw ? "Wastani" : "Avg"} {fmt(s.aov)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums">{fmt(s.revenue)}</div>
                        <div className="text-[10px] text-emerald-500 font-semibold">
                          {isSw ? "Faida" : "Profit"} {fmt(s.profit)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
                <h2 className="text-sm font-semibold">{isSw ? "Matawi Yote" : "All Branch Stations"}</h2>
                <div className="space-y-2.5">
                  {branches.map((b) => (
                    <div
                      key={b.centreId}
                      onClick={() => setSelectedDetail({ kind: "branch", item: b })}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs cursor-pointer hover:border-blue-400 transition-colors ${chipCls}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{b.name}</span>
                          {b.centreId === activeCentreId && (
                            <span className="px-2 py-0.5 rounded-full bg-[#E2F575] text-[#111317] text-[9px] font-bold">
                              {isSw ? "Unatumia" : "Active"}
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                          {isSw ? "Faida" : "Margin"} {b.marginPct}% &middot; {isSw ? "Stoo" : "Stock"} {fmt(b.stockAtCost)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="font-bold tabular-nums">{fmt(b.revenue)}</div>
                          <div className={`text-[10px] ${mutedCls}`}>{b.tx} tx</div>
                        </div>
                        {onSwitchCentre && b.centreId !== activeCentreId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSwitchCentre(b.centreId);
                            }}
                            className="px-2.5 py-1 rounded-full border text-[10px] font-semibold cursor-pointer hover:opacity-80"
                            style={{ borderColor: accent, color: accent }}
                          >
                            {isSw ? "Fungua" : "Enter"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* SUBPAGE: SUPPLIERS, WATERFALL P&L BRIDGE & STATEMENT         */}
      {/* ============================================================ */}
      {effectiveView === "procurement" && (
        <div className="space-y-4">
          {/* Interactive P&L Waterfall Chart */}
          <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">
                  {isSw ? "Mtiririko wa Faida Halisi (Waterfall)" : "Profit Waterfall Bridge Chart"}
                </h2>
                <p className={`text-[11px] ${mutedCls}`}>
                  {isSw ? "Weka mshale kuona kiasi cha kila hatua." : "Hover any pillar to inspect how revenue flows down to Net Profit."}
                </p>
              </div>
              {hoverWfIdx !== null && (
                <span className={`px-3 py-1 rounded-full border text-[11px] font-semibold ${chipCls}`}>
                  {[
                    `${isSw ? "Mauzo" : "Sales"}: ${fmt(pnl.revenue)}`,
                    `${isSw ? "Gharama Dawa" : "Stock Cost"}: -${fmt(pnl.cogs)}`,
                    `${isSw ? "Faida Ghafi" : "Gross Profit"}: ${fmt(pnl.grossProfit)}`,
                    `${isSw ? "Matumizi" : "Bills"}: -${fmt(pnl.opex)}`,
                    `${isSw ? "Faida Halisi" : "Net Profit"}: ${fmt(pnl.netProfit)}`,
                  ][hoverWfIdx]}
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-3 items-end h-32 pt-2">
              {(() => {
                const maxWf = Math.max(1, pnl.revenue, pnl.grossProfit, Math.abs(pnl.netProfit));
                const steps = [
                  { label: isSw ? "Mauzo" : "Sales", val: pnl.revenue, color: accent },
                  { label: isSw ? "-Dawa" : "-Stock Cost", val: pnl.cogs, color: "#F43F5E" },
                  { label: isSw ? "Ghafi" : "Gross Profit", val: pnl.grossProfit, color: "#0EA5E9" },
                  { label: isSw ? "-Bili" : "-Bills", val: pnl.opex, color: "#F59E0B" },
                  { label: isSw ? "Halisi" : "Net Profit", val: Math.max(0, pnl.netProfit), color: "#10B981" },
                ];
                return steps.map((st, idx) => (
                  <div
                    key={st.label}
                    onMouseEnter={() => setHoverWfIdx(idx)}
                    onMouseLeave={() => setHoverWfIdx(null)}
                    className="h-full flex flex-col justify-end items-center gap-1 cursor-crosshair"
                  >
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        className={`w-11 rounded-t-xl transition-all duration-200 ${hoverWfIdx === idx ? "ring-2 ring-[#E2F575] scale-105" : ""}`}
                        style={{ height: `${Math.max(15, Math.round((st.val / maxWf) * 100))}%`, backgroundColor: st.color }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-center">{st.label}</span>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{isSw ? "Wasambazaji & Kasri Escrow" : "Suppliers & Kasri Escrow"}</h2>
              <button
                type="button"
                onClick={() => onNavigateTab("network")}
                className="text-xs font-semibold hover:underline cursor-pointer"
                style={{ color: accent }}
              >
                {isSw ? "Bohari" : "Open Wholesale"} &rarr;
              </button>
            </div>
            <div className="space-y-2.5">
              {suppliers.map((s) => (
                <button
                  key={s.supplier}
                  type="button"
                  onClick={() => setSelectedDetail({ kind: "supplier", item: s })}
                  className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-xs text-left cursor-pointer hover:border-blue-400 transition-colors ${chipCls}`}
                >
                  <div>
                    <div className="font-bold">{s.supplier}</div>
                    <div className={`text-[11px] ${mutedCls}`}>
                      {s.orders} {isSw ? "oda" : "order(s)"} &middot;{" "}
                      {s.avgLeadDays === null ? (isSw ? "Njiani" : "Pending") : `${s.avgLeadDays}d ${isSw ? "kufika" : "lead"}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums">{fmt(s.spend)}</div>
                    <div className={`text-[10px] ${s.held > 0 ? "text-amber-500 font-semibold" : "text-emerald-500"}`}>
                      {s.held > 0 ? `${isSw ? "Escrow:" : "Held:"} ${fmt(s.held)}` : `${isSw ? "Imetolewa:" : "Released:"} ${fmt(s.released)}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {isSw ? `Faida na Hasara (Siku ${windowDays})` : `${windowDays}-Day Profit & Loss`}
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab("billing")}
                className="text-xs font-semibold hover:underline cursor-pointer"
                style={{ color: accent }}
              >
                {isSw ? "Fedha & Bili" : "Full Finance"} &rarr;
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-500/15">
                <span className={mutedCls}>{isSw ? "Mauzo ya Kaunta" : "Counter Sales Revenue"}</span>
                <span className="font-bold tabular-nums">{fmt(pnl.revenue)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-500/15">
                <span className={mutedCls}>{isSw ? "Gharama ya Dawa Zilizouzwa" : "Cost of Stock Sold"}</span>
                <span className="font-semibold text-rose-500 tabular-nums">-{fmt(pnl.cogs)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-500/15">
                <span className="font-semibold">{isSw ? `Faida Ghafi (${pnl.grossMarginPct}%)` : `Gross Profit (${pnl.grossMarginPct}%)`}</span>
                <span className="font-bold text-emerald-500 tabular-nums">{fmt(pnl.grossProfit)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-500/15">
                <span className={mutedCls}>{isSw ? "Bili & Gharama za Uendeshaji" : "Monthly Bills & Subscription"}</span>
                <span className="font-semibold text-amber-500 tabular-nums">-{fmt(pnl.opex)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm">
                <span className="font-bold">{isSw ? `Faida Halisi (${pnl.netMarginPct}%)` : `Net Profit (${pnl.netMarginPct}%)`}</span>
                <span className="font-bold tabular-nums">{fmt(pnl.netProfit)}</span>
              </div>
            </div>
            <div className={`p-3 rounded-2xl border text-[11px] flex items-center justify-between ${chipCls}`}>
              <span>{isSw ? "Lengo la Mauzo Kila Siku Kufidia Gharama" : "Daily Sales Needed to Break Even"}</span>
              <span className="font-bold tabular-nums">
                {pnl.breakEvenDailyRevenue === null ? "-" : `${fmt(pnl.breakEvenDailyRevenue)}/day`}
              </span>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUBPAGE: MY OWN PERFORMANCE (ALWAYS AVAILABLE TO EVERY STAFF)*/}
      {/* ============================================================ */}
      {effectiveView === "my_perf" && (
        <div className="space-y-4 animate-stage-pop">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`rounded-[24px] border p-5 ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>{isSw ? "Mauzo Yangu" : "My Sales Total"}</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {fmt(myStats.totalRev)}
              </div>
              <div className={`text-[11px] mt-1 ${mutedCls}`}>
                {activeProfileName || "Operator"} &middot; {(activeProfileRole || "staff").replace(/_/g, " ")}
              </div>
            </div>
            <div className={`rounded-[24px] border p-5 ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>{isSw ? "Risiti Nilizotoa" : "Receipts Issued"}</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {myStats.txCount}
              </div>
              <div className="text-[11px] text-emerald-500 font-semibold mt-1">
                {myStats.totalUnits} {isSw ? "pakiti zimeuzwa" : "packs dispensed"}
              </div>
            </div>
            <div className={`rounded-[24px] border p-5 ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>{isSw ? "Wastani wa Kikapu" : "My Avg Basket"}</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {fmt(myStats.avgBasket)}
              </div>
              <div className={`text-[11px] mt-1 ${mutedCls}`}>{windowDays}d {isSw ? "dirisha" : "window"}</div>
            </div>
            <div className={`rounded-[24px] border p-5 ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>{isSw ? "Dawa za Cheti (Rx)" : "Rx Verified Share"}</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {myStats.rxPct}%
              </div>
              <div className={`text-[11px] mt-1 ${mutedCls}`}>{activeCentreName}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <h2 className="text-sm font-semibold">
                {isSw ? "Bidhaa Nilizouza Zaidi" : "My Top Dispensed Medicines"}
              </h2>
              {myStats.topProducts.length === 0 ? (
                <div className={`p-4 rounded-2xl border text-xs ${chipCls} ${mutedCls}`}>
                  {isSw ? "Bado hujauza kwenye kaunta katika dirisha hili." : "No receipts logged under your profile yet in this window."}
                </div>
              ) : (
                <div className="space-y-2">
                  {myStats.topProducts.map((tp) => (
                    <div key={tp.brand} className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${chipCls}`}>
                      <div>
                        <div className="font-bold">{tp.brand}</div>
                        <div className={`text-[11px] ${mutedCls}`}>{tp.qty} {isSw ? "pakiti" : "packs"}</div>
                      </div>
                      <span className="font-bold tabular-nums">{fmt(tp.rev)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {isSw ? "Risiti Zangu za Hivi Karibuni" : "My Recent Shift Receipts"}
                </h2>
                {!canViewOrg && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-bold">
                    {isSw ? "Ripoti Binafsi Tu" : "Personal Scope Only"}
                  </span>
                )}
              </div>
              {mySales.length === 0 ? (
                <div className={`p-4 rounded-2xl border text-xs ${chipCls} ${mutedCls}`}>
                  {isSw ? "Hakuna risiti bado. Fungua Kaunta ya POS kuanza." : "No personal receipts yet. Open Counter POS to start."}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {mySales.slice(0, 8).map((s) => (
                    <div key={s.id} className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${chipCls}`}>
                      <div>
                        <div className="font-semibold">{s.paymentMethod.toUpperCase()} &middot; {s.itemCount} items</div>
                        <div className={`text-[10px] ${mutedCls}`}>
                          {s.createdAt.slice(0, 16).replace("T", " ")} {s.prescriptionRef ? `· Rx ${s.prescriptionRef}` : ""}
                        </div>
                      </div>
                      <span className="font-bold tabular-nums">{fmt(s.totalTzs)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
