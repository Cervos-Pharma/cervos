"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  allocateFefoBatches,
  COMMERCIAL_PLAN_CATALOG,
  parseGs1Barcode,
  resolvePermissions,
  STAKEHOLDER_LENS_CATALOG,
  type StakeholderGroup,
} from "@cervos/core";
import {
  buildAnonymizedTelemetryVector,
  computeInventoryIntelligence,
  matchHospitalStockoutWithNearbySurplus,
} from "@cervos/intelligence";
import { getCervosText, type CervosLocale } from "@cervos/i18n";
import { ConfirmModal, ExpiryBadge, Money, StakeholderPill } from "@cervos/ui";

const SAMPLE_BATCHES = [
  { id: "b-exp", batchNumber: "AMX-2501", quantity: 40, expiryDate: "2026-06-01", createdAt: "2025-11-01" },
  { id: "b-fefo-1", batchNumber: "AMX-2612", quantity: 18, expiryDate: "2026-12-20", createdAt: "2026-02-10" },
  { id: "b-fefo-2", batchNumber: "AMX-2708", quantity: 120, expiryDate: "2027-08-15", createdAt: "2026-06-15" },
] as const;

const SAMPLE_SURPLUS = [
  {
    facilityId: "fac-kinondoni",
    facilityName: "Kinondoni Central Dispensary",
    region: "Dar es Salaam",
    productId: "prod-ceftriaxone",
    batchNumber: "CEF-2703",
    surplusQty: 80,
    daysUntilExpiry: 145,
    distanceKm: 4.2,
  },
  {
    facilityId: "fac-arusha",
    facilityName: "Arusha Regional Supply Store",
    region: "Arusha",
    productId: "prod-ceftriaxone",
    batchNumber: "CEF-2711",
    surplusQty: 240,
    daysUntilExpiry: 260,
    distanceKm: 620,
  },
] as const;

export default function EcosystemClient() {
  const [locale, setLocale] = useState<CervosLocale>("en");
  const [activeGroup, setActiveGroup] = useState<Exclude<StakeholderGroup, "hq">>("business_owner");
  const [dispenseQty, setDispenseQty] = useState(25);
  const [claimTokenInput, setClaimTokenInput] = useState("CRV-RX-88412");
  const [pharmacistLicenseInput, setPharmacistLicenseInput] = useState("TMDA-PH-2049");
  const [gs1Input, setGs1Input] = useState("(01)06291041500213(17)271231(10)AMX2712(21)904");
  const [recallModalOpen, setRecallModalOpen] = useState(false);
  const [recallStatusNote, setRecallStatusNote] = useState<string | null>(null);

  const activeLens = useMemo(
    () => STAKEHOLDER_LENS_CATALOG.find((item) => item.group === activeGroup) ?? STAKEHOLDER_LENS_CATALOG[0],
    [activeGroup]
  );

  const primaryRole = activeLens.roles[0];
  const permissions = useMemo(() => resolvePermissions(primaryRole), [primaryRole]);

  const fefoPreview = useMemo(
    () =>
      allocateFefoBatches(SAMPLE_BATCHES, dispenseQty, {
        referenceDate: "2026-11-14",
        requiresPrescription: true,
        isControlled: false,
        claimToken: claimTokenInput,
        pharmacistLicenseNo: pharmacistLicenseInput,
      }),
    [dispenseQty, claimTokenInput, pharmacistLicenseInput]
  );

  const parsedGs1 = useMemo(() => parseGs1Barcode(gs1Input), [gs1Input]);

  const intelligence = useMemo(
    () =>
      computeInventoryIntelligence({
        productId: "prod-amox-500",
        productName: "Amoxicillin 500mg Caps (10x10)",
        innName: "Amoxicillin",
        atcCode: "J01CA04",
        whoAwareClass: "Access",
        currentStockQty: 18,
        dailySalesSeries: [3, 4, 4, 6, 5, 8, 9, 11],
        leadTimeDays: 3,
        targetCoverDays: 14,
        unitCostTzs: 8500,
        expiringWithin60DaysQty: 18,
        preferredSupplierId: "sup-keko-pharma",
      }),
    []
  );

  const telemetryTensor = useMemo(
    () =>
      buildAnonymizedTelemetryVector({
        region: "Dar es Salaam",
        atcCode: "J01CA04",
        innName: "Amoxicillin 500mg",
        dosageForm: "Capsule",
        whoAwareClass: "Access",
        unitsDispensed: 4280,
        branchesReporting: 42,
        branchesStockedOut: 5,
        medianDaysOfCover: intelligence.daysOfCover,
      }),
    [intelligence.daysOfCover]
  );

  const hospitalMatches = useMemo(
    () => matchHospitalStockoutWithNearbySurplus(120, "Dar es Salaam", SAMPLE_SURPLUS, 60),
    []
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-30 border-b border-outline-variant bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <h1 className="font-headline-lg text-2xl font-semibold tracking-tight text-ink-deep">
              {getCervosText(locale, "appTitle")}
            </h1>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {getCervosText(locale, "stakeholdersTitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("cervos:open-command-bar"))}
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-base px-3 py-2 text-xs font-medium text-on-surface transition-[background-color,transform] duration-150 ease-out hover:bg-surface-container-low enabled:active:scale-[0.96]"
            >
              <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                search
              </span>
              <span>{getCervosText(locale, "commandHint")}</span>
            </button>

            <button
              type="button"
              onClick={() => setLocale((prev) => (prev === "en" ? "sw" : "en"))}
              className="rounded-lg border border-outline-variant bg-surface-base px-3 py-2 font-mono text-xs font-semibold text-primary transition-[background-color,transform] duration-150 ease-out hover:bg-surface-container-low enabled:active:scale-[0.96]"
            >
              {locale === "en" ? "SW / Swahili" : "EN / English"}
            </button>

            <Link
              href="/dashboard"
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition-[background-color,transform] duration-150 ease-out hover:bg-primary-variant active:scale-[0.96]"
            >
              Open Live Portal
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* 8-Stakeholder Navigation Matrix */}
        <section aria-label="8 Connected Stakeholder Modes">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STAKEHOLDER_LENS_CATALOG.map((lens) => {
              const selected = lens.group === activeGroup;
              return (
                <button
                  key={lens.group}
                  type="button"
                  onClick={() => setActiveGroup(lens.group)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-[background-color,border-color,transform] duration-150 ease-out enabled:active:scale-[0.98] ${
                    selected
                      ? "border-primary bg-primary-fixed/40 shadow-sm"
                      : "border-outline-variant bg-surface-base hover:bg-surface-container-low"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-primary tabular-nums">
                        Tier 0{lens.order}
                      </span>
                      <span className="font-mono text-[11px] text-on-surface-variant">
                        {lens.defaultRoute}
                      </span>
                    </div>
                    <h2 className="mt-1.5 font-headline-md text-base font-semibold text-ink-deep">
                      {lens.label}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                      {lens.summary}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Active Stakeholder Lens Detail + Capabilities */}
        <section className="rounded-xl border border-outline-variant bg-surface-base p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/60 pb-5">
            <div className="min-w-0 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-headline-md text-xl font-semibold text-ink-deep">
                  {activeLens.label} Workspace Spine
                </h2>
                <StakeholderPill role={primaryRole} />
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">{activeLens.summary}</p>
              <p className="mt-2 text-xs font-medium text-secondary">
                Guardrail: {activeLens.guardrail}
              </p>
            </div>
            <Link
              href={activeLens.defaultRoute.startsWith("/ecosystem") ? "/dashboard" : activeLens.defaultRoute}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-[background-color,transform] duration-150 ease-out hover:bg-primary-variant active:scale-[0.96]"
            >
              Launch {activeLens.label} Surface
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Approve Rx", allowed: permissions.canApproveRx },
              { label: "Schedule IV", allowed: permissions.canDispenseControlled },
              { label: "Issue Claim Token", allowed: permissions.canIssueClaimToken },
              { label: "Cost Margins", allowed: permissions.canViewCostMargins },
              { label: "Hospital Transfer", allowed: permissions.canRequestHospitalTransfer },
              { label: "Broadcast Recall", allowed: permissions.canBroadcastRecall },
            ].map((cap) => (
              <div
                key={cap.label}
                className="rounded-lg border border-outline-variant/70 bg-surface-container-low px-3 py-2.5"
              >
                <div className="text-[11px] font-medium text-on-surface-variant">{cap.label}</div>
                <div
                  className={`mt-1 text-xs font-semibold ${
                    cap.allowed ? "text-tertiary" : "text-on-surface-variant"
                  }`}
                >
                  {cap.allowed ? "Permitted" : "Restricted"}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Live Interconnected Simulation Grid: Clinical FEFO + EWMA Intelligence + Hospital Transfer */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 1. FEFO + Prescriber Claim Token + GS1 */}
          <div className="rounded-xl border border-outline-variant bg-surface-base p-5">
            <h3 className="font-headline-md text-base font-semibold text-ink-deep">
              1. Clinical FEFO & Claim Token Engine
            </h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Blocks expired lots automatically and splits cart demand across earliest valid expiry dates.
            </p>

            <div className="mt-4 space-y-2.5">
              {SAMPLE_BATCHES.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-mono font-semibold text-on-surface">{batch.batchNumber}</div>
                    <div className="tabular-nums text-on-surface-variant">{batch.quantity} packs</div>
                  </div>
                  <ExpiryBadge expiryDate={batch.expiryDate} referenceDate="2026-11-14" />
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-on-surface-variant">
                Dispense Qty
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={dispenseQty}
                  onChange={(e) => setDispenseQty(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-md border border-outline-variant bg-surface-base px-2.5 py-1.5 font-mono text-xs text-on-surface tabular-nums"
                />
              </label>
              <label className="block text-xs font-medium text-on-surface-variant">
                Claim Token
                <input
                  type="text"
                  value={claimTokenInput}
                  onChange={(e) => setClaimTokenInput(e.target.value)}
                  className="mt-1 w-full rounded-md border border-outline-variant bg-surface-base px-2.5 py-1.5 font-mono text-xs text-on-surface"
                />
              </label>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-on-surface-variant">
                GS1 DataMatrix / Barcode Stream
                <input
                  type="text"
                  value={gs1Input}
                  onChange={(e) => setGs1Input(e.target.value)}
                  className="mt-1 w-full rounded-md border border-outline-variant bg-surface-base px-2.5 py-1.5 font-mono text-[11px] text-on-surface"
                />
              </label>
              <div className="mt-1.5 font-mono text-[11px] text-secondary tabular-nums">
                Parsed: GTIN {parsedGs1.gtin ?? "-"} · Lot {parsedGs1.batchNumber ?? "-"} · Exp{" "}
                {parsedGs1.expiryDate ?? "-"}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-xs">
              {fefoPreview.ok ? (
                <div className="space-y-1">
                  <div className="font-semibold text-tertiary">
                    Allocated {fefoPreview.totalAllocated} packs (blocked {fefoPreview.excludedExpiredCount} expired batch)
                  </div>
                  {fefoPreview.allocations.map((a) => (
                    <div key={a.batchId} className="font-mono text-[11px] text-on-surface tabular-nums">
                      -&gt; {a.batchNumber}: {a.quantityAllocated} (exp {a.expiryDate})
                    </div>
                  ))}
                </div>
              ) : (
                <div className="font-semibold text-error">{fefoPreview.error}</div>
              )}
            </div>
          </div>

          {/* 2. Intelligence & Research Telemetry Spine */}
          <div className="rounded-xl border border-outline-variant bg-surface-base p-5">
            <h3 className="font-headline-md text-base font-semibold text-ink-deep">
              2. EWMA Replenishment & Research Vector
            </h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Bridges branch POS velocity to 1-click Supplier POs and anonymized public-health telemetry.
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-surface-container-low p-3">
                <dt className="text-on-surface-variant">EWMA Daily Demand</dt>
                <dd className="mt-1 font-headline-md text-lg font-semibold text-ink-deep tabular-nums">
                  {intelligence.ewmaDailyVelocity} / day
                </dd>
              </div>
              <div className="rounded-lg bg-surface-container-low p-3">
                <dt className="text-on-surface-variant">Days of Cover</dt>
                <dd className="mt-1 font-headline-md text-lg font-semibold text-error tabular-nums">
                  {intelligence.daysOfCover}d ({intelligence.stockoutRiskLevel})
                </dd>
              </div>
              <div className="rounded-lg bg-surface-container-low p-3">
                <dt className="text-on-surface-variant">Recommended PO</dt>
                <dd className="mt-1 font-headline-md text-lg font-semibold text-primary tabular-nums">
                  {intelligence.recommendedOrderQty} packs
                </dd>
              </div>
              <div className="rounded-lg bg-surface-container-low p-3">
                <dt className="text-on-surface-variant">Draft PO Value</dt>
                <dd className="mt-1 font-headline-md text-lg font-semibold text-ink-deep">
                  <Money amount={intelligence.draftOrder?.estimatedLineTotalTzs ?? 0} />
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                Researcher Vector ({telemetryTensor.schemaVersion})
              </div>
              <div className="mt-1.5 font-mono text-[11px] leading-relaxed text-on-surface tabular-nums">
                ATC {telemetryTensor.atcCode} · WHO {telemetryTensor.whoAwareClass} · Regional Stockout Pressure{" "}
                {(telemetryTensor.stockoutPressureIndex * 100).toFixed(1)}% · Units{" "}
                {telemetryTensor.totalUnitsDispensed.toLocaleString("en-US")}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-on-surface-variant">
                Pharmacist Override License
                <input
                  type="text"
                  value={pharmacistLicenseInput}
                  onChange={(e) => setPharmacistLicenseInput(e.target.value)}
                  className="mt-1 w-full rounded-md border border-outline-variant bg-surface-base px-2.5 py-1.5 font-mono text-xs text-on-surface"
                />
              </label>
            </div>
          </div>

          {/* 3. Hospital Stockout Transfer + TMDA Regulator Quarantine + Plans */}
          <div className="rounded-xl border border-outline-variant bg-surface-base p-5">
            <h3 className="font-headline-md text-base font-semibold text-ink-deep">
              3. Hospital Transfer & TMDA Recall Control
            </h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Matches urgent hospital stockouts to nearest non-expired facility surplus, plus accessible recall confirmation.
            </p>

            <div className="mt-4 space-y-2.5">
              {hospitalMatches.map((m) => (
                <div
                  key={`${m.sourceFacilityId}-${m.batchNumber}`}
                  className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 font-semibold text-ink-deep">
                    <span>{m.sourceFacilityName}</span>
                    <span className="font-mono text-primary tabular-nums">+{m.transferQty} vials</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-on-surface-variant tabular-nums">
                    Lot {m.batchNumber} · {m.distanceKm} km away · {m.daysUntilExpiry}d shelf life
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-outline-variant/60 pt-4">
              <div className="text-xs font-semibold text-ink-deep">Canonical Subscription Tiers</div>
              <div className="mt-2 space-y-1.5">
                {COMMERCIAL_PLAN_CATALOG.slice(0, 4).map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">{tier.name}</span>
                    <Money amount={tier.priceMonthlyTzs} className="text-ink-deep" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setRecallModalOpen(true)}
                className="w-full rounded-lg border border-error/40 bg-error-container px-4 py-2 text-xs font-semibold text-on-error-container transition-[background-color,transform] duration-150 ease-out hover:bg-error hover:text-on-error active:scale-[0.96]"
              >
                Simulate TMDA Batch Recall Quarantine
              </button>
              {recallStatusNote && (
                <p className="mt-2 text-xs font-medium text-tertiary">{recallStatusNote}</p>
              )}
            </div>
          </div>
        </section>
      </main>

      <ConfirmModal
        open={recallModalOpen}
        title="Confirm TMDA Batch Recall Quarantine"
        description="Quarantining lot AMX-2501 will instruct all synced terminals via branch_commands to lock dispensing immediately and log an immutable recall_quarantine movement."
        confirmLabel="Issue Recall Quarantine"
        tone="danger"
        onCancel={() => setRecallModalOpen(false)}
        onConfirm={() => {
          setRecallModalOpen(false);
          setRecallStatusNote("Recall notice logged in audit queue — lot AMX-2501 flagged quarantined.");
        }}
      />
    </div>
  );
}

