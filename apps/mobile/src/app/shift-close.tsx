import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { formatTzs, reconcileCashShift } from "@cervos/core";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import { todayIsoDay } from "@/utils/intelligence";

const EXPENSE_CATEGORIES = [
  "Rent & Premises",
  "Utilities & Cold Chain",
  "Staff & Shift",
  "Compliance & Permits",
  "Packaging & Supplies",
] as const;

export default function ShiftCloseScreen() {
  const {
    workspace,
    activeCentre,
    activeShift,
    scopedSales,
    scopedExpenses,
    scopedShifts,
    capabilities,
    lang,
    runOnlineOrQueue,
  } = useMobileSession();

  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const todayIso = todayIsoDay();

  const [tab, setTab] = useState<"reconcile" | "expenses">("reconcile");
  const [openingCash, setOpeningCash] = useState("50000");
  const [cashRefunds, setCashRefunds] = useState("0");
  const [declaredCash, setDeclaredCash] = useState("");
  const [reconcileBusy, setReconcileBusy] = useState(false);

  const [expCategory, setExpCategory] = useState<string>(EXPENSE_CATEGORIES[4]);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expBusy, setExpBusy] = useState(false);

  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const { cashSalesTzs, mobileMoneySalesTzs } = useMemo(() => {
    let cash = 0;
    let mobile = 0;
    for (const s of scopedSales) {
      if (s.createdAt.slice(0, 10) !== todayIso) continue;
      if (s.paymentMethod === "cash") cash += s.totalTzs;
      else if (s.paymentMethod === "mpesa" || s.paymentMethod === "tigo") mobile += s.totalTzs;
    }
    return { cashSalesTzs: cash, mobileMoneySalesTzs: mobile };
  }, [scopedSales, todayIso]);

  const preview = useMemo(
    () =>
      reconcileCashShift({
        openingCashTzs: Number(openingCash) || 0,
        cashSalesTzs,
        cashRefundsTzs: Number(cashRefunds) || 0,
        mobileMoneySalesTzs,
        declaredCashTzs: Number(declaredCash) || 0,
      }),
    [openingCash, cashSalesTzs, cashRefunds, mobileMoneySalesTzs, declaredCash]
  );

  const submitShiftReconcile = async () => {
    if (reconcileBusy) return;
    setReconcileBusy(true);
    setNotice(null);
    try {
      const payload = {
        openingCashTzs: Number(openingCash) || 0,
        cashSalesTzs,
        cashRefundsTzs: Number(cashRefunds) || 0,
        mobileMoneySalesTzs,
        declaredCashTzs: Number(declaredCash) || 0,
        centreId: activeCentre?.id,
      };
      const out = await runOnlineOrQueue(
        { action: "reconcile_shift", ...payload },
        { type: "shift_reconcile", payload }
      );
      if (!out.ok) {
        await playSoundCue("alert");
        setNotice({ ok: false, text: out.error || "Could not reconcile cash shift." });
        return;
      }
      if (!out.queued && activeShift) {
        await runOnlineOrQueue({ action: "shift_clock", clockType: "out" });
      }
      await playSoundCue("shift-clock");
      await triggerHaptic("success");
      setNotice({
        ok: true,
        text: out.queued
          ? isSw
            ? "Hesabu ya zamu imehifadhiwa nje ya mtandao."
            : `Blind shift close saved offline (${preview.status.toUpperCase()}). Queued for sync.`
          : `Shift reconciled (${preview.status.toUpperCase()}): Variance ${formatTzs(preview.varianceTzs)}.`,
      });
    } finally {
      setReconcileBusy(false);
    }
  };

  const submitExpense = async () => {
    const amount = Math.max(0, Math.round(Number(expAmount) || 0));
    if (expDesc.trim().length < 2 || amount <= 0 || expBusy) {
      setNotice({
        ok: false,
        text: isSw ? "Weka maelezo na kiasi halali cha matumizi." : "Enter expense description and positive TZS amount.",
      });
      return;
    }
    setExpBusy(true);
    setNotice(null);
    try {
      const payload = {
        category: expCategory,
        description: expDesc.trim(),
        amountTzs: amount,
        centreId: activeCentre?.id,
      };
      const out = await runOnlineOrQueue(
        { action: "log_expense", ...payload },
        { type: "log_expense", payload }
      );
      if (!out.ok) {
        await playSoundCue("alert");
        setNotice({ ok: false, text: out.error || "Failed to log expense." });
        return;
      }
      setExpDesc("");
      setExpAmount("");
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setNotice({
        ok: true,
        text: out.queued
          ? isSw ? "Matumizi yamehifadhiwa nje ya mtandao." : "Expense queued offline into P&L."
          : isSw ? "Matumizi yamehifadhiwa kwenye P&L." : "Operating expense logged into 30-day P&L.",
      });
    } finally {
      setExpBusy(false);
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
      {/* Segment Switcher */}
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
            { id: "reconcile", label: isSw ? "Funga Zamu (Cash)" : "Blind Shift Close" },
            { id: "expenses", label: isSw ? `Matumizi (${scopedExpenses.length})` : `Expenses (${scopedExpenses.length})` },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                setTab(item.id);
                setNotice(null);
              }}
              style={{
                flex: 1,
                minHeight: 38,
                borderRadius: radius.full,
                backgroundColor: active ? brand.accent : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: active ? colors.onTint : colors.secondaryLabel }}>
                {item.label}
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

      {tab === "reconcile" ? (
        <>
          <View style={cardStyle}>
            <Text style={[typography.overline, { color: brand.accent }]}>
              {isSw ? "HESABU YA DROO YA LEO" : "TODAY'S DRAWER RECONCILIATION"}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={typography.subhead}>{isSw ? "Mauzo ya Cash (Leo)" : "Cash Sales Today"}</Text>
              <Text style={{ fontWeight: "700", color: colors.label }}>{formatTzs(cashSalesTzs)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={typography.subhead}>{isSw ? "Malipo ya Simu (M-Pesa/Mixx)" : "Mobile Money Today"}</Text>
              <Text style={{ fontWeight: "700", color: brand.accent }}>{formatTzs(mobileMoneySalesTzs)}</Text>
            </View>

            <Text style={typography.caption}>{isSw ? "Fedha za Kuanzia Zamu (Opening Cash)" : "Opening Float (TZS)"}</Text>
            <TextInput value={openingCash} onChangeText={setOpeningCash} keyboardType="number-pad" style={inputStyle} />

            <Text style={typography.caption}>{isSw ? "Marejesho ya Cash (Refunds)" : "Cash Refunds (TZS)"}</Text>
            <TextInput value={cashRefunds} onChangeText={setCashRefunds} keyboardType="number-pad" style={inputStyle} />

            <Text style={typography.caption}>{isSw ? "Cash Iliyohesabiwa Drooni (Declared)" : "Counted Cash in Drawer (TZS)"}</Text>
            <TextInput
              value={declaredCash}
              onChangeText={setDeclaredCash}
              keyboardType="number-pad"
              placeholder={String(preview.expectedCashTzs)}
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputStyle}
            />

            <View
              style={{
                padding: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: colors.tertiaryBackground,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={typography.caption}>{isSw ? "Cash Inayotarajiwa" : "Expected Cash"}</Text>
                <Text style={{ fontWeight: "700", color: colors.label }}>{formatTzs(preview.expectedCashTzs)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={typography.caption}>{isSw ? "Tofauti (Variance)" : "Drawer Variance"}</Text>
                <Text
                  style={{
                    fontWeight: "700",
                    color:
                      preview.status === "balanced"
                        ? brand.success
                        : preview.status === "shortage"
                          ? brand.danger
                          : brand.warning,
                  }}
                >
                  {preview.varianceTzs >= 0 ? "+" : ""}
                  {formatTzs(preview.varianceTzs)} ({preview.status.toUpperCase()})
                </Text>
              </View>
            </View>

            <PrimaryButton
              title={reconcileBusy ? "..." : isSw ? "Thibitisha & Funga Zamu" : "Reconcile & Close Shift"}
              loading={reconcileBusy}
              onPress={() => void submitShiftReconcile()}
            />
          </View>

          <View style={cardStyle}>
            <Text style={typography.overline}>{isSw ? "KUMBUKUMBU ZA ZAMU" : "RECENT SHIFT LOGS"}</Text>
            {scopedShifts.slice(0, 6).map((sh) => (
              <View
                key={sh.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 6,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.separator,
                }}
              >
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.label }}>{sh.staffName}</Text>
                  <Text style={typography.caption}>
                    In {sh.clockInAt.slice(0, 16).replace("T", " ")}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: sh.clockOutAt ? brand.success : brand.accent }}>
                  {sh.clockOutAt ? `${sh.durationMinutes ?? 1} min` : "ACTIVE"}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          {capabilities.canViewFinance ? (
            <View style={cardStyle}>
              <Text style={[typography.overline, { color: brand.accent }]}>
                {isSw ? "ANDIKA MATUMIZI YA TAWI" : "LOG OPERATING EXPENSE"}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {EXPENSE_CATEGORIES.map((cat) => {
                  const active = expCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setExpCategory(cat)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: radius.full,
                        backgroundColor: active ? brand.accent : colors.tertiaryBackground,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? colors.onTint : colors.label }}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={expDesc}
                onChangeText={setExpDesc}
                placeholder={isSw ? "Maelezo (mf. Luku / Friji ya chanjo)" : "Description (e.g. Luku electricity top-up)"}
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />
              <TextInput
                value={expAmount}
                onChangeText={setExpAmount}
                keyboardType="number-pad"
                placeholder={isSw ? "Kiasi (TZS)" : "Amount (TZS)"}
                placeholderTextColor={colors.tertiaryLabel as string}
                style={inputStyle}
              />
              <PrimaryButton
                title={expBusy ? "..." : isSw ? "Hifadhi Matumizi" : "Record Expense"}
                loading={expBusy}
                onPress={() => void submitExpense()}
              />
            </View>
          ) : (
            <View style={cardStyle}>
              <Text style={typography.subhead}>
                {isSw ? "Ruhusa ya fedha inahitajika kurekodi matumizi." : "Finance permission required to record operating expenses."}
              </Text>
            </View>
          )}

          <View style={cardStyle}>
            <Text style={typography.overline}>{isSw ? "MATUMIZI YALIYOREKODIWA" : "EXPENSES LEDGER (30D)"}</Text>
            {scopedExpenses.length === 0 ? (
              <Text style={typography.caption}>
                {isSw ? "Hakuna matumizi bado kwa tawi hili." : "No operating expenses recorded yet."}
              </Text>
            ) : (
              scopedExpenses.slice(0, 12).map((e) => (
                <View
                  key={e.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: spacing.sm }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.label }}>{e.description}</Text>
                    <Text style={typography.caption}>
                      {e.category} · {e.createdAt.slice(0, 10)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: brand.danger }}>
                    -{formatTzs(e.amountTzs)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </KeyboardAwareScrollView>
  );
}
