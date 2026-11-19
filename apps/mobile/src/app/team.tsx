import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Host, Switch } from "@expo/ui";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyStateCard } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import type { WorkspaceProfileSummary } from "@/types/workspace";
import {
  clampProfileCapabilities,
  type ProfileCapabilities,
  type WorkspaceProfileRole,
} from "@/utils/permissions";

const STAFF_ROLES: Array<{ id: WorkspaceProfileRole; label: string }> = [
  { id: "superintendent_pharmacist", label: "Pharmacist" },
  { id: "pos_cashier", label: "POS Cashier" },
  { id: "pharmacy_owner", label: "Owner" },
  { id: "warehouse_dispatcher", label: "Dispatcher" },
];

const CAP_LABELS: Array<{ key: keyof ProfileCapabilities; label: string }> = [
  { key: "canSellPos", label: "Counter POS & Dispense" },
  { key: "canEditInventory", label: "Stock Intake, Edits & Quarantine" },
  { key: "canManageWholesale", label: "Wholesale Orders & GRN" },
  { key: "canViewOrgReports", label: "Org-Wide Branch Reports" },
  { key: "canViewFinance", label: "Finance, Expenses & Margins" },
  { key: "canExportReports", label: "Export CSV / PDF Reports" },
  { key: "canManageTeam", label: "Manage Staff & Branches" },
];

export default function TeamAndBranchesScreen() {
  const { workspace, capabilities, lang, isOnline, refreshState } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const centres = workspace?.centres ?? [];
  const profiles = workspace?.profiles ?? [];
  const joinRequests = workspace?.joinRequests ?? [];

  const [tab, setTab] = useState<"staff" | "lounge" | "branches">("staff");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Add Staff form
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffUser, setNewStaffUser] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<WorkspaceProfileRole>("pos_cashier");
  const [newStaffCentreId, setNewStaffCentreId] = useState<string>(centres[0]?.id || "");
  const [newStaffPin, setNewStaffPin] = useState("");

  // Edit existing profile state
  const [editingProfile, setEditingProfile] = useState<WorkspaceProfileSummary | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<WorkspaceProfileRole>("pos_cashier");
  const [editCentreId, setEditCentreId] = useState("");
  const [editNewPin, setEditNewPin] = useState("");
  const [editCaps, setEditCaps] = useState<ProfileCapabilities | null>(null);

  // Join Request allocation state
  const [approveCentreId, setApproveCentreId] = useState<string>(centres[0]?.id || "");
  const [approveRole, setApproveRole] = useState<WorkspaceProfileRole>("pos_cashier");
  const [approvePin, setApprovePin] = useState("2468");

  // Add Branch form
  const [branchName, setBranchName] = useState("");
  const [branchRegion, setBranchRegion] = useState(workspace?.account?.region || "Dar es Salaam");
  const [branchAddr, setBranchAddr] = useState("");
  const [branchPhone, setBranchPhone] = useState("");

  const pendingCount = useMemo(
    () => joinRequests.filter((r) => r.status === "pending").length,
    [joinRequests]
  );

  const openEditor = (p: WorkspaceProfileSummary) => {
    setEditingProfile(p);
    setEditName(p.displayName);
    setEditRole((p.role as WorkspaceProfileRole) || "pos_cashier");
    setEditCentreId(p.centreId || centres[0]?.id || "");
    setEditNewPin("");
    setEditCaps(
      clampProfileCapabilities(
        (p.role as WorkspaceProfileRole) || "pos_cashier",
        p.capabilities,
        p.isMasterAdmin
      )
    );
    setNotice(null);
  };

  const requireOnlineOwner = () => {
    if (!capabilities.canManageTeam) {
      setNotice({ ok: false, text: "Team & organization management permission required." });
      return false;
    }
    if (!isOnline) {
      setNotice({ ok: false, text: "Internet connection is required for team & branch changes." });
      return false;
    }
    return true;
  };

  const createStaff = async () => {
    if (!requireOnlineOwner() || busy) return;
    if (newStaffName.trim().length < 2 || newStaffPin.trim().length < 4) {
      setNotice({ ok: false, text: "Enter staff name and 4-6 digit PIN." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await postWorkspaceAction({
        action: "add_profile",
        displayName: newStaffName.trim(),
        username: newStaffUser.trim() || undefined,
        role: newStaffRole,
        centreId: newStaffCentreId || centres[0]?.id,
        pin: newStaffPin.trim(),
      });
      if (!res.ok) {
        await playSoundCue("alert");
        setNotice({ ok: false, text: res.data?.error || "Could not provision operator." });
        return;
      }
      setNewStaffName("");
      setNewStaffUser("");
      setNewStaffPin("");
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setNotice({ ok: true, text: `Provisioned operator ${newStaffName.trim()}.` });
      await refreshState();
    } finally {
      setBusy(false);
    }
  };

  const saveProfileEdit = async () => {
    if (!editingProfile || !requireOnlineOwner() || busy) return;
    if (editNewPin.trim().length > 0 && (editNewPin.trim().length < 4 || editNewPin.trim().length > 6)) {
      setNotice({ ok: false, text: "New PIN must be 4-6 digits." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await postWorkspaceAction({
        action: "edit_profile",
        profileId: editingProfile.id,
        displayName: editName.trim() || editingProfile.displayName,
        role: editRole,
        centreId: editCentreId,
        capabilities: editCaps ?? undefined,
        ...(editNewPin.trim() ? { newPin: editNewPin.trim() } : {}),
      });
      if (!res.ok) {
        await playSoundCue("alert");
        setNotice({ ok: false, text: res.data?.error || "Could not update profile." });
        return;
      }
      setEditingProfile(null);
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setNotice({ ok: true, text: `Updated ${editName.trim() || editingProfile.displayName}.` });
      await refreshState();
    } finally {
      setBusy(false);
    }
  };

  const handleJoinDecision = async (requestId: string, decision: "approve" | "decline") => {
    if (!requireOnlineOwner() || busy) return;
    if (decision === "approve" && approvePin.trim().length < 4) {
      setNotice({ ok: false, text: "Assign a 4-6 digit initial PIN before approving." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await postWorkspaceAction({
        action: "review_join_request",
        requestId,
        decision,
        ...(decision === "approve"
          ? {
              centreId: approveCentreId || centres[0]?.id,
              role: approveRole,
              pin: approvePin.trim(),
            }
          : {}),
      });
      if (!res.ok) {
        await playSoundCue("alert");
        setNotice({ ok: false, text: res.data?.error || "Could not process join request." });
        return;
      }
      await playSoundCue(decision === "approve" ? "sale-complete" : "tap");
      await triggerHaptic("success");
      setNotice({
        ok: true,
        text: decision === "approve" ? "Staff request approved and seat allocated." : "Join request declined.",
      });
      await refreshState();
    } finally {
      setBusy(false);
    }
  };

  const createBranch = async () => {
    if (!requireOnlineOwner() || busy) return;
    if (branchName.trim().length < 2 || branchAddr.trim().length < 3) {
      setNotice({ ok: false, text: "Enter branch name and street address." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await postWorkspaceAction({
        action: "add_centre",
        name: branchName.trim(),
        region: branchRegion.trim() || workspace?.account?.region || "Dar es Salaam",
        address: branchAddr.trim(),
        phone: branchPhone.trim() || "+255 712 000 000",
      });
      if (!res.ok) {
        await playSoundCue("alert");
        setNotice({ ok: false, text: res.data?.error || "Could not create branch." });
        return;
      }
      setBranchName("");
      setBranchAddr("");
      setBranchPhone("");
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setNotice({ ok: true, text: `Branch "${branchName.trim()}" created cleanly.` });
      await refreshState();
    } finally {
      setBusy(false);
    }
  };

  const manageBranch = async (
    centreId: string,
    op: "pause" | "resume" | "archive" | "restore" | "toggle_exclude" | "delete"
  ) => {
    if (!requireOnlineOwner() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await postWorkspaceAction({
        action: "manage_centre",
        centreId,
        op,
      });
      if (!res.ok) {
        await playSoundCue("alert");
        setNotice({ ok: false, text: res.data?.error || "Branch operation failed." });
        return;
      }
      await playSoundCue("switch");
      await triggerHaptic("medium");
      setNotice({ ok: true, text: `Branch updated (${op}).` });
      await refreshState();
    } finally {
      setBusy(false);
    }
  };

  const cardStyle = {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous" as const,
    backgroundColor: colors.secondaryGroupedBackground,
    gap: spacing.sm,
  };

  const inputStyle = {
    minHeight: 44,
    borderRadius: radius.md,
    borderCurve: "continuous" as const,
    backgroundColor: colors.tertiaryBackground,
    paddingHorizontal: spacing.md,
    color: colors.label,
    fontSize: 15,
  };

  return (
    <KeyboardAwareScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 48 }}
    >
      {/* Tab Selector */}
      <View
        style={{
          flexDirection: "row",
          padding: 4,
          borderRadius: radius.full,
          backgroundColor: colors.tertiaryBackground,
          gap: 4,
        }}
      >
        {(
          [
            { id: "staff", label: isSw ? `Wahudumu (${profiles.length})` : `Staff (${profiles.length})` },
            { id: "lounge", label: isSw ? `Maombi (${pendingCount})` : `Lounge (${pendingCount})` },
            { id: "branches", label: isSw ? `Matawi (${centres.length})` : `Branches (${centres.length})` },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                setTab(t.id);
                setNotice(null);
              }}
              style={{
                flex: 1,
                minHeight: 36,
                borderRadius: radius.full,
                backgroundColor: active ? brand.accent : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? colors.onTint : colors.secondaryLabel }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {notice && (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: notice.ok ? brand.successSoft : brand.dangerSoft,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: notice.ok ? brand.success : brand.danger }}>
            {notice.text}
          </Text>
        </View>
      )}

      {tab === "staff" && (
        <>
          {editingProfile && (
            <View style={[cardStyle, { borderWidth: 1.5, borderColor: brand.accent }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[typography.overline, { color: brand.accent }]}>
                  EDIT OPERATOR · @{editingProfile.username || editingProfile.id}
                </Text>
                <Pressable onPress={() => setEditingProfile(null)} hitSlop={8}>
                  <PlatformIcon sf="xmark.circle.fill" md="close" color={colors.secondaryLabel} size={20} />
                </Pressable>
              </View>

              <TextInput value={editName} onChangeText={setEditName} placeholder="Full Name" style={inputStyle} />

              {!editingProfile.isMasterAdmin && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {STAFF_ROLES.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        setEditRole(r.id);
                        setEditCaps(clampProfileCapabilities(r.id, editCaps, editingProfile.isMasterAdmin));
                      }}
                      style={{
                        paddingHorizontal: 11,
                        paddingVertical: 7,
                        borderRadius: radius.full,
                        backgroundColor: editRole === r.id ? brand.accent : colors.tertiaryBackground,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: editRole === r.id ? colors.onTint : colors.label }}>
                        {r.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {centres.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setEditCentreId(c.id)}
                    style={{
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                      borderRadius: radius.full,
                      backgroundColor: editCentreId === c.id ? brand.accentSoft : colors.tertiaryBackground,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: editCentreId === c.id ? brand.accent : colors.label }}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <TextInput
                value={editNewPin}
                onChangeText={setEditNewPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="Reset PIN (4-6 digits, optional)"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />

              {editCaps && (
                <Host matchContents seedColor={brand.accent}>
                  {CAP_LABELS.map((cap) => (
                    <Switch
                      key={cap.key}
                      value={editCaps[cap.key]}
                      onValueChange={(val) =>
                        setEditCaps((prev) =>
                          prev
                            ? clampProfileCapabilities(
                                editRole,
                                { ...prev, [cap.key]: val },
                                editingProfile.isMasterAdmin
                              )
                            : prev
                        )
                      }
                      label={cap.label}
                    />
                  ))}
                </Host>
              )}

              <PrimaryButton
                title={busy ? "..." : "Save Operator Permissions & PIN"}
                loading={busy}
                onPress={() => void saveProfileEdit()}
              />
            </View>
          )}

          {profiles.map((p) => {
            const cName = centres.find((c) => c.id === p.centreId)?.name || "Branch";
            return (
              <Pressable
                key={p.id}
                onPress={() => capabilities.canManageTeam && openEditor(p)}
                style={cardStyle}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.headline}>
                      {p.displayName} {p.isMasterAdmin ? "· Master" : ""}
                    </Text>
                    <Text style={typography.caption}>
                      @{p.username || p.id.slice(-6)} · {p.role.replace(/_/g, " ")} · {cName}
                    </Text>
                  </View>
                  {capabilities.canManageTeam && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                      {isSw ? "Hariri" : "Edit"}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}

          {capabilities.canManageTeam && (
            <View style={cardStyle}>
              <Text style={[typography.overline, { color: brand.accent }]}>
                {isSw ? "SAJILI MHUDUMU MPYA" : "PROVISION NEW OPERATOR"}
              </Text>
              <TextInput
                value={newStaffName}
                onChangeText={setNewStaffName}
                placeholder="Full Name"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />
              <TextInput
                value={newStaffUser}
                onChangeText={setNewStaffUser}
                placeholder="Username (optional)"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {STAFF_ROLES.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => setNewStaffRole(r.id)}
                    style={{
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                      borderRadius: radius.full,
                      backgroundColor: newStaffRole === r.id ? brand.accent : colors.tertiaryBackground,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: newStaffRole === r.id ? colors.onTint : colors.label }}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {centres.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setNewStaffCentreId(c.id)}
                    style={{
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                      borderRadius: radius.full,
                      backgroundColor: (newStaffCentreId || centres[0]?.id) === c.id ? brand.accentSoft : colors.tertiaryBackground,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: (newStaffCentreId || centres[0]?.id) === c.id ? brand.accent : colors.label }}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                value={newStaffPin}
                onChangeText={setNewStaffPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="Initial Station PIN (4-6 digits)"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />
              <PrimaryButton
                title={busy ? "..." : isSw ? "Ongeza Mhudumu" : "Add Staff Profile"}
                loading={busy}
                onPress={() => void createStaff()}
              />
            </View>
          )}
        </>
      )}

      {tab === "lounge" && (
        <>
          {joinRequests.length === 0 ? (
            <EmptyStateCard
              sf="person.badge.clock"
              md="group-add"
              title={isSw ? "Hakuna maombi ya kujiunga" : "No Welcome Lounge requests"}
              description={
                isSw
                  ? "Wafanyakazi wanaoomba kujiunga na taasisi yako wataonekana hapa."
                  : "Staff members requesting access to join your organization appear here for approval."
              }
            />
          ) : (
            joinRequests.map((req) => (
              <View key={req.id} style={cardStyle}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.headline}>{req.requesterFullName}</Text>
                    <Text style={typography.caption}>
                      @{req.requesterUsername} · {req.requesterEmail} · {req.requesterRegion}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: radius.full,
                      backgroundColor:
                        req.status === "approved" || req.status === "accepted"
                          ? brand.successSoft
                          : req.status === "declined"
                            ? brand.dangerSoft
                            : brand.warningSoft,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color:
                          req.status === "approved" || req.status === "accepted"
                            ? brand.success
                            : req.status === "declined"
                              ? brand.danger
                              : brand.warning,
                      }}
                    >
                      {req.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {req.note && <Text style={typography.subhead}>{req.note}</Text>}

                {req.status === "pending" && capabilities.canManageTeam && (
                  <View style={{ gap: spacing.xs, paddingTop: 4 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {centres.map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => setApproveCentreId(c.id)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: radius.full,
                            backgroundColor: (approveCentreId || centres[0]?.id) === c.id ? brand.accentSoft : colors.tertiaryBackground,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "600", color: (approveCentreId || centres[0]?.id) === c.id ? brand.accent : colors.label }}>
                            {c.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {STAFF_ROLES.slice(0, 3).map((r) => (
                        <Pressable
                          key={r.id}
                          onPress={() => setApproveRole(r.id)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: radius.full,
                            backgroundColor: approveRole === r.id ? brand.accent : colors.tertiaryBackground,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "600", color: approveRole === r.id ? colors.onTint : colors.label }}>
                            {r.label}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <TextInput
                      value={approvePin}
                      onChangeText={setApprovePin}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="Assign 4-6 digit PIN"
                      style={inputStyle}
                    />
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <PrimaryButton
                        title={isSw ? "Idhinisha" : "Approve & Allocate"}
                        style={{ flex: 1 }}
                        onPress={() => void handleJoinDecision(req.id, "approve")}
                      />
                      <PrimaryButton
                        title={isSw ? "Kataa" : "Decline"}
                        variant="destructive"
                        style={{ flex: 1 }}
                        onPress={() => void handleJoinDecision(req.id, "decline")}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </>
      )}

      {tab === "branches" && (
        <>
          {centres.map((c) => {
            const isPaused = c.status === "paused";
            const isArchived = c.status === "archived";
            return (
              <View key={c.id} style={cardStyle}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.headline}>
                      {c.name} {c.isPrimary ? "· Primary" : ""}
                    </Text>
                    <Text style={typography.caption}>
                      {c.region} · {c.address}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: radius.full,
                      backgroundColor: isArchived
                        ? brand.dangerSoft
                        : isPaused
                          ? brand.warningSoft
                          : brand.successSoft,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isArchived ? brand.danger : isPaused ? brand.warning : brand.success,
                      }}
                    >
                      {(c.status || "active").toUpperCase()}
                    </Text>
                  </View>
                </View>

                {capabilities.canManageTeam && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    <Pressable
                      onPress={() => void manageBranch(c.id, isPaused ? "resume" : "pause")}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.tertiaryBackground }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.label }}>
                        {isPaused ? "Resume" : "Pause"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void manageBranch(c.id, isArchived ? "restore" : "archive")}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.tertiaryBackground }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.label }}>
                        {isArchived ? "Restore" : "Archive"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void manageBranch(c.id, "toggle_exclude")}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.tertiaryBackground }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.label }}>
                        {c.excludedFromRollup ? "Include in Rollup" : "Exclude from Rollup"}
                      </Text>
                    </Pressable>
                    {!c.isPrimary && centres.length > 1 && (
                      <Pressable
                        onPress={() => void manageBranch(c.id, "delete")}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: brand.dangerSoft }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: brand.danger }}>Delete</Text>
                      </Pressable>
                    )}
                  </ScrollView>
                )}
              </View>
            );
          })}

          {capabilities.canManageTeam && (
            <View style={cardStyle}>
              <Text style={[typography.overline, { color: brand.accent }]}>
                {isSw ? "FUNGUA TAWI JIPYA" : "ADD BRANCH LOCATION"}
              </Text>
              <TextInput
                value={branchName}
                onChangeText={setBranchName}
                placeholder="Branch Name (e.g. Kariakoo Dispensary)"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />
              <TextInput
                value={branchRegion}
                onChangeText={setBranchRegion}
                placeholder="Region (e.g. Dar es Salaam)"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />
              <TextInput
                value={branchAddr}
                onChangeText={setBranchAddr}
                placeholder="Street Address"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />
              <TextInput
                value={branchPhone}
                onChangeText={setBranchPhone}
                keyboardType="phone-pad"
                placeholder="Branch Phone (+255...)"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />
              <PrimaryButton
                title={busy ? "..." : isSw ? "Ongeza Tawi" : "Create Branch"}
                loading={busy}
                onPress={() => void createBranch()}
              />
            </View>
          )}
        </>
      )}
    </KeyboardAwareScrollView>
  );
}
