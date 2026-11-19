import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { BottomSheet, Column, Host, Switch, Text as UiText } from "@expo/ui";
import {
  formatTzs,
  matchCatalogByBarcode,
  mineBasketAffinities,
  normalizeBarcode,
  parseScanIntent,
} from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyStateCard } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { printReceiptNative, shareReceiptPdf } from "@/services/receipts";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import type { WorkspaceSale } from "@/types/workspace";
import { summarizeProductsByEarliestExpiry, todayIsoDay } from "@/utils/intelligence";

const PAYMENT_CHANNELS = [
  { id: "mpesa", label: "M-Pesa" },
  { id: "tigo", label: "Mixx/Tigo" },
  { id: "airtel", label: "Airtel" },
  { id: "halopesa", label: "Halopesa" },
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "bank", label: "Bank" },
] as const;

export default function CounterPosScreen() {
  const router = useRouter();
  const {
    workspace,
    cloudCatalog,
    lang,
    isOnline,
    activeCentre,
    scopedBatches,
    scopedSales,
    scopedCustomers,
    prefs,
    pendingScannedCode,
    setPendingScannedCode,
    pendingScanContext,
    setPendingScanContext,
    queueAndApplyOffline,
    refreshState,
  } = useMobileSession();

  const accentHex = workspace?.account?.customization?.brandAccent;
  const brand = useBrandColors(accentHex);
  const isSw = lang === "SW";
  const todayIso = todayIsoDay();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_CHANNELS)[number]["id"]>("mpesa");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [prescriptionRef, setPrescriptionRef] = useState("");
  const [saveRepeat, setSaveRepeat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<WorkspaceSale | null>(null);

  const products = useMemo(
    () => summarizeProductsByEarliestExpiry(scopedBatches, todayIso),
    [scopedBatches, todayIso]
  );

  const categoriesInStock = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set).slice(0, 8);
  }, [products]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter === "rx" && !p.requiresPrescription) return false;
      if (catFilter !== "all" && catFilter !== "rx" && p.category !== catFilter) return false;
      if (!q) return true;
      return (
        p.brandName.toLowerCase().includes(q) ||
        p.genericName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.earliestBatch.toLowerCase().includes(q)
      );
    });
  }, [products, search, catFilter]);

  const adjustCart = useCallback(
    (productId: string, delta: number) => {
      const prod = products.find((p) => p.productId === productId);
      if (!prod) return;
      setCart((prev) => {
        const next = Math.max(0, Math.min(prod.validQty, (prev[productId] || 0) + delta));
        const copy = { ...prev };
        if (next === 0) delete copy[productId];
        else copy[productId] = next;
        return copy;
      });
      if (delta > 0) {
        void playSoundCue("cart-add");
        void triggerHaptic("light");
      } else {
        void triggerHaptic("selection");
      }
    },
    [products]
  );

  // Handle scanned barcode / GS1 / Lot QR / Receipt QR returned from /scanner-modal
  useEffect(() => {
    if (!pendingScannedCode) return;
    if (pendingScanContext && pendingScanContext !== "pos") return;
    const code = pendingScannedCode;
    setPendingScannedCode(null);
    setPendingScanContext(null);

    const intent = parseScanIntent(code);

    if (intent.kind === "receipt") {
      const allSales = workspace?.sales ?? scopedSales;
      const targetRcp = allSales.find(
        (s) =>
          (intent.saleId && s.id === intent.saleId) ||
          (s.receiptNumber && s.receiptNumber.toUpperCase() === intent.receiptNumber.toUpperCase())
      );
      void playSoundCue("scan");
      void triggerHaptic("success");
      if (targetRcp) {
        router.push(`/receipt-sheet?saleId=${encodeURIComponent(targetRcp.id)}`);
      } else {
        router.push("/(tabs)/receipts");
      }
      return;
    }

    const cloudHit = matchCatalogByBarcode(cloudCatalog, code);
    const gtin =
      intent.kind === "gs1" ? intent.gtin : intent.kind === "barcode" ? intent.code : null;
    const normGtin = gtin ? normalizeBarcode(gtin) : null;
    const lower = code.trim().toLowerCase();

    const batchMatch = scopedBatches.find(
      (b) =>
        (intent.kind === "lot" && b.batchNumber.toLowerCase() === intent.batchNumber.toLowerCase()) ||
        (intent.kind === "gs1" &&
          intent.batchNumber &&
          b.batchNumber.toLowerCase() === intent.batchNumber.toLowerCase()) ||
        (normGtin && b.barcode && normalizeBarcode(b.barcode) === normGtin) ||
        (cloudHit &&
          (b.productId === cloudHit.masterId ||
            b.productId === cloudHit.id ||
            b.brandName.toLowerCase() === cloudHit.brandName.toLowerCase() ||
            b.genericName.toLowerCase() === cloudHit.inn.toLowerCase())) ||
        b.batchNumber.toLowerCase() === lower ||
        b.productId.toLowerCase() === lower ||
        b.brandName.toLowerCase() === lower
    );

    const prodMatch = batchMatch
      ? products.find((p) => p.productId === batchMatch.productId)
      : products.find(
          (p) =>
            (cloudHit &&
              (p.productId === cloudHit.masterId ||
                p.productId === cloudHit.id ||
                p.brandName.toLowerCase() === cloudHit.brandName.toLowerCase() ||
                p.genericName.toLowerCase() === cloudHit.inn.toLowerCase())) ||
            p.brandName.toLowerCase().includes(lower) ||
            p.genericName.toLowerCase().includes(lower) ||
            p.productId.toLowerCase() === lower
        );

    if (!prodMatch) {
      void playSoundCue("alert");
      void triggerHaptic("error");
      if (cloudHit) {
        setFeedback({
          ok: false,
          text: isSw
            ? `Cloud Catalog imetambua ${cloudHit.brandName} (${cloudHit.segment}), lakini stoo ni 0.`
            : `Cloud Catalog matched ${cloudHit.brandName} (${cloudHit.segment}), but 0 stock on shelf.`,
        });
      } else {
        setFeedback({ ok: false, text: `No matching shelf item found for "${code}".` });
      }
      return;
    }

    if (batchMatch && (batchMatch.quarantined || batchMatch.expiryDate < todayIso)) {
      void playSoundCue("alert");
      void triggerHaptic("error");
      setFeedback({
        ok: false,
        text: `${batchMatch.brandName} lot ${batchMatch.batchNumber} is expired or quarantined.`,
      });
      return;
    }

    if (prodMatch.validQty <= (cart[prodMatch.productId] || 0)) {
      void playSoundCue("alert");
      setFeedback({ ok: false, text: `All valid units of ${prodMatch.brandName} are already in basket.` });
      return;
    }

    adjustCart(prodMatch.productId, 1);
    void playSoundCue("scan");
    setFeedback({ ok: true, text: `Added ${prodMatch.brandName} to basket.` });
  }, [
    pendingScannedCode,
    pendingScanContext,
    setPendingScannedCode,
    setPendingScanContext,
    cloudCatalog,
    scopedBatches,
    scopedSales,
    workspace?.sales,
    products,
    todayIso,
    cart,
    adjustCart,
    isSw,
    router,
  ]);

  const affinities = useMemo(() => mineBasketAffinities(scopedSales, 2), [scopedSales]);
  const crossSellSuggestions = useMemo(() => {
    const inCartIds = Object.keys(cart).filter((id) => (cart[id] || 0) > 0);
    if (inCartIds.length === 0 || affinities.length === 0) return [];
    const inCartSet = new Set(inCartIds);
    const seenIds = new Set<string>();
    const out: Array<{
      product: (typeof products)[number];
      confidencePct: number;
      pairedWith: string;
    }> = [];
    for (const aff of affinities) {
      let compId: string | null = null;
      let pairedWith = "";
      if (inCartSet.has(aff.aId) && !inCartSet.has(aff.bId)) {
        compId = aff.bId;
        pairedWith = aff.aName;
      } else if (inCartSet.has(aff.bId) && !inCartSet.has(aff.aId)) {
        compId = aff.aId;
        pairedWith = aff.bName;
      }
      if (!compId || seenIds.has(compId)) continue;
      const prod = products.find((p) => p.productId === compId && p.validQty > 0);
      if (!prod) continue;
      seenIds.add(compId);
      out.push({ product: prod, confidencePct: aff.confidencePct, pairedWith });
      if (out.length >= 3) break;
    }
    return out;
  }, [cart, affinities, products]);

  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartTotalTzs = cartEntries.reduce((sum, [pid, qty]) => {
    const p = products.find((item) => item.productId === pid);
    return sum + (p ? qty * p.salePriceTzs : 0);
  }, 0);
  const cartUnitCount = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const cartRequiresRx = cartEntries.some(
    ([pid]) => products.find((p) => p.productId === pid)?.requiresPrescription
  );

  const submitSale = async () => {
    if (cartEntries.length === 0 || busy) return;
    if (cartRequiresRx && !prescriptionRef.trim()) {
      void playSoundCue("alert");
      setFeedback({ ok: false, text: "Prescription reference required for Rx medicine in basket." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    const items = cartEntries.map(([productId, qty]) => ({ productId, qty }));
    const salePayload = {
      items,
      paymentMethod,
      prescriptionRef: prescriptionRef.trim() || undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      saveCustomerPreset: saveRepeat && customerName.trim().length >= 2,
      centreId: activeCentre?.id,
    };

    const handleOfflineFallback = async () => {
      const offlineOut = await queueAndApplyOffline("sale", salePayload);
      const localSale = offlineOut.nextSnapshot?.sales?.[0] ?? null;
      setCart({});
      setCheckoutOpen(false);
      setLastReceipt(localSale);
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setFeedback({
        ok: true,
        text: isSw
          ? `Mauzo yamehifadhiwa nje ya mtandao (${formatTzs(cartTotalTzs)}). Yatatuma mtandao ukirudi.`
          : `Saved offline sale (${formatTzs(cartTotalTzs)}). Queued to sync automatically.`,
      });
    };

    try {
      if (!isOnline) {
        await handleOfflineFallback();
        return;
      }

      try {
        const res = await postWorkspaceAction<{ totalTzs?: number; receipt?: WorkspaceSale }>({
          action: "dispense_pos",
          ...salePayload,
        });

        if (!res.ok) {
          await playSoundCue("alert");
          await triggerHaptic("error");
          setFeedback({ ok: false, text: res.data?.error || "Sale could not be completed." });
          return;
        }

        setCart({});
        setPrescriptionRef("");
        setCheckoutOpen(false);
        setLastReceipt(res.data.receipt ?? null);
        await playSoundCue("sale-complete");
        await triggerHaptic("success");
        setFeedback({
          ok: true,
          text: `Sale completed · ${formatTzs(res.data.totalTzs || cartTotalTzs)}`,
        });
        await refreshState();
      } catch {
        await handleOfflineFallback();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: brand.canvasBg }}>
      {/* Focused POS Header + Settings Shortcut (POS is ONLY POS) */}
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: brand.cardBg,
          borderBottomWidth: 1,
          borderBottomColor: brand.borderColor,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={typography.overline}>{activeCentre?.name || "DISPENSARY"}</Text>
            <Text style={typography.title}>{isSw ? "Kaunta ya POS" : "Counter POS"}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Pressable
              accessibilityLabel="Scan Barcode"
              onPress={() => {
                setPendingScanContext("pos");
                router.push("/scanner-modal?target=pos");
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.full,
                backgroundColor: brand.accentSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlatformIcon sf="qrcode.viewfinder" md="qr-code-scanner" color={brand.accent} size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel="POS Settings"
              onPress={() => router.push("/settings?scope=hardware")}
              style={{
                paddingHorizontal: 12,
                height: 40,
                borderRadius: radius.full,
                backgroundColor: colors.tertiaryBackground,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <PlatformIcon sf="gearshape.fill" md="settings" color={colors.label} size={17} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.label }}>
                {isSw ? "Mipangilio" : "Settings"}
              </Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={isSw ? "Tafuta dawa, jenarik au batch..." : "Search medicine, generic or batch..."}
          placeholderTextColor={brand.textMuted}
          style={{
            minHeight: 42,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: brand.inputBg,
            paddingHorizontal: spacing.md,
            color: brand.textPrimary,
            fontSize: 14,
          }}
        />

        {/* Web-Parity Category & Rx Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          {[
            { id: "all", label: isSw ? "Zote" : "All Shelf" },
            { id: "rx", label: "Rx Only" },
            ...categoriesInStock.map((c) => ({ id: c, label: c })),
          ].map((c) => {
            const active = catFilter === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setCatFilter(c.id);
                  void triggerHaptic("selection");
                }}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: radius.full,
                  backgroundColor: active ? brand.accent : brand.cardSubtleBg,
                  borderWidth: 1,
                  borderColor: active ? brand.accent : brand.borderColor,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#FFFFFF" : brand.textSecondary }}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {scopedCustomers.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {scopedCustomers.map((cust) => (
              <Pressable
                key={cust.id}
                onPress={() => {
                  const next = { ...cart };
                  for (const it of cust.items) {
                    const prod = products.find((p) => p.productId === it.productId);
                    if (prod && prod.validQty > 0) {
                      next[it.productId] = Math.min(prod.validQty, (next[it.productId] || 0) + it.qty);
                    }
                  }
                  setCart(next);
                  setCustomerName(cust.customerName);
                  setCustomerPhone(cust.phone || "");
                  void triggerHaptic("selection");
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radius.full,
                  backgroundColor: colors.tertiaryBackground,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.label }}>
                  {cust.customerName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {crossSellSuggestions.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={[typography.overline, { color: brand.accent }]}>
              {isSw ? "NYONGEZA YA KIKAPU (EDGE ML)" : "BASKET COMPANION ADD-ONS"}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
              {crossSellSuggestions.map(({ product, confidencePct }) => (
                <Pressable
                  key={product.productId}
                  onPress={() => adjustCart(product.productId, 1)}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: brand.accentSoft,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <PlatformIcon sf="plus.circle.fill" md="add-circle" color={brand.accent} size={14} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                    {product.brandName} · {confidencePct}%
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {feedback && (
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: radius.md,
              backgroundColor: feedback.ok ? brand.successSoft : brand.dangerSoft,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.sm,
            }}
          >
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: feedback.ok ? brand.success : brand.danger }}>
              {feedback.text}
            </Text>
            {lastReceipt && (
              <Pressable
                onPress={() =>
                  void printReceiptNative({
                    orgName: workspace?.account?.orgName || "Pharmacy",
                    branchName: activeCentre?.name || "Main",
                    sale: lastReceipt,
                    paperWidthMm: prefs.paperWidthMm,
                  })
                }
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>Print</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Shelf List */}
      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.productId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 120 }}
        ListEmptyComponent={
          <EmptyStateCard
            sf="pills"
            md="medication"
            title={isSw ? "Hakuna dawa zilizopatikana" : "No sellable stock matched"}
            description={
              isSw
                ? "Jaribu kubadilisha neno la utafutaji au ongeza mzigo stooni."
                : "Try another medicine name or receive new stock in the Stock tab."
            }
            actionLabel={isSw ? "Futa Utafutaji" : "Clear Search"}
            onAction={() => setSearch("")}
            accentHex={accentHex}
          />
        }
        renderItem={({ item }) => {
          const inCart = cart[item.productId] || 0;
          const outOfStock = item.validQty <= 0;
          return (
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.xl,
                borderCurve: "continuous",
                backgroundColor: colors.secondaryGroupedBackground,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.sm,
                opacity: outOfStock ? 0.55 : 1,
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={typography.headline}>{item.brandName}</Text>
                  {item.requiresPrescription && (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: brand.accentSoft,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: brand.accent }}>Rx</Text>
                    </View>
                  )}
                </View>
                <Text style={typography.caption}>
                  {item.genericName} · {item.validQty} valid · Exp {item.earliestExpiry || "-"}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: brand.accent }}>
                  {formatTzs(item.salePriceTzs)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Pressable
                  disabled={inCart === 0}
                  onPress={() => adjustCart(item.productId, -1)}
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.tertiaryBackground,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: inCart === 0 ? 0.35 : 1,
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.label }}>-</Text>
                </Pressable>
                <Text style={{ minWidth: 20, textAlign: "center", fontWeight: "700", color: colors.label }}>
                  {inCart}
                </Text>
                <Pressable
                  disabled={inCart >= item.validQty}
                  onPress={() => adjustCart(item.productId, 1)}
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: brand.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: inCart >= item.validQty ? 0.35 : 1,
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.onTint }}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {/* Sticky Active Basket Bar */}
      {cartEntries.length > 0 && (
        <View
          style={{
            position: "absolute",
            left: spacing.md,
            right: spacing.md,
            bottom: spacing.md,
            padding: spacing.md,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            backgroundColor: colors.secondaryGroupedBackground,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
            boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
          }}
        >
          <View>
            <Text style={typography.caption}>
              {cartUnitCount} {isSw ? "pakiti kikapuni" : "packs in basket"}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: brand.accent }}>
              {formatTzs(cartTotalTzs)}
            </Text>
          </View>
          <PrimaryButton
            title={isSw ? "Kagua & Uza" : "Review & Sell"}
            accentHex={accentHex}
            onPress={() => setCheckoutOpen(true)}
          />
        </View>
      )}

      {/* Native Checkout Review BottomSheet */}
      <Host seedColor={brand.accent}>
        <BottomSheet
          isPresented={checkoutOpen}
          onDismiss={() => setCheckoutOpen(false)}
          snapPoints={["full"]}
        >
          <Column spacing={12}>
            <UiText textStyle={{ fontSize: 18, fontWeight: "700" }}>
              {`${isSw ? "Uhakiki wa Mauzo" : "Sale Review"} · ${formatTzs(cartTotalTzs)}`}
            </UiText>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {PAYMENT_CHANNELS.map((pm) => {
                const selected = paymentMethod === pm.id;
                return (
                  <Pressable
                    key={pm.id}
                    onPress={() => {
                      setPaymentMethod(pm.id);
                      void triggerHaptic("selection");
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: radius.full,
                      backgroundColor: selected ? brand.accent : colors.tertiaryBackground,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: selected ? colors.onTint : colors.label,
                      }}
                    >
                      {pm.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {cartRequiresRx && (
              <TextInput
                value={prescriptionRef}
                onChangeText={setPrescriptionRef}
                placeholder="Prescription Ref *"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={{
                  minHeight: 44,
                  borderRadius: radius.md,
                  backgroundColor: colors.tertiaryBackground,
                  paddingHorizontal: spacing.md,
                  color: colors.label,
                }}
              />
            )}

            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={isSw ? "Jina la Mteja (hiari)" : "Customer Name (optional)"}
              placeholderTextColor={colors.tertiaryLabel as string}
              style={{
                minHeight: 44,
                borderRadius: radius.md,
                backgroundColor: colors.tertiaryBackground,
                paddingHorizontal: spacing.md,
                color: colors.label,
              }}
            />

            <TextInput
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="+255 7xx xxx xxx (optional)"
              placeholderTextColor={colors.tertiaryLabel as string}
              keyboardType="phone-pad"
              style={{
                minHeight: 44,
                borderRadius: radius.md,
                backgroundColor: colors.tertiaryBackground,
                paddingHorizontal: spacing.md,
                color: colors.label,
              }}
            />

            <Switch
              value={saveRepeat}
              onValueChange={setSaveRepeat}
              label={isSw ? "Hifadhi kwa mteja wa kudumu" : "Save repeat customer order"}
            />

            <PrimaryButton
              title={busy ? "Processing..." : isSw ? "Thibitisha Mauzo" : "Confirm Sale & Save Receipt"}
              loading={busy}
              accentHex={accentHex}
              onPress={submitSale}
            />

            {lastReceipt && (
              <PrimaryButton
                title={isSw ? "Tuma / Chapisha Risiti ya Mwisho" : "Share / Print Last Receipt PDF"}
                variant="outline"
                onPress={() =>
                  void shareReceiptPdf({
                    orgName: workspace?.account?.orgName || "Pharmacy",
                    branchName: activeCentre?.name || "Main",
                    sale: lastReceipt,
                    paperWidthMm: prefs.paperWidthMm,
                  })
                }
              />
            )}
          </Column>
        </BottomSheet>
      </Host>
    </View>
  );
}
