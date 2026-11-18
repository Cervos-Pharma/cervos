"use client";

import { useState, type FormEvent } from "react";
import { hqSurfaceTokens } from "./hqSurface";
import type {
  HqFleetAccount,
  HqJoinRequestRecord,
  HqQuoteRequestRecord,
  HqSupplierInviteRecord,
  HqUpdateRecord,
} from "./types";

interface HQLoungeAndUpdatesProps {
  joinRequests: HqJoinRequestRecord[];
  accounts: HqFleetAccount[];
  hqUpdates: HqUpdateRecord[];
  quoteRequests?: HqQuoteRequestRecord[];
  supplierInvites?: HqSupplierInviteRecord[];
  onRunAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
  isDark: boolean;
  busy: boolean;
}

const ROLE_OPTIONS = [
  { value: "superintendent_pharmacist", label: "Superintendent Pharmacist" },
  { value: "pos_cashier", label: "POS Counter Cashier" },
  { value: "warehouse_dispatcher", label: "Warehouse Dispatcher" },
  { value: "hospital_pharmacist", label: "Hospital Pharmacist" },
  { value: "pharmacy_owner", label: "Pharmacy Owner" },
];

export default function HQLoungeAndUpdates({
  joinRequests,
  accounts,
  hqUpdates,
  quoteRequests = [],
  supplierInvites = [],
  onRunAction,
  isDark,
  busy,
}: HQLoungeAndUpdatesProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "declined" | "accepted"
  >("all");
  const [allocDrafts, setAllocDrafts] = useState<
    Record<string, { centreId: string; role: string; pin: string }>
  >({});

  // HQ Updates form
  const [tag, setTag] = useState<HqUpdateRecord["tag"]>("RELEASE");
  const [title, setTitle] = useState("");
  const [swTitle, setSwTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [swSummary, setSwSummary] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Open Module");
  const [ctaTarget, setCtaTarget] = useState<HqUpdateRecord["ctaTarget"]>("reports");

  const t = hqSurfaceTokens(isDark);
  const cardCls = t.panelCls;
  const chipCls = t.wellCls;
  const inputCls = t.inputCls;
  const mutedCls = t.mutedCls;

  const filteredRequests = joinRequests.filter(
    (r) => statusFilter === "all" || r.status === statusFilter
  );

  const getDraft = (req: HqJoinRequestRecord) => {
    const existing = allocDrafts[req.id];
    if (existing) return existing;
    const org = accounts.find((a) => a.id === req.targetAccountId);
    const defaultCentre = org?.centres[0]?.id ?? "";
    const defaultRole =
      req.requestedRoleLabel?.toLowerCase().includes("pharm")
        ? "superintendent_pharmacist"
        : "pos_cashier";
    return { centreId: defaultCentre, role: defaultRole, pin: "4829" };
  };

  const setDraft = (
    reqId: string,
    patch: Partial<{ centreId: string; role: string; pin: string }>,
    fallback: { centreId: string; role: string; pin: string }
  ) => {
    setAllocDrafts((prev) => ({
      ...prev,
      [reqId]: { ...fallback, ...(prev[reqId] ?? {}), ...patch },
    }));
  };

  const handlePublishUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || summary.trim().length < 8) return;
    const ok = await onRunAction(
      {
        action: "publish_hq_update",
        tag,
        title: title.trim(),
        swTitle: swTitle.trim() || title.trim(),
        summary: summary.trim(),
        swSummary: swSummary.trim() || summary.trim(),
        ctaLabel: ctaLabel.trim() || "Open Module",
        ctaTarget,
      },
      `Published HQ platform update: ${title.trim()}`
    );
    if (ok) {
      setTitle("");
      setSwTitle("");
      setSummary("");
      setSwSummary("");
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left: Welcome Lounge Join Requests Oversight */}
      <div className={`xl:col-span-7 rounded-[24px] border p-5 space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-[#38BDF8]">
              Staff Onboarding Pipeline
            </div>
            <h2
              className="text-lg font-semibold tracking-tight mt-0.5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Welcome Lounge Join Requests ({joinRequests.length})
            </h2>
            <p className={`text-xs ${mutedCls}`}>
              Monitor pending applicant queues across organizations, nudge owners, or approve/decline
              on behalf of HQ.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", "pending", "approved", "declined", "accepted"] as const).map((st) => {
            const count =
              st === "all"
                ? joinRequests.length
                : joinRequests.filter((r) => r.status === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize cursor-pointer ${
                  statusFilter === st
                    ? "bg-[#1039B9] text-white"
                    : `border ${chipCls} hover:border-[#1039B9]/40`
                }`}
              >
                {st} <span className="font-mono text-[11px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3 max-h-[660px] overflow-y-auto pr-1">
          {filteredRequests.length === 0 ? (
            <div className={`rounded-2xl border p-8 text-center text-xs ${chipCls} ${mutedCls}`}>
              No Welcome Lounge join requests in this state.
            </div>
          ) : (
            filteredRequests.map((req) => {
              const org = accounts.find((a) => a.id === req.targetAccountId);
              const draft = getDraft(req);

              return (
                <div
                  key={req.id}
                  className={`rounded-2xl border p-4 space-y-3 text-xs ${chipCls}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{req.requesterFullName}</span>
                        <span className="font-mono text-[11px] text-[#1039B9] dark:text-[#38BDF8]">
                          @{req.requesterUsername}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            req.status === "pending"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : req.status === "approved" || req.status === "accepted"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-red-500/15 text-red-700 dark:text-red-300"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <div className={`text-[11px] mt-1 ${mutedCls}`}>
                        Target: <span className="font-semibold text-current">{req.targetOrgName}</span>{" "}
                        &middot; {req.requesterEmail} &middot; {req.requesterRegion} &middot;{" "}
                        {req.requesterLang}
                      </div>
                      {req.requestedRoleLabel && (
                        <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                          Requested role: <span className="font-semibold">{req.requestedRoleLabel}</span>
                          {req.note ? ` - "${req.note}"` : ""}
                        </div>
                      )}
                    </div>

                    <div className={`font-mono text-[10px] ${mutedCls}`}>
                      {req.createdAt.slice(0, 16).replace("T", " ")}
                    </div>
                  </div>

                  {req.status === "pending" && (
                    <div className={`rounded-xl border p-3 space-y-2.5 ${cardCls}`}>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={draft.centreId}
                          onChange={(e) =>
                            setDraft(req.id, { centreId: e.target.value }, draft)
                          }
                          className={`h-8 px-2.5 rounded-lg border text-xs ${inputCls}`}
                        >
                          {(org?.centres ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={draft.role}
                          onChange={(e) =>
                            setDraft(req.id, { role: e.target.value }, draft)
                          }
                          className={`h-8 px-2.5 rounded-lg border text-xs ${inputCls}`}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={draft.pin}
                          onChange={(e) =>
                            setDraft(req.id, { pin: e.target.value }, draft)
                          }
                          maxLength={6}
                          placeholder="4-digit PIN"
                          className={`h-8 px-2.5 rounded-lg border font-mono text-xs ${inputCls}`}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onRunAction(
                              {
                                action: "review_join_request",
                                requestId: req.id,
                                decision: "approve",
                                centreId: draft.centreId,
                                role: draft.role,
                                pin: draft.pin,
                              },
                              `Approved and allocated @${req.requesterUsername}`
                            )
                          }
                          className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          HQ Approve &amp; Allocate
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onRunAction(
                              {
                                action: "review_join_request",
                                requestId: req.id,
                                decision: "decline",
                                declineReason: "Declined during HQ access review.",
                              },
                              `Declined join request for @${req.requesterUsername}`
                            )
                          }
                          className="px-3 py-1.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-[11px] font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onRunAction(
                              {
                                action: "send_message",
                                accountId: req.targetAccountId,
                                severity: "action",
                                title: `Pending Join Request: ${req.requesterFullName}`,
                                swTitle: `Ombi la Kujiunga Linasubiri: ${req.requesterFullName}`,
                                body: `Applicant @${req.requesterUsername} (${req.requestedRoleLabel || "Staff"}) is waiting in the Welcome Lounge for branch & PIN allocation.`,
                                swBody: `Mwombaji @${req.requesterUsername} anasubiri kupangiwa tawi na PIN kwenye kituo chako.`,
                                ctaLabel: "Review Team",
                                ctaTarget: "team",
                              },
                              `Sent owner reminder to ${req.targetOrgName}`
                            )
                          }
                          className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold cursor-pointer ${chipCls}`}
                        >
                          Nudge Org Owner
                        </button>
                      </div>
                    </div>
                  )}

                  {req.status === "approved" && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Allocated to {req.allocatedCentreName} as {req.allocatedRole}
                      {req.allocatedPinPreview ? ` (PIN ${req.allocatedPinPreview})` : ""}
                    </div>
                  )}

                  {req.status === "declined" && req.declineReason && (
                    <div className="text-[11px] text-red-600 dark:text-red-300">
                      Reason: {req.declineReason}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: HQ Updates & Capabilities Manager */}
      <div className={`xl:col-span-5 rounded-[24px] border p-5 space-y-5 ${cardCls}`}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-[#38BDF8]">
            /app &amp; Lounge Capabilities Feed
          </div>
          <h2
            className="text-lg font-semibold tracking-tight mt-0.5"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            HQ Updates &amp; Capabilities Manager
          </h2>
          <p className={`text-xs mt-1 ${mutedCls}`}>
            Publish live release, hardware, compliance, or growth capability cards directly into
            every workspace hub and Welcome Lounge.
          </p>
        </div>

        <form onSubmit={handlePublishUpdate} className={`rounded-2xl border p-4 space-y-3 text-xs ${chipCls}`}>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
                Tag
              </label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as HqUpdateRecord["tag"])}
                className={`w-full h-9 px-2.5 rounded-xl border font-mono ${inputCls}`}
              >
                <option value="RELEASE">RELEASE</option>
                <option value="HARDWARE">HARDWARE</option>
                <option value="COMPLIANCE">COMPLIANCE</option>
                <option value="GROWTH">GROWTH</option>
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
                CTA Target
              </label>
              <select
                value={ctaTarget}
                onChange={(e) => setCtaTarget(e.target.value as HqUpdateRecord["ctaTarget"])}
                className={`w-full h-9 px-2.5 rounded-xl border ${inputCls}`}
              >
                <option value="reports">Reports</option>
                <option value="download">Desktop / PWA</option>
                <option value="billing">Billing &amp; Plans</option>
                <option value="network">B2B Network</option>
                <option value="auth">Auth Portal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              required
              minLength={3}
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (EN) *"
              className={`h-9 px-3 rounded-xl border ${inputCls}`}
            />
            <input
              type="text"
              maxLength={140}
              value={swTitle}
              onChange={(e) => setSwTitle(e.target.value)}
              placeholder="Title (SW, optional)"
              className={`h-9 px-3 rounded-xl border ${inputCls}`}
            />
          </div>

          <textarea
            rows={2}
            required
            minLength={8}
            maxLength={420}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Capability summary (EN) *"
            className={`w-full p-2.5 rounded-xl border ${inputCls}`}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              maxLength={420}
              value={swSummary}
              onChange={(e) => setSwSummary(e.target.value)}
              placeholder="Summary (SW, optional)"
              className={`h-9 px-3 rounded-xl border ${inputCls}`}
            />
            <input
              type="text"
              maxLength={40}
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="CTA Button Label"
              className={`h-9 px-3 rounded-xl border ${inputCls}`}
            />
          </div>

          <button
            type="submit"
            disabled={busy || title.trim().length < 3 || summary.trim().length < 8}
            className={`w-full h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${t.primaryBtnCls}`}
          >
            {busy && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            <span>{busy ? "Publishing..." : "Publish Capability Update"}</span>
          </button>
        </form>

        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {hqUpdates.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-3.5 space-y-1.5 text-xs ${chipCls}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] font-mono text-[10px] font-bold">
                  {item.tag}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] ${mutedCls}`}>
                    {item.publishedAt.slice(0, 10)}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onRunAction(
                        { action: "delete_hq_update", updateId: item.id },
                        `Removed update: ${item.title}`
                      )
                    }
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold hover:border-red-500/40 hover:text-red-600 cursor-pointer ${cardCls}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="font-bold">{item.title}</div>
              <p className={`text-[11px] leading-relaxed ${mutedCls}`}>{item.summary}</p>
              <div className="text-[10px] font-mono text-[#1039B9] dark:text-[#38BDF8]">
                CTA: {item.ctaLabel} &rarr; {item.ctaTarget}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Full-Width Row: Enterprise Quote Requests & Supplier Invites */}
      <div className={`xl:col-span-12 rounded-2xl border p-5 space-y-4 ${cardCls}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enterprise Quotes */}
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-[#38BDF8]">
                Sales Pipeline
              </div>
              <h3 className="text-base font-semibold">
                Enterprise &amp; Partner Quote Requests ({quoteRequests.length})
              </h3>
            </div>
            {quoteRequests.length === 0 ? (
              <div className={`rounded-xl border p-4 text-xs ${chipCls} ${mutedCls}`}>
                No Supabase quote requests currently queued.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {quoteRequests.map((q) => (
                  <div key={q.id} className={`rounded-xl border p-3 text-xs flex flex-wrap items-center justify-between gap-2 ${chipCls}`}>
                    <div className="min-w-0">
                      <div className="font-bold">{q.companyName} ({q.locations} locations)</div>
                      <div className={`text-[11px] ${mutedCls}`}>
                        {q.contactName} &middot; {q.email} &middot; {q.planName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-slate-500/15 text-[10px] font-mono uppercase">
                        {q.status}
                      </span>
                      {q.status !== "contacted" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void onRunAction(
                              { action: "mark_quote_contacted", quoteId: q.id },
                              `Marked quote from ${q.companyName} as contacted`
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#1039B9] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Mark Contacted
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supplier Onboarding Invites */}
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-[#38BDF8]">
                Wholesale Distribution
              </div>
              <h3 className="text-base font-semibold">
                Supplier Invites ({supplierInvites.length})
              </h3>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!inviteEmail.trim() || !inviteCompany.trim()) return;
                const ok = await onRunAction(
                  {
                    action: "create_supplier_invite",
                    email: inviteEmail.trim(),
                    companyName: inviteCompany.trim(),
                  },
                  `Dispatched supplier invite to ${inviteEmail.trim()}`
                );
                if (ok) {
                  setInviteEmail("");
                  setInviteCompany("");
                }
              }}
              className="flex flex-wrap gap-2 text-xs"
            >
              <input
                type="text"
                value={inviteCompany}
                onChange={(e) => setInviteCompany(e.target.value)}
                placeholder="Supplier company name"
                required
                className={`flex-1 min-w-[140px] h-8 px-2.5 rounded-lg border ${inputCls}`}
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="supplier@company.co.tz"
                required
                className={`flex-1 min-w-[160px] h-8 px-2.5 rounded-lg border ${inputCls}`}
              />
              <button
                type="submit"
                disabled={busy}
                className="h-8 px-3 rounded-lg bg-[#1039B9] text-white font-semibold cursor-pointer"
              >
                Send Invite
              </button>
            </form>

            {supplierInvites.length === 0 ? (
              <div className={`rounded-xl border p-4 text-xs ${chipCls} ${mutedCls}`}>
                No pending supplier invites in Supabase.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {supplierInvites.map((inv) => (
                  <div key={inv.id} className={`rounded-xl border p-2.5 text-xs flex items-center justify-between gap-2 ${chipCls}`}>
                    <div className="min-w-0 truncate">
                      <span className="font-bold">{inv.companyName}</span>{" "}
                      <span className={mutedCls}>&middot; {inv.email}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-full bg-slate-500/15 text-[10px] font-mono uppercase">
                        {inv.status}
                      </span>
                      {inv.status === "pending" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void onRunAction(
                              { action: "cancel_supplier_invite", inviteId: inv.id },
                              `Cancelled invite for ${inv.companyName}`
                            )
                          }
                          className="px-2 py-0.5 rounded border border-red-500/30 text-red-600 text-[10px] font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
