"use client";

import { useState, type FormEvent } from "react";
import { hqSurfaceTokens } from "./hqSurface";
import type { HqFleetAccount, HqMessageRecord } from "./types";

interface HQMessageComposerProps {
  accounts: HqFleetAccount[];
  hqMessages: HqMessageRecord[];
  defaultAccountId: string;
  operatorName: string;
  onRunAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
  isDark: boolean;
  busy: boolean;
}

type CtaTarget = "overview" | "reports" | "billing" | "network" | "team" | "download";

const TEMPLATES = [
  {
    label: "FEFO Inspection",
    severity: "action" as const,
    ctaLabel: "Open Reports",
    ctaTarget: "reports" as CtaTarget,
    title: "Monthly FEFO & Cold-Chain Audit Due",
    swTitle: "Ukaguzi wa Kila Mwezi wa FEFO na Stoo",
    body: "Please verify all near-expiry lots in Reports and confirm quarantine tags before Friday 17:00 EAT.",
    swBody: "Tafadhali kagua dawa zinazokaribia kuisha muda kwenye Ripoti na uthibitishe karantini kabla ya Ijumaa saa 11 jioni.",
  },
  {
    label: "Billing Reminder",
    severity: "action" as const,
    ctaLabel: "Open Billing",
    ctaTarget: "billing" as CtaTarget,
    title: "Subscription Renewal Notice",
    swTitle: "Ukumbusho wa Malipo ya Usajili",
    body: "Your active billing cycle renews shortly. Confirm M-Pesa or bank settlement in Billing to avoid service interruption.",
    swBody: "Muda wa malipo unakaribia. Thibitisha malipo ya M-Pesa au benki kwenye Malipo ili huduma zisiathirike.",
  },
  {
    label: "Critical Recall Alert",
    severity: "critical" as const,
    ctaLabel: "Inspect Stock",
    ctaTarget: "overview" as CtaTarget,
    title: "Urgent Batch Quarantine Advisory",
    swTitle: "Tahadhari ya Haraka ya Karantini ya Dawa",
    body: "Immediately isolate any flagged lot in Inventory and submit a compliance check via your HQ trail.",
    swBody: "Tenga mara moja toleo lililoainishwa kwenye Stoo na uthibitishe ukaguzi kupitia kituo cha HQ.",
  },
];

export default function HQMessageComposer({
  accounts,
  hqMessages,
  defaultAccountId,
  operatorName,
  onRunAction,
  isDark,
  busy,
}: HQMessageComposerProps) {
  const [targetAccountId, setTargetAccountId] = useState(
    defaultAccountId || accounts[0]?.id || "ALL"
  );
  const [severity, setSeverity] = useState<"info" | "action" | "critical">("action");
  const [title, setTitle] = useState("");
  const [swTitle, setSwTitle] = useState("");
  const [body, setBody] = useState("");
  const [swBody, setSwBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Inspect");
  const [ctaTarget, setCtaTarget] = useState<CtaTarget>("overview");
  const [deliveryChannel, setDeliveryChannel] = useState<"in_app" | "sms_textify" | "both">("both");
  const [senderName, setSenderName] = useState(operatorName || "Cervos Ops Desk");
  const [previewLang, setPreviewLang] = useState<"EN" | "SW">("EN");
  const [historyFilterOrg, setHistoryFilterOrg] = useState("ALL");

  const t = hqSurfaceTokens(isDark);
  const cardCls = t.panelCls;
  const chipCls = t.wellCls;
  const inputCls = t.inputCls;
  const mutedCls = t.mutedCls;

  const applyTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    setSeverity(tpl.severity);
    setCtaLabel(tpl.ctaLabel);
    setCtaTarget(tpl.ctaTarget);
    setTitle(tpl.title);
    setSwTitle(tpl.swTitle);
    setBody(tpl.body);
    setSwBody(tpl.swBody);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || body.trim().length < 5) return;
    const isAll = targetAccountId === "ALL";
    const targetName = isAll
      ? "all organizations"
      : targetAccountId.startsWith("ROLE:")
        ? `all ${targetAccountId.slice(5)} accounts`
        : accounts.find((a) => a.id === targetAccountId)?.orgName || targetAccountId;

    const ok = await onRunAction(
      {
        action: "send_message",
        accountId: targetAccountId,
        broadcastAll: isAll,
        deliveryChannel,
        title: title.trim(),
        swTitle: swTitle.trim() || title.trim(),
        body: body.trim(),
        swBody: swBody.trim() || body.trim(),
        severity,
        ctaLabel: ctaLabel.trim() || "Inspect",
        ctaTarget,
        senderName: senderName.trim() || "Cervos Ops Desk",
      },
      `Dispatched ${severity.toUpperCase()} message (${deliveryChannel}) to ${targetName}`
    );

    if (ok) {
      setTitle("");
      setSwTitle("");
      setBody("");
      setSwBody("");
    }
  };

  const filteredMessages = hqMessages.filter(
    (m) => historyFilterOrg === "ALL" || m.accountId === historyFilterOrg
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left: Bilingual Composer */}
      <form
        onSubmit={handleSubmit}
        className={`xl:col-span-6 rounded-[24px] border p-5 space-y-4 ${cardCls}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-[#38BDF8]">
              Live Owner Action Trail &amp; Bell Push
            </div>
            <h2
              className="text-lg font-semibold tracking-tight mt-0.5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Custom HQ Message Composer
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold cursor-pointer hover:border-[#1039B9]/40 ${chipCls}`}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
              Recipient Audience (All, User Type, or Individual)
            </label>
            <select
              value={targetAccountId}
              onChange={(e) => setTargetAccountId(e.target.value)}
              className={`w-full h-10 px-3 rounded-xl border ${inputCls}`}
            >
              <option value="ALL">Broadcast to ALL Organizations ({accounts.length})</option>
              <optgroup label="By User / Organization Type">
                {(["pharmacy", "supplier", "dispensary", "researcher", "investor", "other"] as const).map((rType) => {
                  const cnt = accounts.filter((a) => a.roleType === rType).length;
                  return (
                    <option key={rType} value={`ROLE:${rType}`}>
                      All {rType.charAt(0).toUpperCase() + rType.slice(1)} Users ({cnt})
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Individual Organizations">
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.orgName} ({acc.roleType} &middot; {acc.region})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
              Severity Level
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["info", "action", "critical"] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverity(sev)}
                  className={`h-10 rounded-xl border text-xs font-bold uppercase cursor-pointer transition-colors ${
                    severity === sev
                      ? sev === "critical"
                        ? "bg-red-600 border-red-600 text-white"
                        : sev === "action"
                        ? "bg-amber-600 border-amber-600 text-white"
                        : "bg-[#1039B9] border-[#1039B9] text-white"
                      : chipCls
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
              Title (English) *
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Action Required: Verify Branch Permit"
              className={`w-full h-10 px-3 rounded-xl border focus:outline-none focus:border-[#1039B9] ${inputCls}`}
            />
          </div>

          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
              Title (Swahili, optional)
            </label>
            <input
              type="text"
              maxLength={120}
              value={swTitle}
              onChange={(e) => setSwTitle(e.target.value)}
              placeholder="Defaults to English if blank"
              className={`w-full h-10 px-3 rounded-xl border focus:outline-none focus:border-[#1039B9] ${inputCls}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
              Message Body (English) *
            </label>
            <textarea
              rows={4}
              required
              minLength={5}
              maxLength={500}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write clear instructions for the workspace owner..."
              className={`w-full p-3 rounded-xl border focus:outline-none focus:border-[#1039B9] ${inputCls}`}
            />
          </div>

          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
              Message Body (Swahili, optional)
            </label>
            <textarea
              rows={4}
              maxLength={500}
              value={swBody}
              onChange={(e) => setSwBody(e.target.value)}
              placeholder="Andika maelekezo ya Kiswahili..."
              className={`w-full p-3 rounded-xl border focus:outline-none focus:border-[#1039B9] ${inputCls}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
              CTA Button Label
            </label>
            <input
              type="text"
              maxLength={40}
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Inspect"
              className={`w-full h-9 px-3 rounded-xl border ${inputCls}`}
            />
          </div>
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
              CTA Target Module
            </label>
            <select
              value={ctaTarget}
              onChange={(e) => setCtaTarget(e.target.value as CtaTarget)}
              className={`w-full h-9 px-3 rounded-xl border ${inputCls}`}
            >
              <option value="overview">Overview</option>
              <option value="reports">Reports Intelligence</option>
              <option value="billing">Billing &amp; Plan</option>
              <option value="network">B2B Network</option>
              <option value="team">Team &amp; Permits</option>
              <option value="download">Desktop / PWA App</option>
            </select>
          </div>
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
              Sender Signature
            </label>
            <input
              type="text"
              maxLength={80}
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className={`w-full h-9 px-3 rounded-xl border ${inputCls}`}
            />
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <label className={`block text-[10px] font-bold uppercase ${mutedCls}`}>
            Delivery Channel (Textify SMS Sender: &ldquo;Nama&rdquo;)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "in_app", label: "In-App Notice" },
                { id: "sms_textify", label: "Textify SMS (Nama)" },
                { id: "both", label: "In-App + SMS (Nama)" },
              ] as const
            ).map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setDeliveryChannel(ch.id)}
                className={`h-9 px-2.5 rounded-xl border text-[11px] font-semibold cursor-pointer transition-colors ${
                  deliveryChannel === ch.id
                    ? "bg-[#1039B9] border-[#1039B9] text-white"
                    : chipCls
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Owner Preview */}
        <div className={`rounded-2xl border p-3.5 space-y-2 ${chipCls}`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase">
            <span className={mutedCls}>Owner Action Trail Preview</span>
            <div className="flex gap-1">
              {(["EN", "SW"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setPreviewLang(l)}
                  className={`px-2 py-0.5 rounded font-mono cursor-pointer ${
                    previewLang === l ? "bg-[#1039B9] text-white" : cardCls
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className={`rounded-xl border p-3 text-xs space-y-1.5 ${cardCls}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] font-mono text-[9px]">
                  HQ
                </span>
                <span>
                  {(previewLang === "SW" ? swTitle || title : title) || "HQ Notice Title"}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                  severity === "critical"
                    ? "bg-red-500/15 text-red-700 dark:text-red-300"
                    : severity === "action"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-blue-500/15 text-[#1039B9] dark:text-[#38BDF8]"
                }`}
              >
                {severity}
              </span>
            </div>
            <p className={`text-[11px] ${mutedCls}`}>
              {(previewLang === "SW" ? swBody || body : body) ||
                "Message content will appear in the owner's General Hub Action Trail and Notification Bell."}
            </p>
            <div className="flex items-center justify-between pt-1 text-[10px]">
              <span className={mutedCls}>From {senderName || "Cervos HQ Desk"}</span>
              <span className="px-2.5 py-1 rounded-full bg-[#1039B9] text-white font-semibold">
                {ctaLabel || "Inspect"} &rarr; {ctaTarget}
              </span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || title.trim().length < 3 || body.trim().length < 5}
          className={`w-full h-11 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${t.primaryBtnCls}`}
        >
          {busy && (
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          <span>
            {busy
              ? "Dispatching..."
              : targetAccountId === "ALL"
              ? `Broadcast to All ${accounts.length} Organizations`
              : "Send Live HQ Notice"}
          </span>
        </button>
      </form>

      {/* Right: Dispatched HQ Messages Trail */}
      <div className={`xl:col-span-6 rounded-[24px] border p-5 space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3
              className="text-lg font-semibold tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Dispatched HQ Notices ({filteredMessages.length})
            </h3>
            <p className={`text-xs ${mutedCls}`}>
              Track owner acknowledgments and inbound owner replies from /app.
            </p>
          </div>

          <select
            value={historyFilterOrg}
            onChange={(e) => setHistoryFilterOrg(e.target.value)}
            className={`h-9 px-3 rounded-xl border text-xs ${inputCls}`}
          >
            <option value="ALL">All Orgs</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.orgName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
          {filteredMessages.length === 0 ? (
            <div className={`rounded-2xl border p-8 text-center text-xs ${chipCls} ${mutedCls}`}>
              No HQ messages dispatched yet.
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-2xl border p-4 space-y-2 text-xs ${chipCls}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          msg.severity === "critical"
                            ? "bg-red-500/15 text-red-700 dark:text-red-300"
                            : msg.severity === "action"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-blue-500/15 text-[#1039B9] dark:text-[#38BDF8]"
                        }`}
                      >
                        {msg.severity}
                      </span>
                      <span className="font-bold">{msg.orgName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          msg.acknowledged
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {msg.acknowledged ? "Acknowledged" : "Pending Read"}
                      </span>
                    </div>
                    <div className="text-sm font-semibold pt-1">{msg.title}</div>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onRunAction(
                        { action: "delete_hq_message", messageId: msg.id },
                        "Removed HQ message from trail"
                      )
                    }
                    className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold hover:border-red-500/40 hover:text-red-600 cursor-pointer ${cardCls}`}
                  >
                    Remove
                  </button>
                </div>

                <p className={`text-xs leading-relaxed ${mutedCls}`}>{msg.body}</p>

                <div className={`flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] font-mono ${mutedCls}`}>
                  <span>
                    Sender: {msg.senderName} &middot; Target: {msg.ctaTarget || "overview"}
                  </span>
                  <span>{msg.createdAt.slice(0, 16).replace("T", " ")} UTC</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
