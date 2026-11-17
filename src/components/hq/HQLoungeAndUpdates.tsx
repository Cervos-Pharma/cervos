"use client";

import { useState, type FormEvent } from "react";
import type {
  HqFleetAccount,
  HqJoinRequestRecord,
  HqUpdateRecord,
} from "./types";

interface HQLoungeAndUpdatesProps {
  joinRequests: HqJoinRequestRecord[];
  accounts: HqFleetAccount[];
  hqUpdates: HqUpdateRecord[];
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
  onRunAction,
  isDark,
  busy,
}: HQLoungeAndUpdatesProps) {
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

  const cardCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-100"
    : "bg-white border-[#EAECF0] text-[#111317]";
  const chipCls = isDark
    ? "bg-[#171D28] border-slate-800 text-slate-200"
    : "bg-[#F8FAFC] border-[#EAECF0] text-[#111317]";
  const inputCls = isDark
    ? "bg-[#090C12] border-slate-700 text-slate-100 placeholder:text-slate-500"
    : "bg-[#F8FAFC] border-[#CBD5E1] text-[#111317] placeholder:text-slate-400";
  const mutedCls = isDark ? "text-slate-400" : "text-[#64748B]";

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
            className="w-full h-9 rounded-xl bg-[#1039B9] hover:bg-[#0d2e94] text-white font-semibold disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Publishing..." : "Publish Capability Update"}
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
    </div>
  );
}
