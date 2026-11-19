"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BranchChatDrawer, {
  type BranchChatMember,
  type BranchChatMsg,
  type BranchChatReactionKind,
  type BranchChatRecordAttachment,
} from "@/components/BranchChatDrawer";

/** Fired by any view (e.g. calm wholesale escalation) to pop the branch chat open. */
export const OPEN_CHAT_EVENT = "cervos:open-chat";
/** Fired by the chat after it mutates server state (approvals, messages, reactions) so views can refresh. */
export const WORKSPACE_REFRESH_EVENT = "cervos:workspace-refresh";

export function requestOpenBranchChat() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}

interface ChatStateSlice {
  activeProfile: { id: string; role: string; isMasterAdmin: boolean } | null;
  activeCentreId: string | null;
  centres: Array<{ id: string; name: string }>;
  profiles?: Array<{
    id: string;
    username?: string;
    displayName: string;
    role: string;
    centreId: string;
  }>;
  branchMessages?: BranchChatMsg[];
  batches?: Array<{
    id: string;
    centreId?: string;
    brandName: string;
    batchNumber: string;
    quantity: number;
    expiryDate: string;
    quarantined: boolean;
  }>;
  wholesaleOrders?: Array<{
    orderReference: string;
    productName: string;
    quantity: number;
    totalTzs: number;
    escrowStatus: string;
  }>;
}

/**
 * Shared branch-chat state hook for WorkspaceShell.
 */
export function useShellBranchChat() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ChatStateSlice | null>(null);
  const userToggledRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/workspace/state", { cache: "no-store" });
      if (!r.ok) return;
      setState((await r.json()) as ChatStateSlice);
    } catch {
      // Offline: keep last snapshot
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onOpen = () => {
      userToggledRef.current = true;
      setOpen(true);
      void load();
    };
    const onRefresh = () => void load();
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  // Peek open on desktop launch for ~1.15s unless pinned; keep mobile closed until explicitly tapped
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1024) {
      setOpen(false);
      return;
    }
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const pinned = window.localStorage.getItem("cervos-chat-pinned");
      if (pinned === "1") {
        setOpen(true);
      } else {
        setOpen(true);
        closeTimer = setTimeout(() => {
          if (!userToggledRef.current) setOpen(false);
        }, 1150);
      }
    } catch {
      closeTimer = setTimeout(() => {
        if (!userToggledRef.current) setOpen(false);
      }, 1150);
    }
    return () => {
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, []);

  // Poll live branch messages when open
  useEffect(() => {
    if (!open || !state?.activeProfile) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [open, load, state?.activeProfile]);

  const openSheet = useCallback(() => {
    userToggledRef.current = true;
    setOpen(true);
    try {
      window.localStorage.setItem("cervos-chat-pinned", "1");
    } catch {
      // Ignore
    }
    void load();
  }, [load]);

  const toggle = useCallback(() => {
    userToggledRef.current = true;
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("cervos-chat-pinned", next ? "1" : "0");
      } catch {
        // Ignore storage errors
      }
      if (next) void load();
      return next;
    });
  }, [load]);

  const close = useCallback(() => {
    userToggledRef.current = true;
    setOpen(false);
    try {
      window.localStorage.setItem("cervos-chat-pinned", "0");
    } catch {
      // Ignore
    }
  }, []);

  const markInteracted = useCallback(() => {
    userToggledRef.current = true;
  }, []);

  const messages = state?.branchMessages ?? [];
  const profile = state?.activeProfile ?? null;
  const canManageAdmin =
    !!profile && (profile.isMasterAdmin || profile.role === "pharmacy_owner" || profile.role === "supplier_admin");
  const centreName =
    state?.centres.find((c) => c.id === state.activeCentreId)?.name ?? state?.centres[0]?.name ?? "";
  const badge = messages.filter(
    (m) => m.attachment?.kind === "wholesale_request" && m.attachment.approvalStatus === "pending"
  ).length;

  const members: BranchChatMember[] = useMemo(() => {
    const targetCentre = state?.activeCentreId;
    return (state?.profiles ?? [])
      .filter((p) => !targetCentre || p.centreId === targetCentre)
      .map((p) => ({
        id: p.id,
        displayName: p.displayName,
        handle:
          (p.username && p.username.trim()) ||
          p.displayName.trim().toLowerCase().replace(/\s+/g, "."),
        role: p.role,
      }));
  }, [state?.profiles, state?.activeCentreId]);

  const attachableRecords = useMemo(() => {
    const targetCentre = state?.activeCentreId;
    const batchOpts = (state?.batches ?? [])
      .filter((b) => !targetCentre || !b.centreId || b.centreId === targetCentre)
      .slice(0, 8)
      .map((b) => ({
        kind: "batch" as const,
        refId: b.id,
        title: `${b.brandName} (${b.batchNumber})`,
        subtitle: `${b.quantity} packs · Exp ${b.expiryDate} · ${b.quarantined ? "Quarantined" : "In Stock"}`,
      }));
    const orderOpts = (state?.wholesaleOrders ?? []).slice(0, 5).map((o) => ({
      kind: "order" as const,
      refId: o.orderReference,
      title: `Order ${o.orderReference} · ${o.productName}`,
      subtitle: `${o.quantity} packs · TZS ${o.totalTzs.toLocaleString("en-US")} (${o.escrowStatus.replace(/_/g, " ")})`,
    }));
    return [...batchOpts, ...orderOpts];
  }, [state?.batches, state?.wholesaleOrders, state?.activeCentreId]);

  const send = async (
    body: string,
    attachment?: BranchChatRecordAttachment,
    replyToId?: string
  ): Promise<string | null> => {
    userToggledRef.current = true;
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_branch_chat",
          body,
          attachment,
          replyToId,
          centreId: state?.activeCentreId || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: BranchChatMsg;
      };
      if (!res.ok || !json.ok) {
        return json.error || `Message failed to send (HTTP ${res.status}).`;
      }
      if (json.message) {
        setState((prev) =>
          prev
            ? {
                ...prev,
                branchMessages: [...(prev.branchMessages ?? []), json.message!],
              }
            : prev
        );
      }
      await load();
      window.dispatchEvent(new Event(WORKSPACE_REFRESH_EVENT));
      return null;
    } catch {
      return "Network error — could not send message.";
    }
  };

  const react = async (messageId: string, kind: BranchChatReactionKind): Promise<string | null> => {
    userToggledRef.current = true;
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "react_branch_chat", messageId, kind }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return json.error || "Could not save reaction.";
      await load();
      return null;
    } catch {
      return "Network error saving reaction.";
    }
  };

  const resolve = async (messageId: string, decision: "approve" | "decline"): Promise<string | null> => {
    userToggledRef.current = true;
    const res = await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve_chat_approval", messageId, decision }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) return json.error || "Unable to resolve request.";
    await load();
    window.dispatchEvent(new Event(WORKSPACE_REFRESH_EVENT));
    return null;
  };

  return {
    available: !!profile,
    open,
    loading,
    openSheet,
    toggle,
    close,
    markInteracted,
    badge,
    centreName,
    profile,
    canManageAdmin,
    messages,
    members,
    attachableRecords,
    send,
    react,
    resolve,
  };
}

interface BranchChatDockedAsideProps {
  chat: ReturnType<typeof useShellBranchChat>;
  accent: string;
  isDark: boolean;
  isSw: boolean;
  railPillCls: string;
}

/**
 * Docked symmetrical right rail inside WorkspaceShell's main flex row.
 * Mobile overlay stops cleanly below the sticky top bar (`top-[57px]`).
 */
export function BranchChatDockedAside({
  chat,
  accent,
  isDark,
  isSw,
  railPillCls,
}: BranchChatDockedAsideProps) {
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    if (!chat.open || window.innerWidth >= 1024) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [chat.open]);

  if (!chat.available || !chat.profile) return null;

  return (
    <>
      {/* Desktop: Sticky Edge-to-Edge Structural Column & Clicker (Follows scroll collapsed & open) */}
      <aside
        aria-label="Branch Team Messages"
        onMouseDown={chat.markInteracted}
        className={`hidden lg:flex flex-col shrink-0 sticky top-[57px] self-start h-[calc(100dvh-57px)] -my-4 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          chat.open
            ? `w-[336px] xl:w-[368px] border-l ${
                isDark
                  ? "bg-[#0B0F17]/88 border-slate-800/80 backdrop-blur-xl"
                  : "bg-white/80 border-[#E2E8F0] backdrop-blur-xl"
              }`
            : `w-12 items-center pt-6 border-l ${
                isDark ? "border-slate-800/60 bg-[#0B0F17]/35" : "border-[#E2E8F0]/75 bg-white/40"
              }`
        }`}
      >
        {chat.open ? (
          <div className="h-full w-full flex flex-col">
            <BranchChatDrawer
              open={chat.open}
              loading={chat.loading}
              onClose={chat.close}
              centreName={chat.centreName}
              currentProfileId={chat.profile.id}
              canManageAdmin={chat.canManageAdmin}
              messages={chat.messages}
              members={chat.members}
              attachableRecords={chat.attachableRecords}
              accent={accent}
              isDark={isDark}
              isSw={isSw}
              onSendMessage={chat.send}
              onReactMessage={chat.react}
              onResolveApproval={chat.resolve}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={chat.toggle}
              aria-label="Expand branch team chat"
              title={isSw ? "Fungua Maongezi ya Tawi" : `Branch Chat (${chat.centreName})`}
              className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-transform duration-200 hover:scale-105 cursor-pointer ${railPillCls}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              {chat.badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-[#111317] text-[9px] font-extrabold flex items-center justify-center">
                  {chat.badge}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={chat.toggle}
              className="flex flex-col items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest opacity-70 hover:opacity-100 select-none cursor-pointer"
              style={{ writingMode: "vertical-rl" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{isSw ? "Ujumbe" : "Messages"}</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile (< lg): App-shell Messages view fitted strictly between header (`57px`) and mobile bottom dock */}
      {chat.open && (
        <div
          className="lg:hidden fixed inset-x-0 top-[57px] bottom-[calc(62px+env(safe-area-inset-bottom))] z-[42] flex justify-end animate-fade-in"
        >
          <button
            type="button"
            aria-label="Close mobile branch chat backdrop"
            onClick={chat.close}
            className="hidden sm:block flex-1 bg-slate-950/45 backdrop-blur-xs cursor-pointer"
          />
          <aside
            className={`w-full sm:max-w-md h-full min-h-0 sm:border-l flex flex-col shadow-2xl ${
              isDark ? "bg-[#0B0F17] border-slate-800" : "bg-white border-[#EAECF0]"
            }`}
          >
            <BranchChatDrawer
              open={chat.open}
              loading={chat.loading}
              onClose={chat.close}
              centreName={chat.centreName}
              currentProfileId={chat.profile.id}
              canManageAdmin={chat.canManageAdmin}
              messages={chat.messages}
              members={chat.members}
              attachableRecords={chat.attachableRecords}
              accent={accent}
              isDark={isDark}
              isSw={isSw}
              onSendMessage={chat.send}
              onReactMessage={chat.react}
              onResolveApproval={chat.resolve}
            />
          </aside>
        </div>
      )}
    </>
  );
}
