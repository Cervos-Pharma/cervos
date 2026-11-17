import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { formatTzs } from "../../lib/core";
import { useMobileSession } from "../../src/context/MobileSessionContext";
import { postWorkspaceAction } from "../../src/services/api";
import { enqueueOfflineMutation, triggerLocalAlertNotification } from "../../src/services/offlineSync";
import { CERVOS_COLORS, TOUCH_MIN_HEIGHT } from "../../src/theme/tokens";

interface MobileBatch {
  id: string;
  productId: string;
  brandName: string;
  genericName: string;
  quantity: number;
  salePriceTzs: number;
  expiryDate: string;
  quarantined: boolean;
}

export default function MobileCounterHubScreen() {
  const { workspaceState, lang, isDark, pendingSync, refreshWorkspace, syncNow } = useMobileSession();
  const isSw = lang === "SW";

  const account = (workspaceState?.account as { orgName?: string; fullName?: string } | undefined) || {};
  const activeProfile = (workspaceState?.activeProfile as { id?: string; displayName?: string; role?: string } | undefined) || {};
  const batches = ((workspaceState?.batches as MobileBatch[] | undefined) || []).filter((b) => !b.quarantined && b.quantity > 0);
  const sales = ((workspaceState?.sales as Array<{ totalTzs: number }> | undefined) || []);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "cash" | "tigo" | "halopesa" | "card">("mpesa");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const products = useMemo(() => {
    const map = new Map<string, { productId: string; brandName: string; genericName: string; price: number; qty: number }>();
    for (const b of batches) {
      const cur = map.get(b.productId);
      if (cur) cur.qty += b.quantity;
      else map.set(b.productId, { productId: b.productId, brandName: b.brandName, genericName: b.genericName, price: b.salePriceTzs, qty: b.quantity });
    }
    return Array.from(map.values());
  }, [batches]);

  const cartEntries = Object.entries(cart).filter(([, q]) => q > 0);
  const cartTotal = cartEntries.reduce((sum, [pid, qty]) => {
    const p = products.find((item) => item.productId === pid);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  const totalRev = sales.reduce((s, x) => s + x.totalTzs, 0);

  const confirmSale = async () => {
    if (cartEntries.length === 0) return;
    setBusy(true);
    setNotice(null);
    const items = cartEntries.map(([productId, qty]) => ({ productId, qty }));
    try {
      const res = await postWorkspaceAction({
        action: "dispense_pos",
        items,
        paymentMethod,
        customerName: customerName.trim() || undefined,
      });
      if (res.ok) {
        setCart({});
        setCustomerName("");
        setPreviewOpen(false);
        setNotice(isSw ? "Risiti imethibitishwa na kuchapishwa!" : "Sale confirmed & receipt saved cleanly.");
        await triggerLocalAlertNotification("Cervos Receipt Saved", `Total: ${formatTzs(cartTotal)}`);
        await refreshWorkspace();
        return;
      }
      throw new Error("Offline");
    } catch {
      await enqueueOfflineMutation("sale", {
        items,
        paymentMethod,
        operatorName: activeProfile.displayName || account.fullName || "Mobile POS",
        profileId: activeProfile.id || "mobile",
      });
      setCart({});
      setPreviewOpen(false);
      setNotice(isSw ? "Imehifadhiwa nje ya mtandao (itapakiwa kiotomatiki)." : "Saved offline cleanly; queued for next sync.");
    } finally {
      setBusy(false);
    }
  };

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.orgTag, { color: CERVOS_COLORS.cobalt }]}>{account.orgName || "CERVOS PHARMACY"}</Text>
          <Text style={[styles.greeting, { color: text }]}>
            {isSw ? `Karibu, ${activeProfile.displayName || account.fullName || "Mhudumu"}` : `Hi, ${activeProfile.displayName || account.fullName || "Operator"}`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => void syncNow()} style={[styles.syncBadge, { borderColor: border, backgroundColor: card }]}>
          <Text style={{ color: pendingSync > 0 ? CERVOS_COLORS.amber : CERVOS_COLORS.emerald, fontWeight: "700", fontSize: 11 }}>
            {pendingSync > 0 ? `${pendingSync} Queued` : "Synced"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cubeGrid}>
        <View style={[styles.cube, { backgroundColor: card, borderColor: border }]}>
          <Text style={{ color: muted, fontSize: 12 }}>{isSw ? "Mauzo Yote" : "Total Sales"}</Text>
          <Text style={[styles.cubeVal, { color: text }]}>{formatTzs(totalRev)}</Text>
        </View>
        <View style={[styles.cube, { backgroundColor: card, borderColor: border }]}>
          <Text style={{ color: muted, fontSize: 12 }}>{isSw ? "Dawa Rafuni" : "Stock Items"}</Text>
          <Text style={[styles.cubeVal, { color: text }]}>{products.length}</Text>
        </View>
      </View>

      {notice && (
        <View style={styles.noticeBox}>
          <Text style={{ color: "#059669", fontWeight: "700", fontSize: 13 }}>{notice}</Text>
        </View>
      )}

      <View style={[styles.sectionCard, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.sectionTitle, { color: text }]}>{isSw ? "Kaunta ya Haraka (FEFO POS)" : "Counter POS (FEFO)"}</Text>
        {products.length === 0 ? (
          <Text style={{ color: muted, fontSize: 13 }}>
            {isSw ? "Hakuna stoo bado. Ongeza dawa kwenye Stoo kuanza kuuza." : "No stock lots yet. Receive stock in Inventory to start dispensing."}
          </Text>
        ) : (
          products.map((p) => {
            const qty = cart[p.productId] || 0;
            return (
              <TouchableOpacity
                key={p.productId}
                onPress={() => setCart((prev) => ({ ...prev, [p.productId]: (prev[p.productId] || 0) + 1 }))}
                style={[styles.prodRow, { borderColor: qty > 0 ? CERVOS_COLORS.cobalt : border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: text, fontWeight: "700", fontSize: 14 }}>{p.brandName}</Text>
                  <Text style={{ color: muted, fontSize: 12 }}>{p.genericName} &middot; {p.qty} left</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: text, fontWeight: "700" }}>{formatTzs(p.price)}</Text>
                  {qty > 0 && <Text style={{ color: CERVOS_COLORS.cobalt, fontWeight: "800", fontSize: 12 }}>x{qty}</Text>}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {cartEntries.length > 0 && (
          <TouchableOpacity onPress={() => setPreviewOpen(true)} style={[styles.checkoutBtn, { backgroundColor: CERVOS_COLORS.cobalt }]}>
            <Text style={styles.checkoutText}>
              {isSw ? `Kagua & Uza (${formatTzs(cartTotal)}) ->` : `Review & Sell (${formatTzs(cartTotal)}) ->`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={previewOpen} transparent animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: card, borderColor: border }]}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              {isSw ? "Uhakiki wa Risiti" : "Pre-Receipt Focus Check"} &middot; {formatTzs(cartTotal)}
            </Text>
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={isSw ? "Jina la Mteja (Hiari)" : "Customer Name (Optional)"}
              placeholderTextColor={muted}
              style={[styles.input, { color: text, borderColor: border }]}
            />
            <View style={styles.payRow}>
              {(["mpesa", "cash", "tigo", "halopesa", "card"] as const).map((pm) => (
                <TouchableOpacity
                  key={pm}
                  onPress={() => setPaymentMethod(pm)}
                  style={[
                    styles.payPill,
                    {
                      backgroundColor: paymentMethod === pm ? CERVOS_COLORS.cobalt : bg,
                      borderColor: border,
                    },
                  ]}
                >
                  <Text style={{ color: paymentMethod === pm ? "#FFFFFF" : text, fontWeight: "700", fontSize: 11 }}>
                    {pm.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setPreviewOpen(false)} style={[styles.cancelBtn, { borderColor: border }]}>
                <Text style={{ color: text, fontWeight: "700" }}>{isSw ? "Ghairi" : "Back"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmSale} disabled={busy} style={[styles.confirmBtn, { backgroundColor: CERVOS_COLORS.cobalt }]}>
                <Text style={styles.checkoutText}>{busy ? "Saving..." : isSw ? "Thibitisha & Chapisha ->" : "Confirm & Print ->"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 32, gap: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orgTag: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  greeting: { fontSize: 22, fontWeight: "700", marginTop: 2 },
  syncBadge: { paddingHorizontal: 12, minHeight: 36, borderRadius: 999, borderWidth: 1, justifyContent: "center" },
  cubeGrid: { flexDirection: "row", gap: 12 },
  cube: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 16, gap: 6 },
  cubeVal: { fontSize: 18, fontWeight: "700" },
  noticeBox: { borderRadius: 14, padding: 12, backgroundColor: "rgba(16,185,129,0.14)" },
  sectionCard: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  prodRow: { borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center" },
  checkoutBtn: { minHeight: TOUCH_MIN_HEIGHT + 4, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 4 },
  checkoutText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(9,12,18,0.7)", justifyContent: "center", padding: 18 },
  modalCard: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 14 },
  input: { minHeight: TOUCH_MIN_HEIGHT, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  payRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  payPill: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, justifyContent: "center" },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { minHeight: TOUCH_MIN_HEIGHT, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, justifyContent: "center" },
  confirmBtn: { flex: 1, minHeight: TOUCH_MIN_HEIGHT, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
