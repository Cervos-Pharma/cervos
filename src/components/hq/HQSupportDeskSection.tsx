"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { matchesSearch } from "@/lib/search";
import { CERVOS_HQ_ASSETS, hqSurfaceTokens } from "./hqSurface";
import type {
  HqCurrentSessionWorker,
  HqFleetAccount,
  HqSupportTicketRecord,
  HqWorkerSummary,
} from "./types";

interface HQSupportDeskSectionProps {
  tickets: HqSupportTicketRecord[];
  workers: HqWorkerSummary[];
  accounts: HqFleetAccount[];
  currentWorker?: HqCurrentSessionWorker;
  onRunAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
  onJumpToOrg: (accountId: string) => void;
  isDark: boolean;
  busy: boolean;
}

const CANNED_REPLIES = [
  {
    label: "POS & FEFO Steps",
    text: "Our support team reviewed your branch logs. Please tap Sync Now on the POS banner and confirm earliest batch expiry dates inside Inventory -> Lot Inspector.",
  },
  {
    label: "Billing / Trial Assistance",
    text: "We have inspected your billing ledger. Confirm your M-Pesa / Tigo payout details under Settings & Billing and reply if you need a 48-hour invoice grace window.",
  },
  {
    label: "Operator PIN Reset Done",
    text: "Your branch manager can reset staff PINs directly under Team -> Edit Operator. Let us know if the operator still faces lockouts.",
  },
];

const PRIORITY_BADGE: Record<HqSupportTicketRecord["priority"], string> = {
  low: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  normal: "bg-blue-500/15 text-[#1039B9] dark:text-sky-300",
  high: "bg-amber-500/18 text-amber-700 dark:text-amber-300",
  urgent: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
};

const STATUS_BADGE: Record<HqSupportTicketRecord["status"], string> = {
  open: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  waiting_user: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export default function HQSupportDeskSection({
  tickets,
  workers,
  accounts,
  currentWorker,
  onRunAction,
  onJumpToOrg,
  isDark,
  busy,
}: HQSupportDeskSectionProps) {
  const t = hqSurfaceTokens(isDark);
  const [statusFilter, setStatusFilter] = useState<"all" | HqSupportTicketRecord["status"]>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(tickets[0]?.id ?? "");

  const filtered = useMemo(() => {
    return tickets.filter((tk) => {
      if (statusFilter !== "all" && tk.status !== statusFilter) return false;
      if (onlyMine && tk.assignedWorkerId !== currentWorker?.id) return false;
      return matchesSearch(
        query,
        tk.ticketRef,
        tk.subject,
        tk.message,
        tk.contactEmail,
        tk.orgName,
        tk.category,
        tk.assignedWorkerName
      );
    });
  }, [tickets, statusFilter, onlyMine, query, currentWorker?.id]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((x) => x.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const activeTicket =
    filtered.find((x) => x.id === selectedId) ??
    tickets.find((x) => x.id === selectedId) ??
    filtered[0] ??
    null;

  const [replyDraft, setReplyDraft] = useState("");
  const [nextStatus, setNextStatus] = useState<HqSupportTicketRecord["status"]>("waiting_user");
  const [sendSms, setSendSms] = useState(false);
  const [internalNoteDraft, setInternalNoteDraft] = useState("");

  useEffect(() => {
    if (activeTicket) {
      setInternalNoteDraft(activeTicket.internalNote ?? "");
      setNextStatus(activeTicket.status === "resolved" ? "resolved" : "waiting_user");
    }
  }, [activeTicket?.id]);

  const linkedAccount = activeTicket?.accountId
    ? accounts.find((a) => a.id === activeTicket.accountId)
    : activeTicket
      ? accounts.find((a) => a.email.toLowerCase() === activeTicket.contactEmail.toLowerCase())
      : undefined;

  const activeWorkers = workers.filter((w) => w.status === "active");

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeTicket || replyDraft.trim().length < 2) return;
    const ok = await onRunAction(
      {
        action: "reply_support_ticket",
        ticketId: activeTicket.id,
        replyBody: replyDraft.trim(),
        nextStatus,
        sendSms,
      },
      `Replied to ${activeTicket.ticketRef} (${nextStatus.replace("_", " ")})`
    );
    if (ok) {
      setReplyDraft("");
    }
  };

  const handleSaveMeta = async (patch: Record<string, unknown>, message: string) => {
    if (!activeTicket) return;
    await onRunAction(
      {
        action: "update_support_ticket",
        ticketId: activeTicket.id,
        ...patch,
      },
      message
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Support Desk Brand Ribbon + Metrics */}
      <div className={`p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center ${t.panelCls}`}>
        <div className="lg:col-span-7 flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl overflow-hidden shrink-0 p-1 ${t.wellCls}`}>
            <img
              src={CERVOS_HQ_ASSETS.peopleCounter}
              alt="Cervos Pharmacy Front Desk Support"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div>
            <h2
              className="text-lg font-semibold tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              HQ Support &amp; Escalation Desk
            </h2>
            <p className={`text-xs mt-0.5 ${t.mutedCls}`}>
              Answer web &amp; in-app tickets, dispatch replies directly to pharmacy HQ inboxes + SMS, claim cases, and track private internal notes.
            </p>
          </div>
        </div>
        <div className="lg:col-span-5 grid grid-cols-3 gap-2.5">
          {[
            { label: "Open Queue", val: tickets.filter((x) => x.status === "open").length },
            { label: "In Progress", val: tickets.filter((x) => x.status === "in_progress" || x.status === "waiting_user").length },
            { label: "Resolved", val: tickets.filter((x) => x.status === "resolved").length },
          ].map((stat) => (
            <div key={stat.label} className={`p-3 text-center ${t.wellCls}`}>
              <div className="text-lg font-bold tabular-nums">{stat.val}</div>
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${t.mutedCls}`}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Split Queue + Ticket Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Queue */}
        <section className={`xl:col-span-5 p-5 space-y-3.5 ${t.panelCls}`}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SUP ref, pharmacy, email, or issue..."
            className={`w-full h-10 px-3.5 rounded-2xl text-xs ${t.inputCls}`}
          />

          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "open", "in_progress", "waiting_user", "resolved"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold capitalize cursor-pointer ${
                  statusFilter === st ? t.primaryBtnCls : `${t.pillCls}`
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOnlyMine((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${
                onlyMine ? t.primaryBtnCls : `${t.pillCls}`
              }`}
            >
              Assigned to Me
            </button>
          </div>

          <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className={`p-6 text-center space-y-3 ${t.wellCls}`}>
                <img
                  src={CERVOS_HQ_ASSETS.dispensaryDesk}
                  alt="Quiet Cervos Dispensary Desk"
                  className="w-full h-32 object-cover rounded-xl opacity-90"
                />
                <div className={`text-xs ${t.mutedCls}`}>
                  No support tickets match the active filters. Incoming landing, auth, and in-app workspace tickets stream here automatically.
                </div>
              </div>
            ) : (
              filtered.map((tk) => {
                const selected = tk.id === activeTicket?.id;
                return (
                  <button
                    key={tk.id}
                    type="button"
                    onClick={() => setSelectedId(tk.id)}
                    className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer ${
                      selected
                        ? `${t.wellCls} ring-2 ring-[#1039B9]/45`
                        : `${t.pillCls} hover:scale-[1.005]`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#1039B9] dark:text-sky-300">
                        {tk.ticketRef}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${PRIORITY_BADGE[tk.priority]}`}>
                          {tk.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_BADGE[tk.status]}`}>
                          {tk.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs font-semibold mt-1.5 line-clamp-1">{tk.subject}</div>
                    <div className={`text-[11px] mt-0.5 truncate ${t.mutedCls}`}>
                      {tk.orgName || tk.contactEmail} &middot; {tk.category} &middot;{" "}
                      {tk.assignedWorkerName ? `Owner: ${tk.assignedWorkerName}` : "Unassigned"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right Conversation & Resolution Workbench */}
        <section className={`xl:col-span-7 p-6 space-y-5 ${t.panelCls}`}>
          {!activeTicket ? (
            <div className={`p-10 text-center text-xs ${t.wellCls} ${t.mutedCls}`}>
              Select a ticket from the queue to answer, assign an HQ specialist, or inspect org telemetry.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#1039B9]/12 text-[#1039B9] dark:text-sky-300">
                      {activeTicket.ticketRef}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_BADGE[activeTicket.status]}`}>
                      {activeTicket.status.replace("_", " ")}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${PRIORITY_BADGE[activeTicket.priority]}`}>
                      {activeTicket.priority} priority
                    </span>
                  </div>
                  <h3
                    className="text-lg font-semibold mt-2"
                    style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                  >
                    {activeTicket.subject}
                  </h3>
                  <div className={`text-xs mt-0.5 ${t.mutedCls}`}>
                    From <strong className="text-current">{activeTicket.contactName || activeTicket.contactEmail}</strong>{" "}
                    ({activeTicket.contactEmail}) &middot; Source: {activeTicket.source}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {currentWorker && activeTicket.assignedWorkerId !== currentWorker.id && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        handleSaveMeta(
                          { assignedWorkerId: currentWorker.id, status: "in_progress" },
                          `Claimed ${activeTicket.ticketRef} for ${currentWorker.name}`
                        )
                      }
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${t.primaryBtnCls}`}
                    >
                      {busy && (
                        <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      )}
                      <span>Claim Ticket</span>
                    </button>
                  )}
                  {linkedAccount && (
                    <button
                      type="button"
                      onClick={() => onJumpToOrg(linkedAccount.id)}
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer ${t.pillCls}`}
                    >
                      Inspect {linkedAccount.orgName}
                    </button>
                  )}
                </div>
              </div>

              {/* Ticket Routing Controls (Assignee, Status, Priority) */}
              <div className={`p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 ${t.wellCls}`}>
                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${t.mutedCls}`}>
                    Assigned Specialist
                  </label>
                  <select
                    value={activeTicket.assignedWorkerId ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      handleSaveMeta(
                        { assignedWorkerId: e.target.value },
                        `Updated assignee on ${activeTicket.ticketRef}`
                      )
                    }
                    className={`w-full h-9 px-3 rounded-xl text-xs ${t.inputCls}`}
                  >
                    <option value="">Unassigned</option>
                    {currentWorker && !activeWorkers.some((w) => w.id === currentWorker.id) && (
                      <option value={currentWorker.id}>{currentWorker.name} (You)</option>
                    )}
                    {activeWorkers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.role.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${t.mutedCls}`}>
                    Workflow Status
                  </label>
                  <select
                    value={activeTicket.status}
                    disabled={busy}
                    onChange={(e) =>
                      handleSaveMeta(
                        { status: e.target.value },
                        `Marked ${activeTicket.ticketRef} as ${e.target.value.replace("_", " ")}`
                      )
                    }
                    className={`w-full h-9 px-3 rounded-xl text-xs ${t.inputCls}`}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_user">Waiting User</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${t.mutedCls}`}>
                    Priority Level
                  </label>
                  <select
                    value={activeTicket.priority}
                    disabled={busy}
                    onChange={(e) =>
                      handleSaveMeta(
                        { priority: e.target.value },
                        `Set ${activeTicket.ticketRef} priority to ${e.target.value}`
                      )
                    }
                    className={`w-full h-9 px-3 rounded-xl text-xs ${t.inputCls}`}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="space-y-3">
                <div className={`p-4 space-y-1.5 ${t.wellCls}`}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold">
                      {activeTicket.contactName || activeTicket.contactEmail} (Customer Report)
                    </span>
                    <span className={`font-mono text-[10px] ${t.mutedCls}`}>
                      {activeTicket.createdAt.slice(0, 16).replace("T", " ")}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{activeTicket.message}</p>
                </div>

                {activeTicket.replies.map((rep) => (
                  <div
                    key={rep.id}
                    className={`p-4 rounded-2xl border space-y-1.5 ${
                      rep.authorRole === "hq"
                        ? "border-[#1039B9]/25 bg-[#1039B9]/8 dark:bg-[#1039B9]/18"
                        : t.wellCls
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#1039B9] dark:text-sky-300">
                        {rep.authorName} &middot; Cervos HQ Reply
                      </span>
                      <span className={`font-mono text-[10px] ${t.mutedCls}`}>
                        {rep.createdAt.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{rep.body}</p>
                  </div>
                ))}
              </div>

              {/* Reply Composer */}
              <form onSubmit={handleSendReply} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Customer Reply (Streams to Org HQ Inbox)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CANNED_REPLIES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => setReplyDraft(tpl.text)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer ${t.pillCls}`}
                      >
                        + {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Write your official HQ support answer..."
                  className={`w-full p-3.5 rounded-2xl text-xs ${t.inputCls}`}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as HqSupportTicketRecord["status"])}
                      className={`h-9 px-3 rounded-xl text-xs ${t.inputCls}`}
                    >
                      <option value="waiting_user">After send: Waiting User</option>
                      <option value="in_progress">After send: Keep In Progress</option>
                      <option value="resolved">After send: Mark Resolved</option>
                    </select>
                    {linkedAccount && (
                      <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendSms}
                          onChange={(e) => setSendSms(e.target.checked)}
                        />
                        <span>Also notify via SMS</span>
                      </label>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={busy || replyDraft.trim().length < 2}
                    className={`px-5 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer ${t.primaryBtnCls}`}
                  >
                    {busy && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    <span>{busy ? "Sending Reply..." : "Send HQ Reply"}</span>
                  </button>
                </div>
              </form>

              {/* Private Internal HQ Note */}
              <div className={`p-4 space-y-2.5 ${t.wellCls}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Private Internal HQ Note (Never Shown to Customer)
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      handleSaveMeta(
                        { internalNote: internalNoteDraft },
                        `Saved internal note on ${activeTicket.ticketRef}`
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${t.pillCls}`}
                  >
                    {busy && (
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    )}
                    <span>Save Note</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={internalNoteDraft}
                  onChange={(e) => setInternalNoteDraft(e.target.value)}
                  placeholder="Internal diagnostics, escalation summary, or billing note for HQ teammates..."
                  className={`w-full p-3 rounded-xl text-xs ${t.inputCls}`}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
