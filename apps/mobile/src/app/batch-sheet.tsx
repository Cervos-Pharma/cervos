import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Host, Switch } from "@expo/ui";
import {
  formatTzs,
  matchCatalogByBarcode,
  parseScanIntent,
  type CloudCatalogProduct,
} from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import { DEFAULT_DRUG_CATEGORIES, type WorkspaceBatch } from "@/types/workspace";

type AutofillCandidate = {
  id: string;
  brandName: string;
  genericName: string;
  category: string;
  costPriceTzs: number;
  salePriceTzs: number;
  requiresPrescription: boolean;
  barcode?: string;
  segment?: string;
  fromCloud?: boolean;
};

function resolveCategoryChip(rawCategory: string, segment: string, list: string[]): string | null {
  const catLower = rawCategory.trim().toLowerCase();
  const segLower = segment.trim().toLowerCase();
  const exact = list.find((c) => c.toLowerCase() === catLower || c.toLowerCase() === segLower);
  if (exact) return exact;
  const partial = list.find(
    (c) =>
      (catLower.length >= 3 && (c.toLowerCase().includes(catLower) || catLower.includes(c.toLowerCase()))) ||
      (segLower.length >= 3 && c.toLowerCase().includes(segLower))
  );
  return partial ?? null;
}

export default function BatchSheetScreen() {
  const router = useRouter();
  const { barcode: paramBarcode } = useLocalSearchParams<{ barcode?: string }>();
  const {
    workspace,
    cloudCatalog,
    activeCentre,
    scopedBatches,
    lang,
    pendingScannedCode,
    setPendingScannedCode,
    pendingScanContext,
    setPendingScanContext,
    runOnlineOrQueue,
  } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";

  const [brandName, setBrandName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [gs1Raw, setGs1Raw] = useState("");
  const [category, setCategory] = useState<string>("Essential");
  const [customCategory, setCustomCategory] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("20");
  const [costPriceTzs, setCostPriceTzs] = useState("");
  const [salePriceTzs, setSalePriceTzs] = useState("");
  const [expiryDate, setExpiryDate] = useState("2027-06-30");
  const [requiresRx, setRequiresRx] = useState(false);
  const [appliedBrand, setAppliedBrand] = useState<string | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [cloudMatchBadge, setCloudMatchBadge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appliedParamRef = useRef<string | null>(null);

  const categories = useMemo(() => {
    const merged = [...DEFAULT_DRUG_CATEGORIES, ...(workspace?.account?.customCategories ?? [])];
    return Array.from(new Set(merged));
  }, [workspace?.account?.customCategories]);

  const applyBarcodeOrGs1 = useCallback(
    (raw: string, notifyUser = false) => {
      const trimmed = raw.trim();
      setBarcodeInput(raw);
      if (trimmed.length < 3) {
        setGs1Raw("");
        setCloudMatchBadge(null);
        return;
      }

      const intent = parseScanIntent(trimmed);
      if (intent.kind === "gs1") {
        setGs1Raw(trimmed);
        if (intent.gtin) setBarcodeInput(intent.gtin);
        if (intent.batchNumber) setBatchNumber(intent.batchNumber);
        if (intent.expiryDate) setExpiryDate(intent.expiryDate);
      } else {
        setGs1Raw("");
        if (intent.kind === "lot" && intent.batchNumber) {
          setBatchNumber(intent.batchNumber);
        }
      }

      const cloudHit: CloudCatalogProduct | null = matchCatalogByBarcode(cloudCatalog, trimmed);
      if (cloudHit) {
        setBrandName(cloudHit.brandName);
        setGenericName(cloudHit.inn);
        const chip = resolveCategoryChip(cloudHit.category, cloudHit.segment, categories);
        if (chip) {
          setCategory(chip);
          setCustomCategory("");
        } else {
          setCustomCategory(cloudHit.category || cloudHit.segment);
        }
        setCostPriceTzs(String(cloudHit.defaultCostTzs));
        setSalePriceTzs(String(cloudHit.defaultSaleTzs));
        setRequiresRx(Boolean(cloudHit.requiresPrescription));
        setAppliedBrand(cloudHit.brandName.trim());
        setDismissedFor(null);
        setCloudMatchBadge(
          isSw
            ? `Imetoka Cloud Catalog · ${cloudHit.segment}`
            : `Matched from Cloud Catalog · ${cloudHit.segment}`
        );
        if (notifyUser) {
          void playSoundCue("scan");
          void triggerHaptic("success");
        }
      } else {
        setCloudMatchBadge(null);
        if (notifyUser && intent.kind === "gs1") {
          void playSoundCue("scan");
          void triggerHaptic("light");
        }
      }
    },
    [cloudCatalog, categories, isSw]
  );

  // Prefill from ?barcode=... route param (e.g. from Inventory scan)
  useEffect(() => {
    if (!paramBarcode || appliedParamRef.current === paramBarcode) return;
    appliedParamRef.current = paramBarcode;
    applyBarcodeOrGs1(paramBarcode, true);
  }, [paramBarcode, applyBarcodeOrGs1]);

  // Consume scanned code returned from /scanner-modal?target=batch
  useEffect(() => {
    if (!pendingScannedCode || pendingScanContext !== "batch") return;
    const code = pendingScannedCode;
    setPendingScannedCode(null);
    setPendingScanContext(null);
    applyBarcodeOrGs1(code, true);
  }, [
    pendingScannedCode,
    pendingScanContext,
    setPendingScannedCode,
    setPendingScanContext,
    applyBarcodeOrGs1,
  ]);

  // Deduplicated catalog pool (local batches + universal Cloud Catalog) for entry autofill suggestions
  const catalogEntries = useMemo<AutofillCandidate[]>(() => {
    const pool = [...scopedBatches, ...(workspace?.batches ?? [])];
    const byBrand = new Map<string, AutofillCandidate>();
    for (const b of pool) {
      const key = b.brandName.trim().toLowerCase();
      if (!key || byBrand.has(key)) continue;
      byBrand.set(key, {
        id: b.id,
        brandName: b.brandName,
        genericName: b.genericName,
        category: b.category,
        costPriceTzs: b.costPriceTzs,
        salePriceTzs: b.salePriceTzs,
        requiresPrescription: b.requiresPrescription,
        barcode: b.barcode,
        segment: b.segment,
        fromCloud: false,
      });
    }
    for (const c of cloudCatalog) {
      const key = c.brandName.trim().toLowerCase();
      if (!key || byBrand.has(key)) continue;
      byBrand.set(key, {
        id: c.id,
        brandName: c.brandName,
        genericName: c.inn,
        category: c.category,
        costPriceTzs: c.defaultCostTzs,
        salePriceTzs: c.defaultSaleTzs,
        requiresPrescription: c.requiresPrescription,
        barcode: c.barcodes[0],
        segment: c.segment,
        fromCloud: true,
      });
    }
    return Array.from(byBrand.values());
  }, [scopedBatches, workspace?.batches, cloudCatalog]);

  // Up to 3 unique catalog suggestions while typing brandName
  const suggestions = useMemo(() => {
    const q = brandName.trim().toLowerCase();
    if (q.length < 2) return [];
    if (appliedBrand && q === appliedBrand.trim().toLowerCase()) return [];
    if (dismissedFor) {
      const d = dismissedFor.trim().toLowerCase();
      if (q === d || q.startsWith(d)) return [];
    }

    const out: AutofillCandidate[] = [];
    for (const b of catalogEntries) {
      if (
        b.brandName.toLowerCase().includes(q) ||
        b.genericName.toLowerCase().includes(q)
      ) {
        out.push(b);
        if (out.length >= 3) break;
      }
    }
    return out;
  }, [brandName, catalogEntries, appliedBrand, dismissedFor]);

  const handleBrandChange = (text: string) => {
    setBrandName(text);
    const q = text.trim().toLowerCase();
    if (q.length < 2) {
      setAppliedBrand(null);
      setDismissedFor(null);
      return;
    }

    const hasCatalogMatch = catalogEntries.some(
      (b) => b.brandName.toLowerCase().includes(q) || b.genericName.toLowerCase().includes(q)
    );
    if (!hasCatalogMatch) {
      setAppliedBrand(null);
      setDismissedFor(null);
      return;
    }

    if (appliedBrand) {
      const a = appliedBrand.trim().toLowerCase();
      if (!a.includes(q) && !q.includes(a)) {
        setAppliedBrand(null);
      }
    }
    if (dismissedFor) {
      const d = dismissedFor.trim().toLowerCase();
      if (!q.startsWith(d) && !d.startsWith(q)) {
        setDismissedFor(null);
      }
    }
  };

  const applyAutofill = (item: AutofillCandidate) => {
    setBrandName(item.brandName);
    setGenericName(item.genericName);
    const chip = resolveCategoryChip(item.category, item.segment || "", categories);
    if (chip) {
      setCategory(chip);
      setCustomCategory("");
    } else {
      setCustomCategory(item.category);
    }
    setCostPriceTzs(String(item.costPriceTzs));
    setSalePriceTzs(String(item.salePriceTzs));
    setRequiresRx(item.requiresPrescription);
    if (item.barcode && !barcodeInput.trim()) {
      setBarcodeInput(item.barcode);
    }
    if (item.fromCloud) {
      setCloudMatchBadge(
        isSw
          ? `Imetoka Cloud Catalog · ${item.segment || item.category}`
          : `Matched from Cloud Catalog · ${item.segment || item.category}`
      );
    }
    setAppliedBrand(item.brandName.trim());
    setDismissedFor(null);
    void triggerHaptic("selection");
  };

  const handleSave = async () => {
    const finalCat = (customCategory.trim() || category).trim() || "Essential";
    if (!brandName.trim() || !batchNumber.trim()) {
      setError("Brand name and batch lot number are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cleanBarcode = barcodeInput.trim();
      const intent = cleanBarcode ? parseScanIntent(cleanBarcode) : null;
      const resolvedBarcode =
        intent?.kind === "gs1"
          ? intent.gtin || cleanBarcode
          : intent?.kind === "barcode"
            ? intent.code
            : cleanBarcode;
      const resolvedGs1 = gs1Raw.trim() || (intent?.kind === "gs1" ? cleanBarcode : "");

      const batchPayload = {
        brandName: brandName.trim(),
        genericName: genericName.trim() || brandName.trim(),
        category: finalCat,
        batchNumber: batchNumber.trim(),
        quantity: Number(quantity) || 0,
        costPriceTzs: Number(costPriceTzs) || 0,
        salePriceTzs: Number(salePriceTzs) || 0,
        expiryDate: expiryDate.trim(),
        requiresPrescription: requiresRx,
        ...(resolvedBarcode ? { barcode: resolvedBarcode } : {}),
        ...(resolvedGs1 ? { gs1Barcode: resolvedGs1 } : {}),
      };

      const out = await runOnlineOrQueue(
        { action: "manage_batch", subAction: "add_batch", ...batchPayload },
        { type: "add_batch", payload: { ...batchPayload, centreId: activeCentre?.id } }
      );
      if (!out.ok) {
        await playSoundCue("alert");
        setError(out.error || "Could not add batch.");
        return;
      }
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      router.back();
    } finally {
      setBusy(false);
    }
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
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 48 }}
    >
      <Text style={typography.overline}>RECEIVE STOCK INTO BRANCH</Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <TextInput
          value={brandName}
          onChangeText={handleBrandChange}
          placeholder="Brand Name (e.g. Amoxil, Coartem)"
          placeholderTextColor={colors.tertiaryLabel as string}
          style={[inputStyle, { flex: 1 }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan Barcode or GS1"
          onPress={() => {
            setPendingScanContext("batch");
            router.push("/scanner-modal?target=batch");
          }}
          style={{
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: brand.accentSoft,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <PlatformIcon sf="barcode.viewfinder" md="qr-code-scanner" color={brand.accent} size={18} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
            {isSw ? "Skani GS1" : "Scan Barcode / GS1"}
          </Text>
        </Pressable>
      </View>

      {cloudMatchBadge && (
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radius.full,
            backgroundColor: brand.successSoft,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <PlatformIcon sf="checkmark.seal.fill" md="verified" color={brand.success} size={14} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: brand.success }}>
            {cloudMatchBadge}
          </Text>
        </View>
      )}

      {suggestions.length > 0 && (
        <View
          style={{
            padding: spacing.sm,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            backgroundColor: colors.secondaryGroupedBackground,
            borderWidth: 1,
            borderColor: brand.staticBorder,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
            <Text style={[typography.overline, { color: brand.accent }]}>
              {isSw ? "MAPENDEKEZO YA STOO" : "CATALOG SUGGESTIONS"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss suggestions"
              onPress={() => setDismissedFor(brandName.trim())}
              hitSlop={8}
              style={{ padding: 2 }}
            >
              <PlatformIcon sf="xmark" md="close" color={colors.secondaryLabel} size={15} />
            </Pressable>
          </View>

          {suggestions.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => applyAutofill(item)}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.sm,
                paddingVertical: 8,
                borderRadius: radius.md,
                backgroundColor: pressed ? brand.accentSoft : colors.tertiaryBackground,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: spacing.sm,
              })}
            >
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.label }} numberOfLines={1}>
                  {item.brandName}
                </Text>
                <Text style={{ fontSize: 11, color: colors.secondaryLabel }} numberOfLines={1}>
                  {item.genericName} · {item.category} · {formatTzs(item.salePriceTzs)}
                  {item.fromCloud ? " · Cloud" : ""}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radius.full,
                  backgroundColor: brand.accentSoft,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: brand.accent }}>
                  {isSw ? "Tumia" : "Apply"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={genericName}
        onChangeText={setGenericName}
        placeholder="Generic Name (e.g. Amoxicillin 500mg)"
        placeholderTextColor={colors.tertiaryLabel as string}
        style={inputStyle}
      />

      <TextInput
        value={barcodeInput}
        onChangeText={(text) => applyBarcodeOrGs1(text, false)}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={isSw ? "Msimbopau / GTIN / GS1 (hiari)" : "Barcode / GTIN / GS1 (optional)"}
        placeholderTextColor={colors.tertiaryLabel as string}
        style={inputStyle}
      />

      <Text style={[typography.caption, { marginTop: 4 }]}>
        {isSw ? "Chagua Kategoria au andika yako:" : "Select Category or type custom:"}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {categories.map((cat) => {
          const active = category === cat && !customCategory.trim();
          return (
            <Pressable
              key={cat}
              onPress={() => {
                setCategory(cat);
                setCustomCategory("");
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: radius.full,
                backgroundColor: active ? brand.accent : colors.secondaryGroupedBackground,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: active ? colors.onTint : colors.label,
                }}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <TextInput
        value={customCategory}
        onChangeText={setCustomCategory}
        placeholder="Custom Category (optional — saved to org list)"
        placeholderTextColor={colors.tertiaryLabel as string}
        style={inputStyle}
      />

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <TextInput
          value={batchNumber}
          onChangeText={setBatchNumber}
          placeholder="Batch / Lot #"
          placeholderTextColor={colors.tertiaryLabel as string}
          style={[inputStyle, { flex: 1 }]}
        />
        <TextInput
          value={expiryDate}
          onChangeText={setExpiryDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.tertiaryLabel as string}
          style={[inputStyle, { flex: 1 }]}
        />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          placeholder="Qty"
          keyboardType="number-pad"
          placeholderTextColor={colors.tertiaryLabel as string}
          style={[inputStyle, { flex: 1 }]}
        />
        <TextInput
          value={costPriceTzs}
          onChangeText={setCostPriceTzs}
          placeholder="Cost (TZS)"
          keyboardType="number-pad"
          placeholderTextColor={colors.tertiaryLabel as string}
          style={[inputStyle, { flex: 1 }]}
        />
        <TextInput
          value={salePriceTzs}
          onChangeText={setSalePriceTzs}
          placeholder="Sale (TZS)"
          keyboardType="number-pad"
          placeholderTextColor={colors.tertiaryLabel as string}
          style={[inputStyle, { flex: 1 }]}
        />
      </View>

      <Host matchContents seedColor={brand.accent}>
        <Switch
          value={requiresRx}
          onValueChange={setRequiresRx}
          label="Requires Prescription (Rx)"
        />
      </Host>

      {error && <Text style={{ color: brand.danger, fontSize: 13 }}>{error}</Text>}

      <PrimaryButton
        title={busy ? "Saving Batch..." : isSw ? "Hifadhi Mzigo" : "Save Stock Batch"}
        loading={busy}
        onPress={handleSave}
        style={{ marginTop: spacing.xs }}
      />
    </KeyboardAwareScrollView>
  );
}
