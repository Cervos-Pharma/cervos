import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { buildReceiptQrPayload, formatTzs } from "@cervos/core";
import { PrimaryButton } from "@/components/primary-button";
import { QrMatrixView } from "@/components/qr-matrix-view";
import { EmptyStateCard } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { printReceiptNative, shareReceiptPdf } from "@/services/receipts";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

export default function ReceiptSheetScreen() {
  const { saleId } = useLocalSearchParams<{ saleId?: string }>();
  const { workspace, activeCentre, scopedSales, prefs, lang } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";

  const sale =
    scopedSales.find((s) => s.id === saleId) ??
    workspace?.sales?.find((s) => s.id === saleId) ??
    scopedSales[0];

  if (!sale) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.groupedBackground, padding: spacing.md }}>
        <EmptyStateCard
          sf="doc.text"
          md="receipt-long"
          title="Receipt Not Found"
          description="This receipt is not available in the current branch scope."
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}
    >
      <View style={{ gap: 2 }}>
        <Text style={[typography.overline, { color: brand.accent }]}>
          OFFICIAL STATION RECEIPT
        </Text>
        <Text style={typography.title}>
          {sale.receiptNumber || `RCP-${sale.id.slice(-6).toUpperCase()}`}
        </Text>
        <Text style={typography.subhead}>
          {sale.customerName || (isSw ? "Mteja wa Kaunta" : "Walk-in Patient")} ·{" "}
          {sale.paymentMethod.toUpperCase()} · {sale.createdAt.slice(0, 16).replace("T", " ")}
        </Text>
      </View>

      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.secondaryGroupedBackground,
          gap: spacing.sm,
        }}
      >
        {(sale.lines ?? []).map((ln, idx) => (
          <View
            key={`${ln.productId}-${idx}`}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingBottom: spacing.xs,
              borderBottomWidth: idx < (sale.lines?.length ?? 0) - 1 ? 1 : 0,
              borderBottomColor: colors.separator,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={typography.headline}>{ln.brandName}</Text>
              <Text style={typography.caption}>
                Batch {ln.batchNumber || "Auto"} · {ln.qty} x {formatTzs(ln.unitPriceTzs)}
              </Text>
            </View>
            <Text style={{ fontWeight: "700", color: colors.label }}>
              {formatTzs(ln.qty * ln.unitPriceTzs)}
            </Text>
          </View>
        ))}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingTop: spacing.xs,
          }}
        >
          <Text style={typography.headline}>Total Paid ({sale.itemCount} packs)</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: brand.accent }}>
            {formatTzs(sale.totalTzs)}
          </Text>
        </View>
        <Text style={typography.caption}>
          Cashier: {sale.actorName}
          {sale.prescriptionRef ? ` · Rx Ref: ${sale.prescriptionRef}` : ""}
        </Text>
      </View>

      {(() => {
        const receiptNo = sale.receiptNumber || `RCP-${sale.id.slice(-6).toUpperCase()}`;
        const qrPayload = buildReceiptQrPayload(receiptNo, sale.id);
        return (
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: colors.secondaryGroupedBackground,
              borderWidth: 1,
              borderColor: brand.staticBorder,
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Text style={[typography.overline, { color: brand.accent }]}>
              {isSw ? "MSIMBO WA UTHIBITISHO WA RISITI" : "RECEIPT VERIFICATION QR"}
            </Text>
            <QrMatrixView value={qrPayload} moduleSize={4} />
            <Text
              selectable
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: colors.secondaryLabel,
                textAlign: "center",
              }}
            >
              {qrPayload}
            </Text>
          </View>
        );
      })()}

      <View style={{ gap: spacing.sm }}>
        <PrimaryButton
          title={isSw ? `Chapisha (${prefs.paperWidthMm}mm)` : `Print Receipt (${prefs.paperWidthMm}mm)`}
          onPress={() =>
            void printReceiptNative({
              orgName: workspace?.account?.orgName || "Pharmacy",
              branchName: activeCentre?.name || "Main",
              sale,
              paperWidthMm: prefs.paperWidthMm,
            })
          }
        />
        <PrimaryButton
          title={isSw ? "Tuma PDF" : "Share Receipt PDF"}
          variant="outline"
          onPress={() =>
            void shareReceiptPdf({
              orgName: workspace?.account?.orgName || "Pharmacy",
              branchName: activeCentre?.name || "Main",
              sale,
              paperWidthMm: prefs.paperWidthMm,
            })
          }
        />
      </View>
    </ScrollView>
  );
}
