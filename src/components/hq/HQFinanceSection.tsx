"use client";

import { useState } from "react";
import { formatTzs } from "@cervos/core";
import type { HqFleetAccount, HqPackageRecord, HqWholesaleOrderRecord } from "./types";

interface HQFinanceSectionProps {
  wholesaleOrders: HqWholesaleOrderRecord[];
  accounts: HqFleetAccount[];
  packages: HqPackageRecord[];
  onRunAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
  isDark: boolean;
  busy: boolean;
}

export default function HQFinanceSection({
  wholesaleOrders,
  accounts,
  packages,
  onRunAction,
  isDark,
  busy,
}: HQFinanceSectionProps) {
  const [escrowFilter, setEscrowFilter] = useState<"all" | "escrow_held" | "released" | "cancelled">("all");

  const cardCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const subCls = isDark
    ? "bg-[#171D28] border-slate-800 text-slate-200"
    : "bg-slate-50 border-slate-200 text-slate-800";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";

  const filteredOrders = wholesaleOrders.filter(
    (o) => escrowFilter === "all" || o.escrowStatus === escrowFilter
  );
  const heldTotal = wholesaleOrders
    .filter((o) => o.escrowStatus === "escrow_held")
    .reduce((sum, o) => sum + o.totalTzs, 0);
  const releasedTotal = wholesaleOrders
    .filter((o) => o.escrowStatus === "released")
    .reduce((sum, o) => sum + o.totalTzs, 0);

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`rounded-2xl border p-4 ${cardCls}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
            Kasri Escrow Held
          </div>
          <div className="text-xl font-bold tabular-nums mt-1 text-amber-600 dark:text-amber-400">
            {formatTzs(heldTotal)}
          </div>
          <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
            {wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held").length} pending deliveries
          </div>
        </div>
        <div className={`rounded-2xl border p-4 ${cardCls}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
            Settled Wholesale Volume
          </div>
          <div className="text-xl font-bold tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
            {formatTzs(releasedTotal)}
          </div>
          <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
            {wholesaleOrders.filter((o) => o.escrowStatus === "released").length} completed orders
          </div>
        </div>
        <div className={`rounded-2xl border p-4 ${cardCls}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
            Paid Active Accounts
          </div>
          <div className="text-xl font-bold tabular-nums mt-1">
            {accounts.filter((a) => a.subscriptionActive).length} / {accounts.length}
          </div>
          <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
            {accounts.filter((a) => a.billingOverdue).length} overdue &middot;{" "}
            {packages.filter((p) => p.active).length} active packages
          </div>
        </div>
      </div>

      {/* Kasri Escrow Orders Table */}
      <section className={`rounded-2xl border p-5 space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Wholesale Purchase Orders &amp; Kasri Escrow Ledger
            </h2>
            <p className={`text-xs ${mutedCls}`}>
              Manually release disputed held escrow or cancel unfulfilled supplier orders.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "escrow_held", "released", "cancelled"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setEscrowFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                  escrowFilter === status
                    ? "bg-[#1039B9] text-white"
                    : `border ${subCls}`
                }`}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
          {filteredOrders.length === 0 ? (
            <div className={`rounded-xl border p-8 text-center text-xs ${subCls} ${mutedCls}`}>
              No wholesale orders match this filter.
            </div>
          ) : (
            filteredOrders.map((ord) => (
              <div
                key={ord.id}
                className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${subCls}`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold">{ord.orderReference}</span>
                    <span className="text-xs font-semibold">{ord.orgName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        ord.escrowStatus === "escrow_held"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : ord.escrowStatus === "released"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-red-500/15 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {ord.escrowStatus}
                    </span>
                  </div>
                  <div className={`text-xs ${mutedCls}`}>
                    {ord.productName} ({ord.quantity} units) &middot; Supplier: {ord.supplierName}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold tabular-nums mr-2">
                    {formatTzs(ord.totalTzs)}
                  </span>
                  {ord.escrowStatus === "escrow_held" && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void onRunAction(
                            { action: "resolve_escrow", orderId: ord.id, decision: "release" },
                            `Released Kasri escrow for ${ord.orderReference}`
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                      >
                        Release Escrow
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void onRunAction(
                            { action: "resolve_escrow", orderId: ord.id, decision: "cancel" },
                            `Cancelled & refunded order ${ord.orderReference}`
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                      >
                        Cancel Order
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
