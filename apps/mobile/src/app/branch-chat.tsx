import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyStateCard } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import type { BranchChatMessage, BranchChatReactionKind } from "@/types/workspace";

interface AttachOption {
  kind: "batch" | "order";
  refId: string;
  title: string;
  subtitle: string;
}

const REACTIONS: Array<{ kind: BranchChatReactionKind; label: string }> = [
  { kind: "check", label: "ACK" },
  { kind: "thumbs_up", label: "OK" },
  { kind: "heart", label: "+1" },
];

export default function BranchChatScreen() {
  const {
    workspace,
    activeCentre,
    scopedMessages,
    scopedBatches,
    canManageAdmin,
    lang,
    refreshState,
    runOnlineOrQueue,
  } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const myProfileId = workspace?.activeProfile?.id || "";

  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<BranchChatMessage | null>(null);
  const [attachPickerOpen, setAttachPickerOpen] = useState(false);
  const [selectedAttach, setSelectedAttach] = useState<AttachOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const listRef = useRef<FlatList<BranchChatMessage>>(null);

  // Auto-poll branch chat every 8s while open
  useEffect(() => {
    const timer = setInterval(() => {
      void refreshState();
    }, 8_000);
    return () => clearInterval(timer);
  }, [refreshState]);

  const branchStaff = useMemo(() => {
    return (workspace?.profiles ?? []).filter(
      (p) => !activeCentre?.id || p.centreId === activeCentre.id
    );
  }, [workspace?.profiles, activeCentre?.id]);

  // Filter @mention autocomplete suggestions when user types `@...`
  const mentionQueryMatch = useMemo(() => {
    const match = body.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [body]);

  const filteredMentions = useMemo(() => {
    if (mentionQueryMatch === null) return branchStaff.slice(0, 4);
    return branchStaff.filter((p) => {
      const handle = (p.username || p.displayName.replace(/\s+/g, ".")).toLowerCase();
      return handle.includes(mentionQueryMatch) || p.displayName.toLowerCase().includes(mentionQueryMatch);
    });
  }, [branchStaff, mentionQueryMatch]);

  const attachableRecords = useMemo<AttachOption[]>(() => {
    const batchOpts = scopedBatches.slice(0, 6).map((b) => ({
      kind: "batch" as const,
      refId: b.id,
      title: `${b.brandName} (${b.batchNumber})`,
      subtitle: `${b.quantity} packs · Exp ${b.expiryDate} · ${b.quarantined ? "Quarantined" : "In Stock"}`,
    }));
    const orderOpts = (workspace?.wholesaleOrders ?? []).slice(0, 4).map((o) => ({
      kind: "order" as const,
      refId: o.orderReference,
      title: `Order ${o.orderReference} · ${o.productName}`,
      subtitle: `${o.quantity} packs (${o.escrowStatus.replace(/_/g, " ")})`,
    }));
    return [...batchOpts, ...orderOpts];
  }, [scopedBatches, workspace?.wholesaleOrders]);

  const insertMention = (handle: string) => {
    if (mentionQueryMatch !== null) {
      setBody((cur) => cur.replace(/@[a-zA-Z0-9._-]*$/, `@${handle} `));
    } else {
      setBody((cur) => `${cur}@${handle} `);
    }
    void triggerHaptic("selection");
  };

  const sendMessage = async () => {
    const clean = body.trim();
    if ((!clean && !selectedAttach) || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const msgText = clean || selectedAttach?.title || "";
      const out = await runOnlineOrQueue(
        {
          action: "send_branch_chat",
          body: msgText,
          attachment: selectedAttach ?? undefined,
          replyToId: replyingTo?.id,
          centreId: activeCentre?.id,
        },
        selectedAttach || replyingTo
          ? undefined
          : { type: "branch_chat", payload: { text: msgText, centreId: activeCentre?.id } }
      );
      if (!out.ok) {
        setActionError(out.error || "Could not send message.");
        await playSoundCue("alert");
        return;
      }
      setBody("");
      setReplyingTo(null);
      setSelectedAttach(null);
      setAttachPickerOpen(false);
      await playSoundCue("notify");
      await triggerHaptic("light");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    } finally {
      setBusy(false);
    }
  };

  const toggleReaction = async (messageId: string, kind: BranchChatReactionKind) => {
    setActionError(null);
    void triggerHaptic("selection");
    const res = await postWorkspaceAction({
      action: "react_branch_chat",
      messageId,
      kind,
    });
    if (!res.ok) {
      setActionError(res.data?.error || "Could not save reaction.");
      return;
    }
    await refreshState();
  };

  const resolveApproval = async (messageId: string, decision: "approve" | "decline") => {
    setActionError(null);
    const res = await postWorkspaceAction({
      action: "resolve_chat_approval",
      messageId,
      decision,
    });
    if (!res.ok) {
      await playSoundCue("alert");
      setActionError(res.data?.error || "Could not resolve approval request.");
      return;
    }
    await playSoundCue(decision === "approve" ? "sale-complete" : "alert");
    await triggerHaptic(decision === "approve" ? "success" : "medium");
    await refreshState();
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      {/* Branch Privacy Scope Bar */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          backgroundColor: colors.secondaryGroupedBackground,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <PlatformIcon sf="lock.fill" md="lock" color={brand.accent} size={14} />
          <Text style={[typography.caption, { flex: 1 }]} numberOfLines={1}>
            {isSw
              ? `Tawi la ${activeCentre?.name || "Kituo"} pekee · Wafanyakazi ${branchStaff.length}`
              : `${activeCentre?.name || "Branch"} private channel · ${branchStaff.length} staff`}
          </Text>
        </View>
      </View>

      {actionError && (
        <View
          style={{
            marginHorizontal: spacing.md,
            marginTop: spacing.sm,
            padding: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: brand.dangerSoft,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: brand.danger }}>{actionError}</Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={scopedMessages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyStateCard
            sf="bubble.left.and.bubble.right"
            md="chat"
            title={isSw ? "Hakuna ujumbe bado" : "No messages in this branch yet"}
            description={
              isSw
                ? "Tuma ujumbe kwa timu yako ya kaunta, jibu ujumbe, au ambatanisha kundi la dawa."
                : "Send a shift note, reply to colleagues, or attach a stock lot below."
            }
          />
        }
        renderItem={({ item }) => {
          const isMine = item.senderProfileId === myProfileId;
          const reactions = item.reactions ?? [];
          return (
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.xl,
                borderCurve: "continuous",
                backgroundColor: isMine ? brand.accentSoft : colors.secondaryGroupedBackground,
                borderWidth: 1,
                borderColor: isMine ? brand.accentSoft : brand.staticBorder,
                gap: 6,
              }}
            >
              {/* Header Row */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: isMine ? brand.accent : colors.label }}>
                  {item.senderName}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Pressable onPress={() => setReplyingTo(item)} hitSlop={8}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: brand.accent }}>
                      {isSw ? "Jibu" : "Reply"}
                    </Text>
                  </Pressable>
                  <Text style={typography.caption}>{item.createdAt.slice(11, 16)}</Text>
                </View>
              </View>

              {/* Quoted Reply Snippet */}
              {item.replyTo && (
                <View
                  style={{
                    paddingLeft: 10,
                    paddingVertical: 4,
                    borderLeftWidth: 2,
                    borderLeftColor: brand.accent,
                    backgroundColor: colors.groupedBackground,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: brand.accent }}>
                    {item.replyTo.senderName}
                  </Text>
                  <Text style={typography.caption} numberOfLines={2}>
                    {item.replyTo.body}
                  </Text>
                </View>
              )}

              <Text style={typography.body}>{item.body}</Text>

              {/* Record Attachment / Manager Approval */}
              {item.attachment && (
                <View
                  style={{
                    marginTop: 2,
                    padding: 10,
                    borderRadius: radius.md,
                    backgroundColor: colors.groupedBackground,
                    borderWidth: 1,
                    borderColor: brand.staticBorder,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.label }}>
                    {item.attachment.title}
                  </Text>
                  <Text style={typography.caption}>{item.attachment.subtitle}</Text>

                  {item.attachment.kind === "wholesale_request" && item.attachment.approvalStatus && (
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color:
                          item.attachment.approvalStatus === "approved"
                            ? brand.success
                            : item.attachment.approvalStatus === "declined"
                              ? brand.danger
                              : brand.warning,
                      }}
                    >
                      {item.attachment.approvalStatus === "approved"
                        ? isSw ? "Imeidhinishwa" : "Approved & Ordered"
                        : item.attachment.approvalStatus === "declined"
                          ? isSw ? "Imekataliwa" : "Declined"
                          : isSw ? "Inasubiri Idhini" : "Pending Manager Approval"}
                    </Text>
                  )}

                  {item.attachment.kind === "wholesale_request" &&
                    item.attachment.approvalStatus === "pending" &&
                    canManageAdmin && (
                      <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: 4 }}>
                        <PrimaryButton
                          title={isSw ? "Idhinisha" : "Approve"}
                          onPress={() => void resolveApproval(item.id, "approve")}
                          style={{ minHeight: 34, paddingVertical: 6 }}
                        />
                        <PrimaryButton
                          title={isSw ? "Kataa" : "Decline"}
                          variant="outline"
                          onPress={() => void resolveApproval(item.id, "decline")}
                          style={{ minHeight: 34, paddingVertical: 6 }}
                        />
                      </View>
                    )}
                </View>
              )}

              {/* Emoji-free Reaction Chips */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                {REACTIONS.map((rx) => {
                  const hits = reactions.filter((r) => r.kind === rx.kind);
                  const mine = hits.some((r) => r.profileId === myProfileId);
                  return (
                    <Pressable
                      key={rx.kind}
                      onPress={() => void toggleReaction(item.id, rx.kind)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: radius.full,
                        borderWidth: 1,
                        borderColor: mine ? brand.accent : brand.staticBorder,
                        backgroundColor: mine ? brand.accentSoft : colors.groupedBackground,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: mine ? brand.accent : colors.secondaryLabel,
                        }}
                      >
                        {rx.label}
                        {hits.length > 0 ? ` ${hits.length}` : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        }}
      />

      {/* Composer */}
      <View
        style={{
          padding: spacing.md,
          backgroundColor: colors.secondaryGroupedBackground,
          borderTopWidth: 1,
          borderTopColor: colors.separator,
          gap: spacing.xs,
        }}
      >
        {replyingTo && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.md,
              backgroundColor: brand.accentSoft,
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: brand.accent }}>
                {isSw ? `Unajibu ${replyingTo.senderName}` : `Replying to ${replyingTo.senderName}`}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                {replyingTo.body}
              </Text>
            </View>
            <Pressable onPress={() => setReplyingTo(null)}>
              <PlatformIcon sf="xmark.circle.fill" md="close" color={colors.secondaryLabel} size={18} />
            </Pressable>
          </View>
        )}

        {selectedAttach && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.md,
              backgroundColor: colors.tertiaryBackground,
            }}
          >
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: colors.label }} numberOfLines={1}>
              {selectedAttach.title}
            </Text>
            <Pressable onPress={() => setSelectedAttach(null)}>
              <PlatformIcon sf="xmark.circle.fill" md="close" color={colors.secondaryLabel} size={18} />
            </Pressable>
          </View>
        )}

        {attachPickerOpen && attachableRecords.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {attachableRecords.map((rec) => (
              <Pressable
                key={`${rec.kind}-${rec.refId}`}
                onPress={() => {
                  setSelectedAttach(rec);
                  setAttachPickerOpen(false);
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: brand.accent,
                  backgroundColor: brand.accentSoft,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: brand.accent }}>{rec.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {filteredMentions.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {filteredMentions.slice(0, 4).map((p) => {
              const handle = (p.username && p.username.trim()) || p.displayName.replace(/\s+/g, ".").toLowerCase();
              return (
                <Pressable
                  key={p.id}
                  onPress={() => insertMention(handle)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: radius.full,
                    backgroundColor: colors.tertiaryBackground,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: brand.accent }}>@{handle}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
          <Pressable
            onPress={() => setAttachPickerOpen((v) => !v)}
            style={{
              width: 42,
              height: 42,
              borderRadius: radius.full,
              backgroundColor: attachPickerOpen ? brand.accentSoft : colors.tertiaryBackground,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PlatformIcon sf="paperclip" md="attach-file" color={brand.accent} size={18} />
          </Pressable>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={isSw ? "Andika ujumbe wa tawi..." : "Message branch colleagues..."}
            placeholderTextColor={colors.tertiaryLabel as string}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: radius.full,
              backgroundColor: colors.tertiaryBackground,
              paddingHorizontal: spacing.md,
              color: colors.label,
            }}
          />
          <PrimaryButton
            title={busy ? "..." : isSw ? "Tuma" : "Send"}
            loading={busy}
            onPress={() => void sendMessage()}
            style={{ minHeight: 44 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
