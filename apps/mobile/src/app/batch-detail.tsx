import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Host, Switch } from "@expo/ui";
import { buildLotQrPayload, formatTzs, parseScanIntent } from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { QrMatrixView } from "@/components/qr-matrix-view";
import { EmptyStateCard } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

export default function BatchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const {
    workspace,
    activeCentre,
    scopedBatches,
    scopedSales,
    capabilities,
    lang,
    pendingScannedCode,
    pendingScanContext,
    setPendingScannedCode,
    setPendingScanContext,
    runOnlineOrQueue,
  } = useMobileSession();

  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";

  const batch = useMemo(
    () =>
      scopedBatches.find((b) => b.id === id) ??
      (workspace?.batches ?? []).find((b) => b.id === id) ??
      null,
    [scopedBatches, workspace?.batches, id]
  );

  const [brandName, setBrandName] = useState(batch?.brandName || "");
  const [genericName, setGenericName] = useState(batch?.genericName || "");
  const [category, setCategory] = useState(batch?.category || "Essential");
  const [batchNumber, setBatchNumber] = useState(batch?.batchNumber || "");
  const [barcode, setBarcode] = useState(batch?.barcode || "");
  const [quantity, setQuantity] = useState(String(batch?.quantity ?? 0));
  const [costPriceTzs, setCostPriceTzs] = useState(String(batch?.costPriceTzs ?? 0));
  const [salePriceTzs, setSalePriceTzs] = useState(String(batch?.salePriceTzs ?? 0));
  const [threshold, setThreshold] = useState(String(batch?.lowStockThreshold ?? 25));
  const [expiryDate, setExpiryDate] = useState(batch?.expiryDate || "");
  const [requiresRx, setRequiresRx] = useState(Boolean(batch?.requiresPrescription));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!batch) return;
    setBrandName(batch.brandName);
    setGenericName(batch.genericName);
    setCategory(batch.category);
    setBatchNumber(batch.batchNumber);
    setBarcode(batch.barcode || "");
    setQuantity(String(batch.quantity));
    setCostPriceTzs(String(batch.costPriceTzs));
    setSalePriceTzs(String(batch.salePriceTzs));
    setThreshold(String(batch.lowStockThreshold ?? 25));
    setExpiryDate(batch.expiryDate);
    setRequiresRx(Boolean(batch.requiresPrescription));
  }, [batch?.id]);

  // Accept barcode scan back when scanner is opened from this screen
  useEffect(() => {
    if (!pendingScannedCode || pendingScanContext !== "batch") return;
    const code = pendingScannedCode;
    setPendingScannedCode(null);
    setPendingScanContext(null);
    const intent = parseScanIntent(code);
    if (intent.kind === "gs1") {
      setBarcode(intent.gtin || code);
      if (intent.batchNumber) setBatchNumber(intent.batchNumber);
      if (intent.expiryDate) setExpiryDate(intent.expiryDate);
    } else if (intent.kind === "barcode") {
      setBarcode(intent.code);
    } else {
      setBarcode(code);
    }
    void playSoundCue("scan");
    void triggerHaptic("success");
  }, [pendingScannedCode, pendingScanContext, setPendingScannedCode, setPendingScanContext]);

  const linkedSales = useMemo(() => {
    if (!batch) return [];
    return scopedSales
      .filter((s) =>
        (s.lines ?? []).some(
          (ln) =>
            ln.batchNumber?.toLowerCase() === batch.batchNumber.toLowerCase() ||
            ln.productId === batch.productId
        )
      )
      .slice(0, 6);
  }, [scopedSales, batch]);

  const qrPayload = useMemo(() => {
    if (!batch) return "";
    return buildLotQrPayload(batchNumber || batch.batchNumber);
  }, [batch, batchNumber]);

  if (!batch) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.groupedBackground, justifyContent: "center", padding: spacing.md }}>
        <EmptyStateCard
          sf="shippingbox"
          md="inventory-2"
          title={isSw ? "Kundi halijapatikana" : "Stock batch not found"}
          description={isSw ? "Rudi kwenye orodha ya stoo kuchagua kundi lingine." : "Return to Stock to select a valid batch."}
          actionLabel={isSw ? "Rudi Nyuma" : "Go Back"}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const unitCost = Number(costPriceTzs) || 0;
  const unitSale = Number(salePriceTzs) || 0;
  const unitMargin = Math.max(0, unitSale - unitCost);
  const marginPct = unitSale > 0 ? Math.round((unitMargin / unitSale) * 100) : 0;
  const lotRetailValue = (Number(quantity) || 0) * unitSale;

  const saveEdit = async () => {
    if (!capabilities.canEditInventory || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const payload = {
        batchId: batch.id,
        brandName: brandName.trim() || batch.brandName,
        genericName: genericName.trim() || batch.genericName,
        category: category.trim() || batch.category,
        batchNumber: batchNumber.trim() || batch.batchNumber,
        barcode: barcode.trim(),
        quantity: Math.max(0, Math.round(Number(quantity) || 0)),
        costPriceTzs: Math.max(50, Math.round(Number(costPriceTzs) || batch.costPriceTzs)),
        salePriceTzs: Math.max(100, Math.round(Number(salePriceTzs) || batch.salePriceTzs)),
        lowStockThreshold: Math.max(1, Math.round(Number(threshold) || 25)),
        expiryDate: expiryDate.trim() || batch.expiryDate,
        requiresPrescription: requiresRx,
      };
      const out = await runOnlineOrQueue(
        { action: "manage_batch", subAction: "edit_batch", ...payload },
        { type: "edit_batch", payload: { ...payload, centreId: activeCentre?.id } }
      );
      if (!out.ok) {
        await playSoundCue("alert");
        setNotice({ ok: false, text: out.error || "Could not update batch." });
        return;
      }
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setNotice({
        ok: true,
        text: out.queued
          ? isSw ? "Mabadiliko yamehifadhiwa nje ya mtandao." : "Saved offline and queued for sync."
          : isSw ? "Taarifa za kundi zimesasishwa!" : "Batch details updated.",
      });
    } finally {
      setBusy(false);
    }
  };

  const quickAdjust10 = async () => {
    if (!capabilities.canEditInventory || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const out = await runOnlineOrQueue(
        { action: "manage_batch", subAction: "adjust_qty", batchId: batch.id, delta: 10 },
        { type: "adjust_qty", payload: { batchId: batch.id, delta: 10 } }
      );
      if (out.ok) {
        setQuantity(String((Number(quantity) || 0) + 10));
        await playSoundCue("tap");
        await triggerHaptic("light");
        setNotice({
          ok: true,
          text: out.queued ? "+10 packs queued offline." : "+10 packs added to lot.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleQuarantine = async () => {
    if (!capabilities.canEditInventory || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const out = await runOnlineOrQueue(
        { action: "manage_batch", subAction: "toggle_quarantine", batchId: batch.id },
        { type: "toggle_quarantine", payload: { batchId: batch.id } }
      );
      if (out.ok) {
        await playSoundCue("switch");
        await triggerHaptic("medium");
        setNotice({
          ok: true,
          text: batch.quarantined ? "Batch released for sale." : "Batch placed in quarantine hold.",
        });
      }
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
      {/* Lot Summary & Metrics */}
      <View style={cardStyle}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.overline, { color: brand.accent }]}>
              LOT {batch.batchNumber} · {batch.category.toUpperCase()}
            </Text>
            <Text style={typography.title}>{batch.brandName}</Text>
            <Text style={typography.subhead}>{batch.genericName}</Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radius.full,
              backgroundColor: batch.quarantined ? brand.dangerSoft : brand.successSoft,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: batch.quarantined ? brand.danger : brand.success }}>
              {batch.quarantined ? (isSw ? "Imezuiwa" : "Quarantined") : isSw ? "Inauzika" : "Sellable"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm, paddingTop: 4 }}>
          <View style={{ flex: 1, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.tertiaryBackground }}>
            <Text style={typography.caption}>{isSw ? "Faida/Pakiti" : "Unit Margin"}</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: brand.success }}>
              {formatTzs(unitMargin)} ({marginPct}%)
            </Text>
          </View>
          <View style={{ flex: 1, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.tertiaryBackground }}>
            <Text style={typography.caption}>{isSw ? "Thamani ya Lot" : "Lot Retail Value"}</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: brand.accent }}>
              {formatTzs(lotRetailValue, { compact: true })}
            </Text>
          </View>
        </View>
      </View>

      {/* Lot QR Matrix */}
      <View style={[cardStyle, { alignItems: "center" }]}>
        <Text style={[typography.overline, { color: brand.accent, alignSelf: "flex-start" }]}>
          {isSw ? "MSIMBOPAU & QR YA KUNDI" : "SHELF LABEL QR MATRIX"}
        </Text>
        <QrMatrixView value={qrPayload} moduleSize={4} />
        <Text style={typography.caption} numberOfLines={2}>
          {barcode ? `EAN/GTIN: ${barcode} · ` : ""}Exp {expiryDate || batch.expiryDate}
        </Text>
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

      {/* Editable Lot Fields */}
      {capabilities.canEditInventory && (
        <View style={cardStyle}>
          <Text style={typography.overline}>{isSw ? "HARIRI TAARIFA ZA KUNDI" : "EDIT BATCH DETAILS"}</Text>

          <Text style={typography.caption}>{isSw ? "Jina la Biashara" : "Brand Name"}</Text>
          <TextInput value={brandName} onChangeText={setBrandName} style={inputStyle} />

          <Text style={typography.caption}>{isSw ? "Jina la Jenarik" : "Generic INN"}</Text>
          <TextInput value={genericName} onChangeText={setGenericName} style={inputStyle} />

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={typography.caption}>{isSw ? "Kundi (Lot #)" : "Lot #"}</Text>
              <TextInput value={batchNumber} onChangeText={setBatchNumber} style={inputStyle} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={typography.caption}>{isSw ? "Mwisho wa Matumizi" : "Expiry (YYYY-MM-DD)"}</Text>
              <TextInput value={expiryDate} onChangeText={setExpiryDate} style={inputStyle} />
            </View>
          </View>

          <Text style={typography.caption}>{isSw ? "Msimbopau (EAN / GTIN)" : "Barcode (EAN / GTIN)"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <TextInput
              value={barcode}
              onChangeText={setBarcode}
              placeholder="e.g. 6201234567890"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={[inputStyle, { flex: 1 }]}
            />
            <Pressable
              onPress={() => {
                setPendingScanContext("batch");
                router.push("/scanner-modal?target=batch");
              }}
              style={{
                minHeight: 44,
                paddingHorizontal: 12,
                borderRadius: radius.md,
                backgroundColor: brand.accentSoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <PlatformIcon sf="barcode.viewfinder" md="qr-code-scanner" color={brand.accent} size={17} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                {isSw ? "Skani" : "Scan"}
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={typography.caption}>{isSw ? "Idadi (Pakiti)" : "Quantity"}</Text>
              <TextInput value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={inputStyle} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={typography.caption}>{isSw ? "Kiwango cha Tahadhari" : "Low Alert Threshold"}</Text>
              <TextInput value={threshold} onChangeText={setThreshold} keyboardType="number-pad" style={inputStyle} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={typography.caption}>{isSw ? "Bei ya Manunuzi (TZS)" : "Cost Price (TZS)"}</Text>
              <TextInput value={costPriceTzs} onChangeText={setCostPriceTzs} keyboardType="number-pad" style={inputStyle} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={typography.caption}>{isSw ? "Bei ya Kuuza (TZS)" : "Sale Price (TZS)"}</Text>
              <TextInput value={salePriceTzs} onChangeText={setSalePriceTzs} keyboardType="number-pad" style={inputStyle} />
            </View>
          </View>

          <Text style={typography.caption}>{isSw ? "Kategoria" : "Therapeutic Category"}</Text>
          <TextInput value={category} onChangeText={setCategory} style={inputStyle} />

          <Host matchContents seedColor={brand.accent}>
            <Switch
              value={requiresRx}
              onValueChange={setRequiresRx}
              label={isSw ? "Inahitaji Cheti cha Daktari (Rx)" : "Requires Prescription (Rx)"}
            />
          </Host>

          <PrimaryButton
            title={busy ? "..." : isSw ? "Hifadhi Mabadiliko" : "Save Batch Changes"}
            loading={busy}
            onPress={() => void saveEdit()}
          />

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <PrimaryButton
              title="+10 Packs"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => void quickAdjust10()}
            />
            <PrimaryButton
              title={batch.quarantined ? (isSw ? "Rejesha Stooni" : "Release Hold") : isSw ? "Zuia (Quarantine)" : "Quarantine"}
              variant={batch.quarantined ? "outline" : "destructive"}
              style={{ flex: 1 }}
              onPress={() => void toggleQuarantine()}
            />
          </View>
        </View>
      )}

      {/* Linked Sales History */}
      <View style={cardStyle}>
        <Text style={typography.overline}>{isSw ? "RISITI ZINAZOHUSIANA" : "RECENT DISPENSE HISTORY"}</Text>
        {linkedSales.length === 0 ? (
          <Text style={typography.caption}>
            {isSw ? "Hakuna mauzo yaliyoandikwa kutoka kundi hili bado." : "No counter receipts recorded for this batch yet."}
          </Text>
        ) : (
          <ScrollView horizontal={false} scrollEnabled={false} contentContainerStyle={{ gap: 6 }}>
            {linkedSales.map((s) => (
              <View
                key={s.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 6,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.separator,
                }}
              >
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.label }}>
                    {s.receiptNumber || s.id}
                  </Text>
                  <Text style={typography.caption}>
                    {s.customerName || "Walk-in"} · {s.createdAt.slice(0, 10)}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: brand.accent }}>
                  {formatTzs(s.totalTzs)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}
