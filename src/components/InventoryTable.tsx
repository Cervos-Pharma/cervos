/**
 * @file components/InventoryTable.tsx
 * @description FEFO-sorted batch & product inventory view for the pharmacy portal.
 *  - Displays current branch overview card with live POS connection status and KPIs
 *  - Supports toggle between "Batches / Stock" (individual POS stock batches) and "Products" (aggregated stock)
 *  - FEFO expiry badges: ≤14 days (critical), ≤30 days (warning), >30 days (safe)
 *  - Supports search, branch filter, expiry filter, and column sorting.
 */
"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";

export interface BranchItem {
  id: string;
  name: string;
  address?: string | null;
  subscription_status?: string | null;
  pos_activated_at?: string | null;
}

/** One row of batch data as rendered in the inventory table. */
export interface BatchRow {
  id: string;
  productId?: string;
  productName: string;
  genericName: string;
  category?: string;
  batchNo: string;
  /** Branch id */
  branchId?: string;
  /** Branch display name */
  branch: string;
  quantity: number;
  costPrice?: number;
  salePrice?: number;
  /** ISO date string YYYY-MM-DD */
  expiryDate: string;
  /** Pre-computed days remaining until expiry */
  daysLeft: number;
}

interface InventoryTableProps {
  /** Full list of batch rows to display (may be filtered client-side). */
  batches: BatchRow[];
  /** Branch list (either full objects or string names for backward-compat). */
  branches: string[] | BranchItem[];
  /** Optional initial branch to select */
  initialBranchId?: string;
}

type SortKey = keyof BatchRow;
type SortDir = "asc" | "desc";

type ViewMode = "batches" | "products";

interface ProductSummary {
  key: string;
  productId?: string;
  productName: string;
  genericName: string;
  category: string;
  totalQuantity: number;
  batchCount: number;
  earliestExpiry: string;
  minDaysLeft: number;
  batches: BatchRow[];
}

function ExpiryBadge({ daysLeft, t }: { daysLeft: number; t: (k: string, f?: string) => string }) {
  const d = t("inv.daysleft", `${daysLeft}d`).replace("{n}", String(daysLeft));
  if (daysLeft <= 14) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-label-md px-2 py-0.5 border border-error text-error bg-error-container">
        <span className="w-1.5 h-1.5 rounded-full bg-error block" />
        {d}
      </span>
    );
  }
  if (daysLeft <= 30) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-label-md px-2 py-0.5 border border-[#b45309] text-[#b45309] bg-[#fef3c7]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#b45309] block" />
        {d}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-label-md px-2 py-0.5 border border-tertiary-container text-tertiary bg-[#dcfce7]">
      <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container block" />
      {d}
    </span>
  );
}

export default function InventoryTable({ batches, branches, initialBranchId }: InventoryTableProps) {
  const { t } = useI18n();

  // Normalize branches to BranchItem[]
  const branchList: BranchItem[] = useMemo(() => {
    if (!branches || branches.length === 0) return [];
    if (typeof branches[0] === "string") {
      return (branches as string[]).map((name) => ({ id: name, name }));
    }
    return branches as BranchItem[];
  }, [branches]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (initialBranchId && branchList.some((b) => b.id === initialBranchId)) {
      return initialBranchId;
    }
    return "all";
  });

  const [viewMode, setViewMode] = useState<ViewMode>("batches");
  const [search, setSearch] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "critical" | "warning" | "ok">("all");
  const [sortKey, setSortKey] = useState<SortKey>("daysLeft");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const currentBranch = useMemo(() => {
    if (selectedBranchId === "all") return null;
    return branchList.find((b) => b.id === selectedBranchId) || null;
  }, [selectedBranchId, branchList]);

  // Filter batches by branch selection first
  const branchBatches = useMemo(() => {
    if (selectedBranchId === "all") return batches;
    return batches.filter(
      (b) => b.branchId === selectedBranchId || b.branch === currentBranch?.name
    );
  }, [batches, selectedBranchId, currentBranch]);

  // Aggregate by product for Products tab
  const productSummaries: ProductSummary[] = useMemo(() => {
    const map = new Map<string, ProductSummary>();

    for (const b of branchBatches) {
      const key = b.productId || `${b.productName}__${b.genericName}`;
      let item = map.get(key);
      if (!item) {
        item = {
          key,
          productId: b.productId,
          productName: b.productName,
          genericName: b.genericName,
          category: b.category || "General",
          totalQuantity: 0,
          batchCount: 0,
          earliestExpiry: b.expiryDate,
          minDaysLeft: b.daysLeft,
          batches: [],
        };
        map.set(key, item);
      }
      item.totalQuantity += b.quantity;
      item.batchCount += 1;
      item.batches.push(b);
      if (b.daysLeft < item.minDaysLeft) {
        item.minDaysLeft = b.daysLeft;
        item.earliestExpiry = b.expiryDate;
      }
    }

    return Array.from(map.values());
  }, [branchBatches]);

  // Filter batches for Batches Tab
  const filteredBatches = useMemo(() => {
    let rows = branchBatches.filter((b) => {
      const matchSearch =
        !search ||
        b.productName.toLowerCase().includes(search.toLowerCase()) ||
        b.genericName.toLowerCase().includes(search.toLowerCase()) ||
        b.batchNo.toLowerCase().includes(search.toLowerCase()) ||
        (b.category && b.category.toLowerCase().includes(search.toLowerCase()));

      const matchExpiry =
        expiryFilter === "all" ||
        (expiryFilter === "critical" && b.daysLeft <= 14) ||
        (expiryFilter === "warning" && b.daysLeft > 14 && b.daysLeft <= 30) ||
        (expiryFilter === "ok" && b.daysLeft > 30);

      return matchSearch && matchExpiry;
    });

    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [branchBatches, search, expiryFilter, sortKey, sortDir]);

  // Filter products for Products Tab
  const filteredProducts = useMemo(() => {
    let prods = productSummaries.filter((p) => {
      const matchSearch =
        !search ||
        p.productName.toLowerCase().includes(search.toLowerCase()) ||
        p.genericName.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());

      const matchExpiry =
        expiryFilter === "all" ||
        (expiryFilter === "critical" && p.minDaysLeft <= 14) ||
        (expiryFilter === "warning" && p.minDaysLeft > 14 && p.minDaysLeft <= 30) ||
        (expiryFilter === "ok" && p.minDaysLeft > 30);

      return matchSearch && matchExpiry;
    });

    prods.sort((a, b) => a.productName.localeCompare(b.productName));
    return prods;
  }, [productSummaries, search, expiryFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k)
      return <span className="material-symbols-outlined text-[14px] opacity-30">unfold_more</span>;
    return (
      <span className="material-symbols-outlined text-[14px] text-primary-container">
        {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
      </span>
    );
  }

  // Branch / view metrics
  const totalUnitsInBranch = useMemo(() => {
    return branchBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
  }, [branchBatches]);

  const criticalCount = useMemo(() => {
    return branchBatches.filter((b) => b.daysLeft <= 14).length;
  }, [branchBatches]);

  const warningCount = useMemo(() => {
    return branchBatches.filter((b) => b.daysLeft > 14 && b.daysLeft <= 30).length;
  }, [branchBatches]);

  const activePosCount = useMemo(() => {
    return branchList.filter((b) => !!b.pos_activated_at).length;
  }, [branchList]);

  return (
    <div className="flex-1 p-8 flex flex-col gap-6 max-w-[1280px] mx-auto w-full">
      {/* Branch Selector Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant text-[22px]">storefront</span>
          <div>
            <label htmlFor="branch-select" className="font-mono text-label-md text-on-surface-variant uppercase block text-xs">
              {t("inv.branch.current", "Current Branch View")}
            </label>
            <select
              id="branch-select"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="mt-0.5 border border-outline-variant bg-surface text-on-surface text-body-sm font-semibold px-3 py-1.5 focus:outline-none focus:border-primary-container min-w-[240px]"
            >
              <option value="all">
                {t("inv.allbranches", "All Branches")} ({branchList.length} locations)
              </option>
              {branchList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.pos_activated_at ? "✓ (POS Active)" : "(No POS)"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Toggle: Batches vs Products */}
        <div className="flex items-center bg-surface-container p-1 border border-outline-variant">
          <button
            type="button"
            onClick={() => setViewMode("batches")}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-label-md uppercase transition-all ${
              viewMode === "batches"
                ? "bg-surface-container-lowest text-ink-deep font-bold shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">layers</span>
            {t("inv.tab.batches", "Batches / Stock")} ({branchBatches.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("products")}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-label-md uppercase transition-all ${
              viewMode === "products"
                ? "bg-surface-container-lowest text-ink-deep font-bold shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">medication</span>
            {t("inv.tab.products", "Products")} ({productSummaries.length})
          </button>
        </div>
      </div>

      {/* Current Branch Overview Card */}
      {currentBranch ? (
        <div className="bg-surface-container-lowest border border-outline-variant p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-8 h-8 border-l border-b border-outline-variant bg-primary-container/10" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-outline-variant/60">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded bg-primary-container/20 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[28px]">storefront</span>
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-headline-md text-headline-md text-ink-deep leading-none">
                    {currentBranch.name}
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-label-md bg-surface-container text-on-surface-variant uppercase tracking-wider">
                    {currentBranch.subscription_status ?? "active"}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {currentBranch.address || "Location registered with Cervos Pharmacy OS"}
                </p>
              </div>
            </div>

            {/* POS Terminal Connection Status */}
            <div className="flex items-center gap-3 bg-surface p-3 border border-outline-variant rounded">
              <span className="material-symbols-outlined text-[24px] text-on-surface-variant">point_of_sale</span>
              <div>
                <div className="flex items-center gap-2">
                  {currentBranch.pos_activated_at ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary block animate-pulse" />
                      <span className="font-mono text-label-md text-secondary font-bold uppercase">
                        {t("inv.pos.active", "POS Active & Linked")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-on-surface-variant/40 block" />
                      <span className="font-mono text-label-md text-on-surface-variant uppercase">
                        {t("inv.pos.unclaimed", "Unclaimed POS")}
                      </span>
                    </>
                  )}
                </div>
                <p className="font-mono text-xs text-on-surface-variant mt-0.5">
                  {currentBranch.pos_activated_at
                    ? `Live stock synced from desktop terminal`
                    : "Terminal not linked — link in POS onboarding"}
                </p>
              </div>
            </div>
          </div>

          {/* Current Branch KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
            <div className="p-3 bg-surface border border-outline-variant">
              <p className="font-mono text-label-md text-on-surface-variant uppercase text-xs mb-1">
                {t("inv.stock.units", "Total Stock in POS")}
              </p>
              <p className="text-headline-md font-headline-md text-ink-deep font-bold tabular-nums">
                {totalUnitsInBranch.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-surface border border-outline-variant">
              <p className="font-mono text-label-md text-on-surface-variant uppercase text-xs mb-1">
                {t("inv.total", "Active Batches")}
              </p>
              <p className="text-headline-md font-headline-md text-ink-deep font-bold tabular-nums">
                {branchBatches.length}
              </p>
            </div>
            <div className="p-3 bg-error-container/30 border border-error">
              <p className="font-mono text-label-md text-error uppercase text-xs mb-1">
                {t("inv.critical", "Critical (≤14 days)")}
              </p>
              <p className="text-headline-md font-headline-md text-error font-bold tabular-nums">
                {criticalCount}
              </p>
            </div>
            <div className="p-3 bg-[#fef3c7]/50 border border-[#b45309]">
              <p className="font-mono text-label-md text-[#b45309] uppercase text-xs mb-1">
                {t("inv.warning", "Warning (15–30 days)")}
              </p>
              <p className="text-headline-md font-headline-md text-[#b45309] font-bold tabular-nums">
                {warningCount}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* All Branches Summary Strip */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant p-4 relative">
            <p className="font-mono text-label-md text-on-surface-variant uppercase mb-1 text-xs">
              {t("dash.branches.title", "Total Branches")}
            </p>
            <p className="text-headline-md font-headline-md text-ink-deep font-bold">
              {branchList.length}
            </p>
            <p className="font-mono text-xs text-secondary mt-1">
              {activePosCount} POS {activePosCount === 1 ? "terminal" : "terminals"} active
            </p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant p-4 relative">
            <p className="font-mono text-label-md text-on-surface-variant uppercase mb-1 text-xs">
              {t("inv.stock.units", "Total Stock in POS")}
            </p>
            <p className="text-headline-md font-headline-md text-ink-deep font-bold tabular-nums">
              {totalUnitsInBranch.toLocaleString()}
            </p>
          </div>
          <div className="bg-error-container border border-error p-4 relative">
            <p className="font-mono text-label-md text-on-error-container uppercase mb-1 text-xs">
              {t("inv.critical", "Critical (≤14 days)")}
            </p>
            <p className="text-headline-md font-headline-md text-error font-bold tabular-nums">
              {criticalCount}
            </p>
          </div>
          <div className="bg-[#fef3c7] border border-[#b45309] p-4 relative">
            <p className="font-mono text-label-md text-[#92400e] uppercase mb-1 text-xs">
              {t("inv.warning", "Warning (15–30 days)")}
            </p>
            <p className="text-headline-md font-headline-md text-[#b45309] font-bold tabular-nums">
              {warningCount}
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex items-center flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder={
              viewMode === "batches"
                ? t("inv.search", "Search product, generic name, or batch...")
                : "Search products by name or category..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-outline-variant bg-surface text-on-surface text-body-sm font-body-md focus:outline-none focus:border-primary-container w-full"
          />
        </div>

        {/* Expiry filter buttons */}
        <div className="flex gap-2">
          {(["all", "critical", "warning", "ok"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setExpiryFilter(f)}
              className={`font-mono text-label-md px-3 py-1.5 border uppercase transition-colors ${
                expiryFilter === f
                  ? "bg-ink-deep text-white border-ink-deep"
                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {f === "all"
                ? t("inv.all", "All")
                : f === "critical"
                ? t("inv.critical.f", "Critical")
                : f === "warning"
                ? t("inv.warning.f", "Warning")
                : t("inv.ok", "Safe")}
            </button>
          ))}
        </div>

        <span className="font-mono text-label-md text-on-surface-variant ml-auto">
          {viewMode === "batches"
            ? `${filteredBatches.length} of ${branchBatches.length} batches`
            : `${filteredProducts.length} of ${productSummaries.length} products`}
        </span>
      </div>

      {/* Table: Batches / Stock View */}
      {viewMode === "batches" && (
        <div className="bg-surface-container-lowest border border-outline-variant overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                {([
                  ["productName", "inv.col.product", "Product"],
                  ["batchNo", "inv.col.batch", "Batch No"],
                  ["branch", "inv.col.branch", "Branch"],
                  ["quantity", "inv.col.qty", "Stock in POS"],
                  ["expiryDate", "inv.col.expiry", "Expiry"],
                  ["daysLeft", "inv.col.days", "Days Left"],
                ] as [SortKey, string, string][]).map(([key, labelKey, fallback]) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase cursor-pointer select-none hover:text-on-surface transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      {t(labelKey, fallback)}
                      <SortIcon k={key} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase text-right">
                  {t("inv.col.action", "Action")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant font-body-md">
                    {t("inv.noresults", "No batches match the current filters.")}
                  </td>
                </tr>
              ) : (
                filteredBatches.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-outline-variant hover:bg-surface-container-low transition-colors relative ${
                      row.daysLeft <= 14
                        ? "border-l-4 border-l-error"
                        : row.daysLeft <= 30
                        ? "border-l-4 border-l-[#b45309]"
                        : "border-l-4 border-l-tertiary-container"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-body-sm text-ink-deep">{row.productName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-on-surface-variant">{row.genericName}</span>
                        {row.category && (
                          <span className="px-1.5 py-0.2 bg-surface-container text-[10px] text-on-surface-variant rounded">
                            {row.category}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-label-md text-on-surface">{row.batchNo}</td>
                    <td className="px-4 py-3 text-body-sm text-on-surface">
                      <span className="inline-flex items-center gap-1">
                        {row.branch}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-body-md text-on-surface tabular-nums font-bold">
                      {row.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-label-md text-on-surface">{row.expiryDate}</td>
                    <td className="px-4 py-3">
                      <ExpiryBadge daysLeft={row.daysLeft} t={t} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="font-mono text-label-md text-primary-container border border-primary-container px-2.5 py-1 hover:bg-surface-container-high transition-colors uppercase text-xs"
                      >
                        {t("inv.transfer", "Transfer")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Table: Products View */}
      {viewMode === "products" && (
        <div className="bg-surface-container-lowest border border-outline-variant overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase">
                  {t("inv.col.product", "Product")}
                </th>
                <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase">
                  {t("inv.col.category", "Category")}
                </th>
                <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase">
                  {t("inv.col.qty", "Total in POS Stock")}
                </th>
                <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase">
                  {t("inv.col.batchesCount", "Batches")}
                </th>
                <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase">
                  {t("inv.col.nearestExpiry", "Nearest Expiry")}
                </th>
                <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase">
                  {t("inv.col.status", "Status")}
                </th>
                <th className="px-4 py-3 font-mono text-label-md text-on-surface-variant uppercase text-right">
                  {t("inv.col.action", "Action")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant font-body-md">
                    {t("inv.noresults", "No products match the current filters.")}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => (
                  <tr
                    key={prod.key}
                    className="border-b border-outline-variant hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-body-sm text-ink-deep">{prod.productName}</div>
                      <div className="font-mono text-[11px] text-on-surface-variant mt-0.5">{prod.genericName}</div>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                      <span className="px-2 py-0.5 bg-surface-container rounded text-xs">
                        {prod.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-body-md text-ink-deep tabular-nums font-bold">
                      {prod.totalQuantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-label-md text-on-surface">
                      {prod.batchCount} {prod.batchCount === 1 ? "batch" : "batches"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-label-md text-on-surface">{prod.earliestExpiry}</span>
                        <ExpiryBadge daysLeft={prod.minDaysLeft} t={t} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {prod.totalQuantity > 10 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary px-2 py-0.5 rounded bg-secondary/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          {t("inv.stock.instock", "In Stock")}
                        </span>
                      ) : prod.totalQuantity > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] px-2 py-0.5 rounded bg-[#fef3c7]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#b45309]" />
                          {t("inv.stock.low", "Low Stock")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-error px-2 py-0.5 rounded bg-error-container">
                          <span className="w-1.5 h-1.5 rounded-full bg-error" />
                          {t("inv.stock.out", "Out of Stock")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSearch(prod.genericName);
                          setViewMode("batches");
                        }}
                        className="font-mono text-label-md text-primary border border-primary px-2.5 py-1 hover:bg-primary/10 transition-colors uppercase text-xs"
                      >
                        View Batches
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
