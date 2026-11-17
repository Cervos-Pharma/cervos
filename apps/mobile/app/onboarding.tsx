import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useMobileSession } from "../src/context/MobileSessionContext";
import { CERVOS_COLORS, MOBILE_COPY, TOUCH_MIN_HEIGHT } from "../src/theme/tokens";

const TUTORIAL_SLIDES = {
  EN: [
    { title: "1. Fast Counter & Offline POS", body: "Tap medicines or scan GS1 barcodes to ring sales even without internet. Syncs automatically when signal returns." },
    { title: "2. Camera QR & Batch Scanner", body: "Use your Android camera on medicine boxes to verify expiry dates and push stock straight to counter or GRN." },
    { title: "3. Permits, Shifts & Daily Summary", body: "Inspect operating licenses, clock in shifts with PIN protection, and receive 18:00 SMS branch digests via Nama." },
    { title: "4. Owner Multi-Branch Control", body: "Owners review all pharmacies in 2x2 KPI cubes, approve staff requests in Welcome Lounge, and inspect receipts." },
  ],
  SW: [
    { title: "1. Kaunta ya Kasi & POS Nje ya Mtandao", body: "Bonyeza dawa au skani GS1 kuuza hata mtandao ukikatika. Husawazisha pindi mtandao ukirudi." },
    { title: "2. Skana ya Kamera (QR / Barcode)", body: "Tumia kamera ya simu kukagua tarehe za kuisha muda na kuingiza mzigo mpya moja kwa moja." },
    { title: "3. Leseni, Zamu & Muhtasari wa Siku", body: "Kagua vibali, ingia zamu kwa PIN salama, na pokea muhtasari wa saa 12 jioni kwa SMS kupitia Nama." },
    { title: "4. Udhibiti wa Matawi Mengi", body: "Wamiliki huona takwimu za matawi yote kwa haraka, kukubali wahudumu na kukagua risiti." },
  ],
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { lang, setLang, isDark } = useMobileSession();
  const [slideIdx, setSlideIdx] = useState(0);
  const copy = MOBILE_COPY[lang];
  const slides = TUTORIAL_SLIDES[lang];

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.container}>
      <View style={styles.topRow}>
        <Text style={[styles.brand, { color: CERVOS_COLORS.cobalt }]}>CERVOS PHARMA</Text>
        <View style={styles.langSwitch}>
          {(["EN", "SW"] as const).map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => setLang(l)}
              style={[
                styles.langBtn,
                {
                  borderColor: lang === l ? CERVOS_COLORS.cobalt : border,
                  backgroundColor: lang === l ? CERVOS_COLORS.cobalt : card,
                },
              ]}
            >
              <Text style={{ color: lang === l ? "#FFFFFF" : text, fontWeight: "700", fontSize: 12 }}>
                {l === "EN" ? "English" : "Kiswahili"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: text }]}>{copy.welcomeTitle}</Text>
        <Text style={[styles.heroSub, { color: muted }]}>{copy.welcomeSub}</Text>
      </View>

      <View style={[styles.tutorialCard, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.sectionTag, { color: CERVOS_COLORS.cobalt }]}>{copy.tutorialTitle}</Text>
        <Text style={[styles.slideTitle, { color: text }]}>{slides[slideIdx].title}</Text>
        <Text style={[styles.slideBody, { color: muted }]}>{slides[slideIdx].body}</Text>
        <View style={styles.dotsRow}>
          {slides.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => setSlideIdx(idx)}
              style={[
                styles.dot,
                {
                  width: slideIdx === idx ? 26 : 10,
                  backgroundColor: slideIdx === idx ? CERVOS_COLORS.cobalt : border,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/auth", params: { mode: "signin" } })}
          style={[styles.primaryBtn, { backgroundColor: CERVOS_COLORS.cobalt }]}
        >
          <Text style={styles.primaryBtnText}>{copy.signIn} (@username)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/auth", params: { mode: "signup" } })}
          style={[styles.secondaryBtn, { backgroundColor: card, borderColor: border }]}
        >
          <Text style={[styles.secondaryBtnText, { color: text }]}>{copy.getStarted}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 36, justifyContent: "space-between", gap: 24 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 13, fontWeight: "800", letterSpacing: 1.5 },
  langSwitch: { flexDirection: "row", gap: 8 },
  langBtn: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, justifyContent: "center" },
  hero: { gap: 10 },
  heroTitle: { fontSize: 30, fontWeight: "700", lineHeight: 36 },
  heroSub: { fontSize: 15, lineHeight: 22 },
  tutorialCard: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 10 },
  sectionTag: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  slideTitle: { fontSize: 17, fontWeight: "700" },
  slideBody: { fontSize: 14, lineHeight: 20 },
  dotsRow: { flexDirection: "row", gap: 8, paddingTop: 8 },
  dot: { height: 8, borderRadius: 999 },
  actions: { gap: 12 },
  primaryBtn: { minHeight: TOUCH_MIN_HEIGHT + 4, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { minHeight: TOUCH_MIN_HEIGHT + 4, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  secondaryBtnText: { fontSize: 15, fontWeight: "700" },
});
