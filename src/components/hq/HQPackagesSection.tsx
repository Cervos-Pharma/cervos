"use client";

import { useState, type FormEvent } from "react";
import { formatTzs } from "@cervos/core";
import { hqSurfaceTokens } from "./hqSurface";
import type { HqPackageRecord } from "./types";

interface HQPackagesSectionProps {
  packages: HqPackageRecord[];
  minBranchPriceTzs: number;
  onRunAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
  isDark: boolean;
  busy: boolean;
}

const EMPTY_DRAFT: Omit<HqPackageRecord, "features"> & { featuresText: string } = {
  id: "",
  audience: "pharmacy",
  name: "",
  priceMonthlyTzs: 25000,
  priceAnnualTzs: 250000,
  pricePerBranchMonthlyTzs: 25000,
  includedAdminsPerBranch: 1,
  includedOperatorsPerBranch: 1,
  extraOperatorMonthlyTzs: 5000,
  maxBranches: 1,
  maxOperators: 5,
  maxSuppliers: 10,
  maxConnectedPharmacies: null,
  featuresText: "1 Admin + 1 Operator / Branch\nOffline POS + Expiry Guard",
  active: true,
};

export default function HQPackagesSection({
  packages,
  minBranchPriceTzs,
  onRunAction,
  isDark,
  busy,
}: HQPackagesSectionProps) {
  const [selectedId, setSelectedId] = useState<string>(packages[0]?.id ?? "");
  const [draft, setDraft] = useState(() => {
    const first = packages[0];
    if (!first) return EMPTY_DRAFT;
    return {
      ...first,
      featuresText: first.features.join("\n"),
    };
  });

  const t = hqSurfaceTokens(isDark);
  const cardCls = t.panelCls;
  const subCls = t.wellCls;
  const inputCls = t.inputCls;
  const mutedCls = t.mutedCls;

  const loadIntoEditor = (pkg: HqPackageRecord) => {
    setSelectedId(pkg.id);
    setDraft({
      ...pkg,
      featuresText: pkg.features.join("\n"),
    });
  };

  const startNewPackage = () => {
    setSelectedId("NEW");
    setDraft({
      ...EMPTY_DRAFT,
      priceMonthlyTzs: Math.max(minBranchPriceTzs, 15000),
      priceAnnualTzs: Math.max(minBranchPriceTzs, 15000) * 10,
      pricePerBranchMonthlyTzs: Math.max(minBranchPriceTzs, 15000),
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleanId = (draft.id || draft.name).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    if (!cleanId || draft.name.trim().length < 2) return;
    const perBranch = Math.max(minBranchPriceTzs, Math.round(draft.pricePerBranchMonthlyTzs || minBranchPriceTzs));
    const monthly = Math.max(minBranchPriceTzs, Math.round(draft.priceMonthlyTzs || perBranch));
    const annual = Math.max(monthly * 10, Math.round(draft.priceAnnualTzs || monthly * 10));

    await onRunAction(
      {
        action: "upsert_package",
        id: cleanId,
        audience: draft.audience,
        name: draft.name.trim(),
        priceMonthlyTzs: monthly,
        priceAnnualTzs: annual,
        pricePerBranchMonthlyTzs: perBranch,
        includedAdminsPerBranch: Math.max(1, draft.includedAdminsPerBranch),
        includedOperatorsPerBranch: Math.max(1, draft.includedOperatorsPerBranch),
        extraOperatorMonthlyTzs: Math.max(0, draft.extraOperatorMonthlyTzs),
        maxBranches: draft.maxBranches,
        maxOperators: draft.maxOperators,
        maxSuppliers: draft.maxSuppliers,
        maxConnectedPharmacies: draft.maxConnectedPharmacies,
        features: draft.featuresText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        active: draft.active,
      },
      `Saved package "${draft.name.trim()}" (${formatTzs(perBranch)}/branch/mo)`
    );
  };

  return (
    <div className="space-y-5">
      {/* Policy Floor Callout */}
      <div className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${cardCls}`}>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[#1039B9] dark:text-sky-400">
            Live SaaS Catalog &amp; Per-Branch Floor Policy
          </div>
          <p className={`text-xs mt-1 ${mutedCls}`}>
            Every package includes at least <strong>1 Admin + 1 Operator per branch</strong> with a hard floor of{" "}
            <strong>{formatTzs(minBranchPriceTzs)}/branch/mo</strong>. Saving updates the homepage calculator and billing portal immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewPackage}
          className="px-4 py-2 rounded-xl bg-[#1039B9] text-white text-xs font-semibold hover:bg-[#0d2e94] cursor-pointer"
        >
          + New Custom Package
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Package Cards */}
        <div className={`xl:col-span-7 rounded-2xl border p-5 space-y-3 ${cardCls}`}>
          <h2
            className="text-base font-semibold tracking-tight"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            Active &amp; Archived Commercial Packages ({packages.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {packages.map((pkg) => {
              const isSelected = selectedId === pkg.id;
              return (
                <div
                  key={pkg.id}
                  onClick={() => loadIntoEditor(pkg)}
                  className={`rounded-2xl border p-4 cursor-pointer transition-all space-y-2.5 ${isSelected
                    ? "border-[#1039B9] ring-2 ring-[#1039B9]/15 " +
                    (isDark ? "bg-[#151D2C]" : "bg-[#F4F7FF]")
                    : `${subCls} hover:border-[#1039B9]/40`
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-500/15 text-[10px] font-mono uppercase">
                        {pkg.audience}
                      </span>
                      <div className="text-sm font-bold mt-1">{pkg.name}</div>
                      <div className={`text-[10px] font-mono ${mutedCls}`}>{pkg.id}</div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onRunAction(
                          { action: "toggle_package_active", id: pkg.id, active: !pkg.active },
                          `${pkg.name} ${pkg.active ? "paused" : "activated"}`
                        );
                      }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase cursor-pointer ${pkg.active
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-500/20 text-slate-500"
                        }`}
                    >
                      {pkg.active ? "Active" : "Paused"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <div className={`text-[10px] uppercase ${mutedCls}`}>Per Branch / mo</div>
                      <div className="font-bold tabular-nums">{formatTzs(pkg.pricePerBranchMonthlyTzs)}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase ${mutedCls}`}>Included Seats</div>
                      <div className="font-semibold">
                        {pkg.includedAdminsPerBranch} Admin + {pkg.includedOperatorsPerBranch} Op
                      </div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase ${mutedCls}`}>Package Base / mo</div>
                      <div className="font-semibold tabular-nums">{formatTzs(pkg.priceMonthlyTzs)}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase ${mutedCls}`}>Extra Operator</div>
                      <div className="font-semibold tabular-nums">{formatTzs(pkg.extraOperatorMonthlyTzs)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Package Price & Quota Editor */}
        <form onSubmit={handleSave} className={`xl:col-span-5 rounded-2xl border p-5 space-y-4 ${cardCls}`}>
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-500/15">
            <div>
              <h3 className="text-base font-semibold">
                {selectedId === "NEW" ? "Create Custom Package" : `Edit: ${draft.name || draft.id}`}
              </h3>
              <p className={`text-xs ${mutedCls}`}>
                Prices saved here publish directly to public calculator &amp; billing checkout.
              </p>
            </div>
            {selectedId !== "NEW" && draft.id && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRunAction(
                    { action: "delete_package", id: draft.id },
                    `Deleted package ${draft.name}`
                  )
                }
                className="px-2.5 py-1 rounded-lg border border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300 text-[11px] font-semibold cursor-pointer"
              >
                Delete
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>Package Slug ID</span>
              <input
                type="text"
                value={draft.id}
                onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
                placeholder="e.g. regional_chain"
                disabled={selectedId !== "NEW"}
                className={`w-full h-9 px-3 rounded-xl border ${inputCls} disabled:opacity-60`}
              />
            </label>
            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>Audience</span>
              <select
                value={draft.audience}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    audience: e.target.value as HqPackageRecord["audience"],
                  }))
                }
                className={`w-full h-9 px-3 rounded-xl border ${inputCls}`}
              >
                <option value="pharmacy">Pharmacy / Chain</option>
                <option value="hospital">Hospital / Clinic</option>
                <option value="supplier">Wholesaler / Supplier</option>
              </select>
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className={`font-semibold ${mutedCls}`}>Display Package Name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                required
                className={`w-full h-9 px-3 rounded-xl border ${inputCls}`}
              />
            </label>

            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>
                Price / Branch / Mo (min {minBranchPriceTzs})
              </span>
              <input
                type="number"
                min={minBranchPriceTzs}
                step={500}
                value={draft.pricePerBranchMonthlyTzs}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, pricePerBranchMonthlyTzs: Number(e.target.value) }))
                }
                className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
              />
            </label>

            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>Package Base / Mo (TZS)</span>
              <input
                type="number"
                min={minBranchPriceTzs}
                step={1000}
                value={draft.priceMonthlyTzs}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDraft((d) => ({ ...d, priceMonthlyTzs: v, priceAnnualTzs: v * 10 }));
                }}
                className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
              />
            </label>

            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>Annual Price (TZS)</span>
              <input
                type="number"
                min={minBranchPriceTzs * 10}
                step={5000}
                value={draft.priceAnnualTzs}
                onChange={(e) => setDraft((d) => ({ ...d, priceAnnualTzs: Number(e.target.value) }))}
                className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
              />
            </label>

            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>Extra Operator Rate / Mo</span>
              <input
                type="number"
                min={0}
                step={500}
                value={draft.extraOperatorMonthlyTzs}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, extraOperatorMonthlyTzs: Number(e.target.value) }))
                }
                className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
              />
            </label>

            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>Included Admins / Branch</span>
              <input
                type="number"
                min={1}
                max={10}
                value={draft.includedAdminsPerBranch}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, includedAdminsPerBranch: Number(e.target.value) }))
                }
                className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
              />
            </label>

            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>Included Operators / Branch</span>
              <input
                type="number"
                min={1}
                max={20}
                value={draft.includedOperatorsPerBranch}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, includedOperatorsPerBranch: Number(e.target.value) }))
                }
                className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
              />
            </label>

            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>Max Branches (blank = unlimited)</span>
              <input
                type="number"
                min={1}
                value={draft.maxBranches ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxBranches: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
              />
            </label>

            <label className="space-y-1">
              <span className={`font-semibold ${mutedCls}`}>Max Operators (blank = unlimited)</span>
              <input
                type="number"
                min={2}
                value={draft.maxOperators ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxOperators: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
              />
            </label>

            {draft.audience === "supplier" && (
              <>
                <label className="space-y-1">
                  <span className={`font-semibold ${mutedCls}`}>Max Suppliers</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.maxSuppliers ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        maxSuppliers: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
                  />
                </label>
                <label className="space-y-1">
                  <span className={`font-semibold ${mutedCls}`}>Max Connected Pharmacies</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.maxConnectedPharmacies ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        maxConnectedPharmacies: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
                  />
                </label>
              </>
            )}
          </div>

          <label className="block space-y-1 text-xs">
            <span className={`font-semibold ${mutedCls}`}>Package Highlights (one per line)</span>
            <textarea
              rows={3}
              value={draft.featuresText}
              onChange={(e) => setDraft((d) => ({ ...d, featuresText: e.target.value }))}
              className={`w-full p-3 rounded-xl border ${inputCls}`}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className={`w-full h-11 rounded-2xl text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${t.primaryBtnCls}`}
          >
            {busy && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            <span>{busy ? "Saving..." : "Save Package Pricing to Live Store"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
