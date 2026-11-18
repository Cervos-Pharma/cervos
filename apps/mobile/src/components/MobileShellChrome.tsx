import { useRef, useState } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileSession } from "../context/MobileSessionContext";
import { CERVOS_COLORS } from "../theme/tokens";

export function MobileTopHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    workspaceState,
    lang,
    setLang,
    isDark,
    pendingSync,
    syncing,
    searchQuery,
    setSearchQuery,
    brandAccent,
    syncNow,
    signOut,
  } = useMobileSession();
  const isSw = lang === "SW";

  const [searchExpanded, setSearchExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchWidth = useRef(new Animated.Value(36)).current;
  const inputRef = useRef<TextInput>(null);

  const account = (workspaceState?.account as { orgName?: string; region?: string } | undefined) || {};
  const activeCentreId = workspaceState?.activeCentreId as string | undefined;
  const centres = (workspaceState?.centres as Array<{ id: string; name: string }> | undefined) || [];
  const activeCentre = centres.find((c) => c.id === activeCentreId) ?? centres[0];
  const profile = (workspaceState?.activeProfile as { displayName?: string; role?: string } | undefined) || {};

  const initials = (profile.displayName || account.orgName || "C")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const toggleSearch = () => {
    const next = !searchExpanded;
    setSearchExpanded(next);
    Animated.timing(searchWidth, {
      toValue: next ? 175 : 36,
      duration: 240,
      useNativeDriver: false,
    }).start(() => {
      if (next) inputRef.current?.focus();
    });
    if (!next) setSearchQuery("");
  };

  const bg = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const surface = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  const menuDestinations: Array<{ route: "/(tabs)" | "/(tabs)/scanner" | "/(tabs)/inventory" | "/(tabs)/receipts" | "/(tabs)/messages" | "/(tabs)/permits"; label: string; sub: string }> = [
    { route: "/(tabs)", label: isSw ? "Kaunta ya POS" : "Counter POS", sub: isSw ? "Uza dawa haraka (FEFO)" : "Fast offline dispense & checkout" },
    { route: "/(tabs)/inventory", label: isSw ? "Stoo & FEFO" : "Inventory & Batches", sub: isSw ? "Makundi na tarehe za mwisho" : "Shelf levels & expiry monitoring" },
    { route: "/(tabs)/scanner", label: isSw ? "Skana GS1 / QR" : "Barcode & QR Scanner", sub: isSw ? "Kamera ya simu" : "Instant box & batch verification" },
    { route: "/(tabs)/receipts", label: isSw ? "Risiti & Mauzo" : "Receipts & Shift Sales", sub: isSw ? "Kumbukumbu za mauzo" : "Daily sales & payment mix" },
    { route: "/(tabs)/messages", label: isSw ? "Ujumbe wa Tawi" : "Branch Messages", sub: isSw ? "Mawasiliano ya timu" : "Team chat & approvals" },
    { route: "/(tabs)/permits", label: isSw ? "Leseni & Sync" : "Permits & Auto Sync", sub: isSw ? "Hali ya kusawazisha" : "Queue status, permits & alerts" },
  ];

  return (
    <>
      <View
        style={[
          styles.headerWrap,
          {
            paddingTop: Math.max(insets.top, 10) + 6,
            backgroundColor: bg,
            borderBottomColor: border,
          },
        ]}
      >
        {/* Left: Brand Logo & Compact Org/Branch Name */}
        <View style={[styles.brandLeft, searchExpanded && { maxWidth: 96 }]}>
          <View style={[styles.logoDot, { backgroundColor: brandAccent }]}>
            <Text style={styles.logoLetter}>C</Text>
          </View>
          {!searchExpanded && (
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.orgText, { color: text }]}>
                {account.orgName || "Cervos"}
              </Text>
              <Text numberOfLines={1} style={[styles.branchText, { color: muted }]}>
                {activeCentre?.name || account.region || "Branch"}
              </Text>
            </View>
          )}
        </View>

        {/* Right Cluster: Animated Expanding Search -> Expandable Menu -> User Button */}
        <View style={styles.rightCluster}>
          <Animated.View
            style={[
              styles.searchPill,
              {
                width: searchWidth,
                backgroundColor: surface,
                borderColor: border,
              },
            ]}
          >
            <TouchableOpacity onPress={toggleSearch} style={styles.searchIconBtn} accessibilityLabel="Search">
              <Text style={{ color: text, fontSize: 13, fontWeight: "800" }}>?</Text>
            </TouchableOpacity>
            {searchExpanded && (
              <>
                <TextInput
                  ref={inputRef}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={isSw ? "Tafuta..." : "Search..."}
                  placeholderTextColor={muted}
                  style={[styles.searchInput, { color: text }]}
                />
                <TouchableOpacity onPress={toggleSearch} style={{ paddingHorizontal: 4 }}>
                  <Text style={{ color: muted, fontWeight: "800", fontSize: 13 }}>x</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            style={[styles.iconCircle, { backgroundColor: surface, borderColor: border }]}
            accessibilityLabel="Open menu"
          >
            <View style={{ gap: 3 }}>
              <View style={[styles.bar, { backgroundColor: text, width: 14 }]} />
              <View style={[styles.bar, { backgroundColor: text, width: 14 }]} />
              <View style={[styles.bar, { backgroundColor: text, width: 9, alignSelf: "flex-end" }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setProfileOpen(true)}
            style={[styles.avatarCircle, { backgroundColor: brandAccent }]}
            accessibilityLabel="User settings"
          >
            <Text style={styles.avatarText}>{initials || "C"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable Full Workspace Menu Modal */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={[styles.sheetCard, { backgroundColor: bg, borderColor: border }]}>
            <View style={styles.sheetHead}>
              <View>
                <Text style={[styles.sheetTitle, { color: text }]}>{account.orgName || "Cervos Menu"}</Text>
                <Text style={{ color: muted, fontSize: 12 }}>
                  {syncing
                    ? "Syncing with cloud..."
                    : pendingSync > 0
                      ? `${pendingSync} offline transactions queued`
                      : "Auto-sync active"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMenuOpen(false)} style={[styles.closeBtn, { borderColor: border }]}>
                <Text style={{ color: text, fontWeight: "800" }}>x</Text>
              </TouchableOpacity>
            </View>

            {menuDestinations.map((dest) => (
              <TouchableOpacity
                key={dest.route}
                onPress={() => {
                  setMenuOpen(false);
                  router.push(dest.route);
                }}
                style={[styles.menuRow, { borderColor: border, backgroundColor: surface }]}
              >
                <Text style={{ color: text, fontWeight: "700", fontSize: 14 }}>{dest.label}</Text>
                <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>{dest.sub}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => {
                setMenuOpen(false);
                void syncNow();
              }}
              style={[styles.primaryAction, { backgroundColor: brandAccent }]}
            >
              <Text style={styles.primaryActionText}>{isSw ? "Sawazisha Sasa (Sync)" : "Sync Queue Now"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* User Account, Settings & Sign Out Modal */}
      <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setProfileOpen(false)} />
          <View style={[styles.sheetCard, { backgroundColor: bg, borderColor: border }]}>
            <View style={styles.sheetHead}>
              <View>
                <Text style={[styles.sheetTitle, { color: text }]}>{profile.displayName || "Operator"}</Text>
                <Text style={{ color: muted, fontSize: 11, textTransform: "uppercase" }}>
                  {(profile.role || "staff").replace(/_/g, " ")} &middot; {account.orgName || "Cervos"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setProfileOpen(false)} style={[styles.closeBtn, { borderColor: border }]}>
                <Text style={{ color: text, fontWeight: "800" }}>x</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                setLang(lang === "SW" ? "EN" : "SW");
                setProfileOpen(false);
              }}
              style={[styles.menuRow, { borderColor: border, backgroundColor: surface }]}
            >
              <Text style={{ color: text, fontWeight: "700", fontSize: 14 }}>
                {isSw ? `Badili Lugha (Sasa: ${lang})` : `Switch Language (Current: ${lang})`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setProfileOpen(false);
                router.push("/(tabs)/permits");
              }}
              style={[styles.menuRow, { borderColor: border, backgroundColor: surface }]}
            >
              <Text style={{ color: text, fontWeight: "700", fontSize: 14 }}>
                {isSw ? "Leseni, Sync & Mipangilio" : "Permits, Sync & Settings"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setProfileOpen(false);
                router.replace("/gate");
              }}
              style={[styles.menuRow, { borderColor: border, backgroundColor: surface }]}
            >
              <Text style={{ color: brandAccent, fontWeight: "700", fontSize: 14 }}>
                {isSw ? "Badili Wasifu / Funga PIN" : "Switch / Lock PIN Profile"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setProfileOpen(false);
                void signOut().then(() => router.replace("/auth"));
              }}
              style={[styles.menuRow, { borderColor: "rgba(244,63,94,0.3)", backgroundColor: "rgba(244,63,94,0.08)" }]}
            >
              <Text style={{ color: CERVOS_COLORS.rose, fontWeight: "700", fontSize: 14 }}>
                {isSw ? "Ondoka Akaunti" : "Sign Out Org"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function MobileBottomDock({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { workspaceState, lang, isDark, brandAccent } = useMobileSession();
  const isSw = lang === "SW";

  const activeRoute = state.routes[state.index]?.name || "index";
  const activeProfile = (workspaceState?.activeProfile as { role?: string } | undefined) || {};
  const roleLower = (activeProfile.role || "").toLowerCase();

  // Resolve Role-First Primary Center Action
  const centerTarget = roleLower.includes("warehouse") || roleLower.includes("dispatch")
    ? { name: "inventory", label: isSw ? "Stoo" : "Inventory" }
    : roleLower.includes("accountant") || roleLower.includes("finance") || roleLower.includes("research")
      ? { name: "receipts", label: isSw ? "Fedha" : "Finance" }
      : { name: "index", label: isSw ? "Kaunta POS" : "Counter POS" };

  // Left = Dashboard/Overview (or POS if center is Inventory)
  const leftTarget =
    centerTarget.name === "index"
      ? { name: "inventory", label: isSw ? "Stoo" : "Stock" }
      : { name: "index", label: isSw ? "Kaunta" : "Home POS" };

  const branchMessages = (workspaceState?.branchMessages as Array<unknown> | undefined) || [];
  const bg = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  return (
    <View
      style={[
        styles.dockWrap,
        {
          backgroundColor: bg,
          borderTopColor: border,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {/* Left: Overview / Stock */}
      <TouchableOpacity
        onPress={() => navigation.navigate(leftTarget.name)}
        style={styles.dockSideBtn}
      >
        <Text
          style={[
            styles.dockSideLabel,
            { color: activeRoute === leftTarget.name ? brandAccent : muted },
          ]}
        >
          {leftTarget.label}
        </Text>
      </TouchableOpacity>

      {/* Center: Prominent Role-Primary CTA */}
      <TouchableOpacity
        onPress={() => navigation.navigate(centerTarget.name)}
        style={[
          styles.dockCenterBtn,
          { backgroundColor: brandAccent },
        ]}
      >
        <Text style={styles.dockCenterText}>{centerTarget.label}</Text>
      </TouchableOpacity>

      {/* Right: Messages */}
      <TouchableOpacity
        onPress={() => navigation.navigate("messages")}
        style={styles.dockSideBtn}
      >
        <Text
          style={[
            styles.dockSideLabel,
            { color: activeRoute === "messages" ? brandAccent : muted },
          ]}
        >
          {isSw ? "Ujumbe" : "Messages"} {branchMessages.length > 0 ? `(${branchMessages.length})` : ""}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  logoDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  orgText: {
    fontSize: 13,
    fontWeight: "800",
  },
  branchText: {
    fontSize: 10,
    fontWeight: "600",
  },
  rightCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  searchPill: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  searchIconBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 0,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    height: 2,
    borderRadius: 2,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
    padding: 12,
  },
  sheetCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryAction: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  dockWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 10,
  },
  dockSideBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dockSideLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  dockCenterBtn: {
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  dockCenterText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
