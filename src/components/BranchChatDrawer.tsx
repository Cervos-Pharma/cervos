"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconLock } from "@/components/LandingIcons";

export interface BranchChatRecordAttachment {
  kind: "wholesale_request" | "batch" | "sale" | "order";
  refId: string;
  title: string;
  subtitle: string;
  catalogId?: string;
  quantity?: number;
  amountTzs?: number;
  approvalStatus?: "pending" | "approved" | "declined";
}

export interface BranchChatMsg {
  id: string;
  centreId: string;
  senderProfileId: string;
  senderName: string;
  senderRole: string;
  body: string;
  attachment?: BranchChatRecordAttachment;
  createdAt: string;
}

interface AttachableOption {
  kind: "batch" | "order";
  refId: string;
  title: string;
  subtitle: string;
}

interface BranchChatDrawerProps {
  open: boolean;
  onClose: () => void;
  centreName: string;
  currentProfileId: string;
  canManageAdmin: boolean;
  messages: BranchChatMsg[];
  attachableRecords: AttachableOption[];
  accent: string;
  isDark: boolean;
  isSw?: boolean;
  onSendMessage: (body: string, attachment?: BranchChatRecordAttachment) => Promise<void>;
  onResolveApproval: (messageId: string, decision: "approve" | "decline") => Promise<string | null>;
}

/**
 * Right-side collapsible Branch-Specific WhatsApp-style team chat drawer.
 * Displays role badges, attached system records (lots/orders), and enforces
 * two-step Owner confirmation ("Review -> Are you sure?") on operator requests.
 */
export default function BranchChatDrawer({
  open,
  onClose,
  centreName,
  currentProfileId,
  canManageAdmin,
  messages,
  attachableRecords,
  accent,
  isDark,
  isSw = false,
  onSendMessage,
  onResolveApproval,
}: BranchChatDrawerProps) {
  const [draft, setDraft] = useState("");
  const [selectedAttach, setSelectedAttach] = useState<AttachableOption | null>(null);
  const [attachPickerOpen, setAttachPickerOpen] = useState(false);
  const [confirmStep2Id, setConfirmStep2Id] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() && !selectedAttach) return;
    setSending(true);
    setActionErr(null);
    try {
      await onSendMessage(
        draft.trim(),
        selectedAttach
          ? {
              kind: selectedAttach.kind,
              refId: selectedAttach.refId,
              title: selectedAttach.title,
              subtitle: selectedAttach.subtitle,
            }
          : undefined
      );
      setDraft("");
      setSelectedAttach(null);
      setAttachPickerOpen(false);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmDecision = async (messageId: string, decision: "approve" | "decline") => {
    setActionErr(null);
    const err = await onResolveApproval(messageId, decision);
    if (err) {
      setActionErr(err);
      return;
    }
    setConfirmStep2Id(null);
  };

  const roleBadgeCls = (role: string) => {
    if (role.includes("owner") || role.includes("admin")) {
      return "bg-[#E2F575] text-[#111317]";
    }
    if (role.includes("pharmacist")) {
      return isDark ? "bg-teal-900/60 text-teal-200" : "bg-teal-50 text-[#006875]";
    }
    return isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600";
  };

  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div
      aria-label="Branch Group Chat"
      className={`h-full min-h-0 w-full flex flex-col overflow-hidden ${
        isDark ? "text-slate-100" : "text-[#111317]"
      }`}
    >
      {/* Header */}
      <div
        className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
          isDark ? "border-slate-800" : "border-[#EAECF0]"
        }`}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
            {isSw ? "MAWASILIANO YA TAWI TU" : "BRANCH GROUP CHAT"}
          </div>
          <div className="text-sm font-bold truncate">{centreName}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close branch chat"
          className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm cursor-pointer ${
            isDark ? "border-slate-700 hover:bg-slate-800" : "border-[#EAECF0] hover:bg-slate-50"
          }`}
        >
          &times;
        </button>
      </div>

      {actionErr && (
        <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] font-medium text-rose-500">
          {actionErr}
        </div>
      )}

      {/* Messages Stream */}
      <div ref={streamRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 overscroll-contain">
        {messages.length === 0 ? (
          <div className={`text-xs text-center py-10 ${mutedCls}`}>
            {isSw
              ? "Hakuna ujumbe bado kwa tawi hili. Anza mazungumzo au ambatanisha rekodi."
              : "No branch messages yet. Start a shift note or attach a system record."}
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderProfileId === currentProfileId;
            const att = msg.attachment;
            const isPendingApproval = att?.kind === "wholesale_request" && att.approvalStatus === "pending";

            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-bold">{msg.senderName}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${roleBadgeCls(msg.senderRole)}`}>
                    {msg.senderRole.replace(/_/g, " ")}
                  </span>
                </div>

                <div
                  className={`max-w-[92%] rounded-2xl p-3.5 text-xs space-y-2.5 border ${
                    isMine
                      ? isDark
                        ? "bg-[#16233B] border-[#1039B9]/40 text-slate-100"
                        : "bg-[#EFF6FF] border-blue-200/80 text-[#111317]"
                      : isDark
                        ? "bg-[#151B26] border-slate-800 text-slate-100"
                        : "bg-[#F8FAFC] border-[#E2E8F0] text-[#111317]"
                  }`}
                >
                  <p className="leading-relaxed">{msg.body}</p>

                  {att && (
                    <div
                      className={`rounded-xl border p-2.5 space-y-2 ${
                        isDark ? "bg-[#0E131C]/90 border-slate-700" : "bg-white border-[#E2E8F0]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold truncate">{att.title}</div>
                          <div className={`text-[10px] ${mutedCls}`}>{att.subtitle}</div>
                        </div>
                        {att.approvalStatus && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                              att.approvalStatus === "approved"
                                ? "bg-emerald-500/15 text-emerald-500"
                                : att.approvalStatus === "declined"
                                  ? "bg-rose-500/15 text-rose-500"
                                  : "bg-amber-500/15 text-amber-600"
                            }`}
                          >
                            {att.approvalStatus}
                          </span>
                        )}
                      </div>

                      {/* Two-Step Insistence Owner Confirmation Inside Chat */}
                      {isPendingApproval && canManageAdmin && (
                        confirmStep2Id === msg.id ? (
                          <div className="pt-1.5 border-t border-slate-200/20 space-y-2">
                            <div className="text-[11px] font-semibold text-amber-600">
                              {isSw
                                ? "Una uhakika? Hatua hii itatuma oda kwenye Kasri escrow."
                                : "Are you sure? Confirm to place order & hold Kasri escrow."}
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDecision(msg.id, "approve")}
                                className="flex-1 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <IconCheck className="w-3 h-3" />
                                <span>{isSw ? "Ndiyo, Thibitisha" : "Yes, Confirm"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmStep2Id(null)}
                                className={`px-3 py-1.5 rounded-full border text-[10px] font-semibold cursor-pointer ${
                                  isDark ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"
                                }`}
                              >
                                {isSw ? "Ghairi" : "Cancel"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setConfirmStep2Id(msg.id)}
                              className="flex-1 py-1.5 rounded-full text-white text-[10px] font-bold cursor-pointer"
                              style={{ backgroundColor: accent }}
                            >
                              {isSw ? "Idhinisha Oda" : "Approve Request"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDecision(msg.id, "decline")}
                              className={`px-3 py-1.5 rounded-full border text-[10px] font-semibold text-rose-500 cursor-pointer ${
                                isDark ? "border-slate-700" : "border-slate-200"
                              }`}
                            >
                              {isSw ? "Kataa" : "Decline"}
                            </button>
                          </div>
                        )
                      )}

                      {isPendingApproval && !canManageAdmin && (
                        <div className={`text-[10px] flex items-center gap-1 ${mutedCls}`}>
                          <IconLock className="w-3 h-3 text-amber-500" />
                          <span>{isSw ? "Inasubiri idhini ya Mmiliki" : "Waiting for Owner two-step confirmation"}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`text-[9px] font-mono ${mutedCls}`}>{msg.createdAt.slice(11, 16)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer with System Record Attachment Picker */}
      <form
        onSubmit={handleSend}
        className={`shrink-0 p-3.5 sm:p-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] border-t space-y-2.5 ${isDark ? "border-slate-800 bg-[#0B0F17]" : "border-[#EAECF0] bg-[#F8FAFC]"}`}
      >
        {attachPickerOpen && (
          <div
            className={`max-h-40 overflow-y-auto rounded-xl border p-2 space-y-1 ${
              isDark ? "bg-[#11161F] border-slate-700" : "bg-white border-[#E2E8F0]"
            }`}
          >
            <div className={`text-[10px] font-bold uppercase px-1.5 py-0.5 ${mutedCls}`}>
              Attach Live Branch Record
            </div>
            {attachableRecords.map((rec) => (
              <button
                key={`${rec.kind}-${rec.refId}`}
                type="button"
                onClick={() => {
                  setSelectedAttach(rec);
                  setAttachPickerOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-blue-50"
                }`}
              >
                <div className="font-semibold truncate">{rec.title}</div>
                <div className={`text-[10px] truncate ${mutedCls}`}>{rec.subtitle}</div>
              </button>
            ))}
          </div>
        )}

        {selectedAttach && (
          <div
            className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-[11px] ${
              isDark ? "bg-[#11161F] border-slate-700" : "bg-white border-blue-200"
            }`}
          >
            <span className="truncate font-semibold">{selectedAttach.title}</span>
            <button
              type="button"
              onClick={() => setSelectedAttach(null)}
              className="text-rose-500 font-bold cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAttachPickerOpen((p) => !p)}
            title="Attach system record"
            className={`px-2.5 py-2 rounded-full border text-[11px] font-semibold shrink-0 cursor-pointer ${
              isDark ? "bg-[#11161F] border-slate-700 text-slate-200" : "bg-white border-[#E2E8F0] text-[#111317]"
            }`}
          >
            + Record
          </button>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isSw ? "Andika ujumbe kwa tawi..." : "Message branch team..."}
            className={`flex-1 px-3.5 py-2 rounded-full border text-xs focus:outline-none ${
              isDark ? "bg-[#11161F] border-slate-700 text-white" : "bg-white border-[#E2E8F0] text-[#111317]"
            }`}
          />
          <button
            type="submit"
            disabled={sending || (!draft.trim() && !selectedAttach)}
            className="px-4 py-2 rounded-full text-white text-xs font-semibold disabled:opacity-45 cursor-pointer shrink-0"
            style={{ backgroundColor: accent }}
          >
            {isSw ? "Tuma" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
