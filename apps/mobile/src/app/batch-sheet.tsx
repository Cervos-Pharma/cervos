import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Host, Switch } from "@expo/ui";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import { DEFAULT_DRUG_CATEGORIES } from "@/types/workspace";

export default function BatchSheetScreen() {
  const router = useRouter();
  const { workspace, scopedBatches, lang, refreshState } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";

  const [brandName, setBrandName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [category, setCategory] = useState<string>("Essential");
  const [customCategory, setCustomCategory] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("20");
  const [costPriceTzs, setCostPriceTzs] = useState("");
  const [salePriceTzs, setSalePriceTzs] = useState("");
  const [expiryDate, setExpiryDate] = useState("2027-06-30");
  const [requiresRx, setRequiresRx] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const merged = [...DEFAULT_DRUG_CATEGORIES, ...(workspace?.account?.customCategories ?? [])];
    return Array.from(new Set(merged));
  }, [workspace?.account?.customCategories]);

  // Autofill suggestion from existing branch stock when user types brand name
  const matchedExisting = useMemo(() => {
    const q = brandName.trim().toLowerCase();
    if (q.length < 2) return null;
    return (
      scopedBatches.find((b) => b.brandName.toLowerCase().includes(q)) ??
      (workspace?.batches ?? []).find((b) => b.brandName.toLowerCase().includes(q)) ??
      null
    );
  }, [brandName, scopedBatches, workspace?.batches]);

  const applyAutofill = () => {
    if (!matchedExisting) return;
    setBrandName(matchedExisting.brandName);
    setGenericName(matchedExisting.genericName);
    setCategory(matchedExisting.category);
    setCostPriceTzs(String(matchedExisting.costPriceTzs));
    setSalePriceTzs(String(matchedExisting.salePriceTzs));
    setRequiresRx(matchedExisting.requiresPrescription);
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
      const res = await postWorkspaceAction({
        action: "manage_batch",
        subAction: "add_batch",
        brandName: brandName.trim(),
        genericName: genericName.trim() || brandName.trim(),
        category: finalCat,
        batchNumber: batchNumber.trim(),
        quantity: Number(quantity) || 0,
        costPriceTzs: Number(costPriceTzs) || 0,
        salePriceTzs: Number(salePriceTzs) || 0,
        expiryDate: expiryDate.trim(),
        requiresPrescription: requiresRx,
      });
      if (!res.ok) {
        await playSoundCue("alert");
        setError(res.data?.error || "Could not add batch.");
        return;
      }
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      await refreshState();
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

      <TextInput
        value={brandName}
        onChangeText={setBrandName}
        placeholder="Brand Name (e.g. Amoxil, Coartem)"
        placeholderTextColor={colors.tertiaryLabel as string}
        style={inputStyle}
      />

      {matchedExisting && matchedExisting.brandName.toLowerCase() !== genericName.toLowerCase() && (
        <Pressable
          onPress={applyAutofill}
          style={{
            padding: 10,
            borderRadius: radius.md,
            backgroundColor: brand.accentSoft,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: brand.accent }}>
            Autofill from {matchedExisting.brandName} ({matchedExisting.category})
          </Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>Apply</Text>
        </Pressable>
      )}

      <TextInput
        value={genericName}
        onChangeText={setGenericName}
        placeholder="Generic Name (e.g. Amoxicillin 500mg)"
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
