"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconLock } from "@/components/LandingIcons";

export type BranchChatReactionKind = "check" | "thumbs_up" | "heart";

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
  replyTo?: {
    id: string;
    senderName: string;
    body: string;
  };
  mentions?: string[];
  reactions?: Array<{
    kind: BranchChatReactionKind;
    profileId: string;
    name: string;
  }>;
  attachment?: BranchChatRecordAttachment;
  createdAt: string;
}

export interface BranchChatMember {
  id: string;
  displayName: string;
  handle: string;
  role: string;
}

interface AttachableOption {
  kind: "batch" | "order";
  refId: string;
  title: string;
  subtitle: string;
}

interface BranchChatDrawerProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  centreName: string;
  currentProfileId: string;
  canManageAdmin: boolean;
  messages: BranchChatMsg[];
  members?: BranchChatMember[];
  attachableRecords: AttachableOption[];
  accent: string;
  isDark: boolean;
  isSw?: boolean;
  onSendMessage: (
    body: string,
    attachment?: BranchChatRecordAttachment,
    replyToId?: string
  ) => Promise<string | null>;
  onReactMessage?: (messageId: string, kind: BranchChatReactionKind) => Promise<string | null>;
  onResolveApproval: (messageId: string, decision: "approve" | "decline") => Promise<string | null>;
}

/**
 * Branch team chat drawer supporting loading states, inline reactions,
 * direct message replies, @user tagging, and two-step owner approvals.
 */
export default function BranchChatDrawer({
  open,
  loading = false,
  onClose,
  centreName,
  currentProfileId,
  canManageAdmin,
  messages,
  members = [],
  attachableRecords,
  accent,
  isDark,
  isSw = false,
  onSendMessage,
  onReactMessage,
  onResolveApproval,
}: BranchChatDrawerProps) {
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<BranchChatMsg | null>(null);
  const [selectedAttach, setSelectedAttach] = useState<AttachableOption | null>(null);
  const [attachPickerOpen, setAttachPickerOpen] = useState(false);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [confirmStep2Id, setConfirmStep2Id] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reactingKey, setReactingKey] = useState<string | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const activeMentionQuery = useMemo(() => {
    const match = draft.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [draft]);

  const filteredMembers = useMemo(() => {
    if (!mentionPickerOpen && activeMentionQuery === null) return [];
    const needle = activeMentionQuery ?? "";
    return members.filter(
      (m) =>
        m.id !== currentProfileId &&
        (!needle ||
          m.displayName.toLowerCase().includes(needle) ||
          m.handle.toLowerCase().includes(needle))
    );
  }, [members, currentProfileId, mentionPickerOpen, activeMentionQuery]);

  const insertMention = (member: BranchChatMember) => {
    setDraft((prev) => {
      if (/(?:^|\s)@[a-zA-Z0-9._-]*$/.test(prev)) {
        return prev.replace(/@([a-zA-Z0-9._-]*)$/, `@${member.handle} `);
      }
      const sep = prev.length === 0 || prev.endsWith(" ") ? "" : " ";
      return `${prev}${sep}@${member.handle} `;
    });
    setMentionPickerOpen(false);
    inputRef.current?.focus();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!draft.trim() && !selectedAttach) || sending) return;
    setSending(true);
    setActionErr(null);
    try {
      const err = await onSendMessage(
        draft.trim(),
        selectedAttach
          ? {
              kind: selectedAttach.kind,
              refId: selectedAttach.refId,
              title: selectedAttach.title,
              subtitle: selectedAttach.subtitle,
            }
          : undefined,
        replyingTo?.id
      );
      if (err) {
        setActionErr(err);
        return;
      }
      setDraft("");
      setReplyingTo(null);
      setSelectedAttach(null);
      setAttachPickerOpen(false);
      setMentionPickerOpen(false);
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (messageId: string, kind: BranchChatReactionKind) => {
    if (!onReactMessage) return;
    const busyKey = `${messageId}:${kind}`;
    setReactingKey(busyKey);
    try {
      const err = await onReactMessage(messageId, kind);
      if (err) setActionErr(err);
    } finally {
      setReactingKey(null);
    }
  };

  const handleConfirmDecision = async (messageId: string, decision: "approve" | "decline") => {
    setActionErr(null);
    setApprovalBusyId(messageId);
    try {
      const err = await onResolveApproval(messageId, decision);
      if (err) {
        setActionErr(err);
        return;
      }
      setConfirmStep2Id(null);
    } finally {
      setApprovalBusyId(null);
    }
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

  const renderMessageBody = (text: string) => {
    const tokens = text.split(/(@[a-zA-Z0-9._-]+)/g);
    return tokens.map((part, idx) =>
      part.startsWith("@") && part.length > 1 ? (
        <span
          key={idx}
          className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-[#1039B9]/15 text-[#1039B9] dark:text-[#38BDF8] font-semibold"
        >
          {part}
        </span>
      ) : (
        <span key={idx}>{part}</span>
      )
    );
  };

  const reactionIcon = (kind: BranchChatReactionKind) => {
    if (kind === "check") {
      return (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (kind === "heart") {
      return (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
      </svg>
    );
  };

  return (
    <div
      aria-label="Branch Group Chat"
      className={`h-full min-h-0 w-full flex flex-col overflow-hidden ${
        isDark ? "text-slate-100" : "text-[#111317]"
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 sm:px-5 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${
          isDark ? "border-slate-800 bg-[#0D121B]" : "border-[#EAECF0] bg-[#FAFBFD]"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label={isSw ? "Rudi" : "Back"}
            className={`lg:hidden w-8 h-8 rounded-full border flex items-center justify-center shrink-0 cursor-pointer ${
              isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-[#E2E8F0] bg-white text-[#111317]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] truncate" style={{ color: accent }}>
                {isSw ? "MAWASILIANO YA TAWI" : "BRANCH MESSAGES"}
              </span>
            </div>
            <div className="text-sm font-bold truncate">
              {centreName}
              {members.length > 0 && (
                <span className={`ml-1.5 text-[10px] font-medium ${mutedCls}`}>
                  ({members.length})
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close branch chat"
          className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm cursor-pointer shrink-0 ${
            isDark ? "border-slate-700 hover:bg-slate-800" : "border-[#EAECF0] hover:bg-white"
          }`}
        >
          &times;
        </button>
      </div>

      {actionErr && (
        <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] font-medium text-rose-500 flex items-center justify-between gap-2">
          <span>{actionErr}</span>
          <button type="button" onClick={() => setActionErr(null)} className="font-bold cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div ref={streamRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 overscroll-contain">
        {loading && messages.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-xs">
            <span className="w-6 h-6 rounded-full border-2 border-[#1039B9] border-t-transparent animate-spin" />
            <span className={mutedCls}>{isSw ? "Inapakia ujumbe..." : "Loading branch messages..."}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className={`text-xs text-center py-10 ${mutedCls}`}>
            {isSw
              ? "Hakuna ujumbe bado kwa tawi hili. Anza mazungumzo au taja mwenzako na @."
              : "No branch messages yet. Start a shift note or tag a teammate with @."}
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderProfileId === currentProfileId;
            const att = msg.attachment;
            const isPendingApproval = att?.kind === "wholesale_request" && att.approvalStatus === "pending";
            const reactions = msg.reactions ?? [];

            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-bold">{msg.senderName}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${roleBadgeCls(msg.senderRole)}`}>
                    {msg.senderRole.replace(/_/g, " ")}
                  </span>
                </div>

                <div
                  className={`max-w-[92%] rounded-2xl p-3.5 text-xs space-y-2 border ${
                    isMine
                      ? isDark
                        ? "bg-[#16233B] border-[#1039B9]/40 text-slate-100"
                        : "bg-[#EFF6FF] border-blue-200/80 text-[#111317]"
                      : isDark
                        ? "bg-[#151B26] border-slate-800 text-slate-100"
                        : "bg-[#F8FAFC] border-[#E2E8F0] text-[#111317]"
                  }`}
                >
                  {msg.replyTo && (
                    <div
                      className={`px-2.5 py-1.5 rounded-lg border-l-2 text-[11px] ${
                        isDark ? "bg-slate-900/70 border-sky-400 text-slate-300" : "bg-white/80 border-[#1039B9] text-slate-600"
                      }`}
                    >
                      <div className="text-[10px] font-bold opacity-85">{msg.replyTo.senderName}</div>
                      <div className="truncate opacity-80">{msg.replyTo.body}</div>
                    </div>
                  )}

                  <p className="leading-relaxed break-words">{renderMessageBody(msg.body)}</p>

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
                                disabled={approvalBusyId === msg.id}
                                onClick={() => handleConfirmDecision(msg.id, "approve")}
                                className="flex-1 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
                              >
                                {approvalBusyId === msg.id ? (
                                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                ) : (
                                  <IconCheck className="w-3 h-3" />
                                )}
                                <span>{isSw ? "Ndiyo, Thibitisha" : "Yes, Confirm"}</span>
                              </button>
                              <button
                                type="button"
                                disabled={approvalBusyId === msg.id}
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
                              disabled={approvalBusyId === msg.id}
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

                  {/* Footer bar: time + Reply + Reaction toggles */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <span className={`text-[9px] font-mono ${mutedCls}`}>{msg.createdAt.slice(11, 16)}</span>
                    <div className="flex items-center gap-1">
                      {(["thumbs_up", "check", "heart"] as const).map((kind) => {
                        const count = reactions.filter((r) => r.kind === kind).length;
                        const mineReacted = reactions.some(
                          (r) => r.kind === kind && r.profileId === currentProfileId
                        );
                        const isReactBusy = reactingKey === `${msg.id}:${kind}`;
                        return (
                          <button
                            key={kind}
                            type="button"
                            disabled={Boolean(reactingKey)}
                            onClick={() => void handleReact(msg.id, kind)}
                            title={kind === "thumbs_up" ? "Acknowledge" : kind === "check" ? "Done" : "Thanks"}
                            className={`px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 text-[10px] transition-colors cursor-pointer ${
                              mineReacted
                                ? "border-[#1039B9] bg-[#1039B9]/15 text-[#1039B9] dark:text-[#38BDF8] font-bold"
                                : isDark
                                  ? "border-slate-700/80 text-slate-400 hover:text-slate-200"
                                  : "border-slate-200 text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            {isReactBusy ? (
                              <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />
                            ) : (
                              reactionIcon(kind)
                            )}
                            {count > 0 && <span className="tabular-nums">{count}</span>}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(msg);
                          inputRef.current?.focus();
                        }}
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-pointer ${
                          isDark
                            ? "border-slate-700/80 text-slate-300 hover:bg-slate-800"
                            : "border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {isSw ? "Jibu" : "Reply"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer with @Mention Tagging, Direct Reply & System Record Picker */}
      <form
        onSubmit={handleSend}
        className={`shrink-0 p-3 sm:p-4 border-t space-y-2 ${
          isDark ? "border-slate-800 bg-[#0D121B]" : "border-[#EAECF0] bg-[#F8FAFC]"
        }`}
      >
        {/* Quick 1-Tap Teammate Chips on Mobile (easy thumb tagging without popover) */}
        {members.filter((m) => m.id !== currentProfileId).length > 0 && (
          <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <span className={`text-[9px] font-bold uppercase tracking-wider shrink-0 ${mutedCls}`}>
              {isSw ? "Taja:" : "Tag:"}
            </span>
            {members
              .filter((m) => m.id !== currentProfileId)
              .slice(0, 6)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => insertMention(m)}
                  className={`px-2 py-1 rounded-full border text-[10px] font-semibold shrink-0 cursor-pointer ${
                    isDark ? "bg-[#11161F] border-slate-700 text-sky-300" : "bg-white border-[#E2E8F0] text-[#1039B9]"
                  }`}
                >
                  @{m.handle}
                </button>
              ))}
          </div>
        )}
        {(mentionPickerOpen || activeMentionQuery !== null) && filteredMembers.length > 0 && (
          <div
            className={`max-h-36 overflow-y-auto rounded-xl border p-1.5 space-y-1 ${
              isDark ? "bg-[#11161F] border-slate-700" : "bg-white border-[#E2E8F0]"
            }`}
          >
            <div className={`text-[10px] font-bold uppercase px-2 py-0.5 ${mutedCls}`}>
              {isSw ? "Taja Mwenzako (@)" : "Tag Teammate (@)"}
            </div>
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => insertMention(m)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between gap-2 cursor-pointer ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-blue-50"
                }`}
              >
                <span className="font-semibold truncate">{m.displayName}</span>
                <span className="text-[10px] font-mono text-[#1039B9] dark:text-[#38BDF8] shrink-0">
                  @{m.handle}
                </span>
              </button>
            ))}
          </div>
        )}

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

        {replyingTo && (
          <div
            className={`px-3 py-1.5 rounded-xl border-l-2 flex items-center justify-between gap-2 text-[11px] ${
              isDark ? "bg-[#11161F] border-sky-400" : "bg-white border-[#1039B9]"
            }`}
          >
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[#1039B9] dark:text-[#38BDF8]">
                {isSw ? `Kumjibu ${replyingTo.senderName}` : `Replying to ${replyingTo.senderName}`}
              </div>
              <div className={`truncate ${mutedCls}`}>{replyingTo.body}</div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-rose-500 font-bold px-1 cursor-pointer"
            >
              &times;
            </button>
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

        <div className="flex items-center gap-1.5">
          {members.length > 1 && (
            <button
              type="button"
              onClick={() => setMentionPickerOpen((p) => !p)}
              title="Tag teammate (@)"
              className={`px-2 py-2 rounded-full border text-[11px] font-bold shrink-0 cursor-pointer ${
                isDark ? "bg-[#11161F] border-slate-700 text-slate-200" : "bg-white border-[#E2E8F0] text-[#111317]"
              }`}
            >
              @
            </button>
          )}
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
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isSw ? "Andika ujumbe au @taja..." : "Message team or @tag..."}
            className={`flex-1 min-w-0 px-3 py-2 rounded-full border text-xs focus:outline-none ${
              isDark ? "bg-[#11161F] border-slate-700 text-white" : "bg-white border-[#E2E8F0] text-[#111317]"
            }`}
          />
          <button
            type="submit"
            disabled={sending || (!draft.trim() && !selectedAttach)}
            className="px-3.5 py-2 rounded-full text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 cursor-pointer shrink-0"
            style={{ backgroundColor: accent }}
          >
            {sending && (
              <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            <span>{sending ? (isSw ? "Inatuma" : "Sending") : isSw ? "Tuma" : "Send"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
