import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMobileSession } from "../../src/context/MobileSessionContext";
import { postWorkspaceAction } from "../../src/services/api";
import { CERVOS_COLORS } from "../../src/theme/tokens";

interface MobileChatMsg {
  id: string;
  senderProfileId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

export default function MobileMessagesScreen() {
  const { workspaceState, lang, isDark, brandAccent, refreshWorkspace } = useMobileSession();
  const isSw = lang === "SW";
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const profile = (workspaceState?.activeProfile as { id?: string; displayName?: string } | undefined) || {};
  const messages = (workspaceState?.branchMessages as MobileChatMsg[] | undefined) || [];

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await postWorkspaceAction({
        action: "send_branch_message",
        body: draft.trim(),
      });
      if (res.ok) {
        setDraft("");
        await refreshWorkspace();
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      }
    } finally {
      setSending(false);
    }
  };

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.stream}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: card, borderColor: border }]}>
            <Text style={{ color: muted, fontSize: 13 }}>
              {isSw
                ? "Hakuna ujumbe wa tawi bado. Andika ujumbe hapo chini."
                : "No branch messages yet. Write a note to your branch team below."}
            </Text>
          </View>
        ) : (
          messages.map((m) => {
            const mine = m.senderProfileId === profile.id;
            return (
              <View key={m.id} style={[styles.msgCol, mine ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
                <Text style={{ color: muted, fontSize: 10, fontWeight: "700", marginBottom: 3 }}>
                  {m.senderName} ({m.senderRole.replace(/_/g, " ")})
                </Text>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: mine ? brandAccent : card,
                      borderColor: mine ? brandAccent : border,
                    },
                  ]}
                >
                  <Text style={{ color: mine ? "#FFFFFF" : text, fontSize: 13, lineHeight: 18 }}>
                    {m.body}
                  </Text>
                  <Text style={{ color: mine ? "rgba(255,255,255,0.75)" : muted, fontSize: 9, marginTop: 4 }}>
                    {m.createdAt.slice(11, 16)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.composer, { backgroundColor: card, borderTopColor: border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={isSw ? "Andika ujumbe..." : "Message branch team..."}
          placeholderTextColor={muted}
          style={[styles.input, { backgroundColor: bg, borderColor: border, color: text }]}
          onSubmitEditing={() => void send()}
        />
        <TouchableOpacity
          onPress={() => void send()}
          disabled={sending || !draft.trim()}
          style={[styles.sendBtn, { backgroundColor: brandAccent, opacity: sending || !draft.trim() ? 0.5 : 1 }]}
        >
          <Text style={styles.sendText}>{isSw ? "Tuma" : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  stream: {
    padding: 14,
    gap: 10,
  },
  emptyBox: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  msgCol: {
    width: "100%",
  },
  bubble: {
    maxWidth: "86%",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  sendBtn: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
});
