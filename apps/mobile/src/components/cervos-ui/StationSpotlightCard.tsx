import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { formatTzs } from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { radius, spacing, useBrandColors } from "@/theme";
import type { WorkspaceCentre } from "@/types/workspace";
import { getOsmStationTileUrl } from "@/utils/intelligence";

const TANZANIA_REGIONS = [
  { id: "dar", label: "Dar es Salaam", lat: -6.816, lng: 39.2803, zoom: 13 },
  { id: "arusha", label: "Arusha", lat: -3.3869, lng: 36.683, zoom: 13 },
  { id: "mwanza", label: "Mwanza", lat: -2.5164, lng: 32.9175, zoom: 13 },
  { id: "dodoma", label: "Dodoma", lat: -6.163, lng: 35.7516, zoom: 13 },
  { id: "zanzibar", label: "Zanzibar", lat: -6.1659, lng: 39.2026, zoom: 13 },
] as const;

export function StationSpotlightCard({
  orgName,
  brandLogoUrl,
  centre,
  centres,
  profileName,
  todayRevenueTzs,
  validLotsCount,
  nearExpiryCount,
  escrowHeldTzs,
  isSw,
  accentHex,
  onSelectCentre,
}: {
  orgName: string;
  brandLogoUrl?: string;
  centre?: WorkspaceCentre;
  centres: WorkspaceCentre[];
  profileName?: string;
  todayRevenueTzs: number;
  validLotsCount: number;
  nearExpiryCount: number;
  escrowHeldTzs: number;
  isSw: boolean;
  accentHex?: string;
  onSelectCentre?: (centreId: string) => void;
}) {
  const brand = useBrandColors(accentHex);
  const [slide, setSlide] = useState<0 | 1 | 2>(0);
  const [paused, setPaused] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lng: number; zoom: number; label: string } | null>(
    null
  );

  useEffect(() => {
    if (paused || mapModalOpen) return;
    const t = setInterval(() => {
      setSlide((cur) => ((cur + 1) % 3) as 0 | 1 | 2);
    }, 4800);
    return () => clearInterval(t);
  }, [paused, mapModalOpen]);

  const mapTile = getOsmStationTileUrl(
    centre?.lat,
    centre?.lng,
    15,
    brand.isDark
  );

  const modalTile = getOsmStationTileUrl(
    focusCoords?.lat ?? centre?.lat,
    focusCoords?.lng ?? centre?.lng,
    focusCoords?.zoom ?? 14,
    brand.isDark
  );

  const firstName = (profileName || "").split(" ")[0] || orgName;
  const hour = new Date().getHours();
  const greeting = isSw
    ? hour < 12
      ? "Habari za asubuhi"
      : hour < 17
        ? "Habari za mchana"
        : "Habari za jioni"
    : hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";

  return (
    <>
      <View
        style={{
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: brand.cardBg,
          borderWidth: 1,
          borderColor: brand.borderColor,
          overflow: "hidden",
        }}
      >
        {/* Top Interactive Slide Area */}
        <Pressable
          onPress={() => {
            setPaused(true);
            setSlide((cur) => ((cur + 1) % 3) as 0 | 1 | 2);
          }}
          style={{
            height: 158,
            backgroundColor: slide === 1 ? brand.cardSubtleBg : brand.isDark ? "#0F1D3A" : "#1039B9",
            justifyContent: "space-between",
          }}
        >
          {slide === 0 && (
            <View style={{ flex: 1, padding: spacing.md, justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: radius.full,
                    backgroundColor: "rgba(255,255,255,0.14)",
                  }}
                >
                  {brandLogoUrl ? (
                    <Image
                      source={{ uri: brandLogoUrl }}
                      style={{ width: 20, height: 20, borderRadius: 6 }}
                      contentFit="cover"
                    />
                  ) : (
                    <PlatformIcon sf="cross.case.fill" md="local-pharmacy" color="#E2F575" size={14} />
                  )}
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>
                    {orgName}
                  </Text>
                </View>

                <View
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: radius.full,
                    backgroundColor: "#E2F575",
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#111317" }}>
                    {isSw ? "KITUO HAI" : "STATION LIVE"}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.78)" }}>
                  {greeting.toUpperCase()}, {firstName.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#FFFFFF" }} numberOfLines={1}>
                  {centre?.name || "Main Branch"}
                </Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.82)" }} numberOfLines={1}>
                  {centre?.address ? `${centre.address} · ` : ""}
                  {centre?.region || "Tanzania"}
                </Text>
              </View>
            </View>
          )}

          {slide === 1 && (
            <View style={{ flex: 1 }}>
              <Image
                source={{
                  uri: mapTile.url,
                  headers: { "User-Agent": "CervosPharmaMobile/1.0 (https://cervos.online)" },
                }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
              <View
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: brand.isDark ? "rgba(9,12,18,0.34)" : "rgba(15,23,42,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: brand.accent,
                    borderWidth: 3,
                    borderColor: "#FFFFFF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PlatformIcon sf="mappin.and.ellipse" md="location-on" color="#FFFFFF" size={16} />
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setFocusCoords({
                    lat: mapTile.lat,
                    lng: mapTile.lng,
                    zoom: 14,
                    label: centre?.name || orgName,
                  });
                  setMapModalOpen(true);
                }}
                style={{
                  position: "absolute",
                  right: 10,
                  bottom: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radius.full,
                  backgroundColor: brand.cardBg,
                  borderWidth: 1,
                  borderColor: brand.borderColor,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <PlatformIcon sf="map.fill" md="map" color={brand.accent} size={13} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: brand.accent }}>
                  {isSw ? "Fungua Ramani" : "Interactive Map"}
                </Text>
              </Pressable>
            </View>
          )}

          {slide === 2 && (
            <View
              style={{
                flex: 1,
                padding: spacing.md,
                backgroundColor: brand.isDark ? "#0B292E" : "#006875",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.1, color: "rgba(255,255,255,0.8)" }}>
                {isSw ? "HISA & MTIRIRIKO WA SASA" : "STATION TELEMETRY SNAPSHOT"}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <View style={{ flexBasis: "46%", flexGrow: 1 }}>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
                    {isSw ? "Mauzo Leo" : "Today Revenue"}
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#FFFFFF" }}>
                    {formatTzs(todayRevenueTzs, { compact: true })}
                  </Text>
                </View>
                <View style={{ flexBasis: "46%", flexGrow: 1 }}>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
                    {isSw ? "Makundi Hai" : "Valid Lots"}
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#FFFFFF" }}>
                    {validLotsCount}
                  </Text>
                </View>
                <View style={{ flexBasis: "46%", flexGrow: 1 }}>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
                    {isSw ? "Inakaribia Kuisha" : "Expiring <=30d"}
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: nearExpiryCount > 0 ? "#E2F575" : "#FFFFFF" }}>
                    {nearExpiryCount}
                  </Text>
                </View>
                <View style={{ flexBasis: "46%", flexGrow: 1 }}>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
                    {isSw ? "Kasri Escrow" : "Escrow Held"}
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#FFFFFF" }}>
                    {formatTzs(escrowHeldTzs, { compact: true })}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Pressable>

        {/* Bottom Spotlight Bar + Slide Dots + Map Action */}
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: 11,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: brand.textPrimary }} numberOfLines={1}>
              {centre?.name || "Main Branch"} · {centre?.region || "Tanzania"}
            </Text>
            <Text style={{ fontSize: 11, color: brand.textMuted }} numberOfLines={1}>
              {mapTile.lat.toFixed(4)}, {mapTile.lng.toFixed(4)}
              {centre?.phone ? ` · ${centre.phone}` : ""}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {([0, 1, 2] as const).map((idx) => (
              <Pressable
                key={idx}
                hitSlop={6}
                onPress={() => {
                  setPaused(true);
                  setSlide(idx);
                }}
                style={{
                  width: slide === idx ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: slide === idx ? brand.accent : brand.borderColor,
                }}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Interactive Network & Region Map Modal */}
      <Modal
        visible={mapModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMapModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: brand.canvasBg, padding: spacing.md, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: brand.accent, letterSpacing: 1 }}>
                TANZANIA PHARMACY NETWORK MAP
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: brand.textPrimary }}>
                {focusCoords?.label || centre?.name || orgName}
              </Text>
            </View>
            <Pressable
              onPress={() => setMapModalOpen(false)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: radius.full,
                backgroundColor: brand.cardSubtleBg,
                borderWidth: 1,
                borderColor: brand.borderColor,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: brand.textPrimary }}>Done</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 38 }} contentContainerStyle={{ gap: 6 }}>
            {TANZANIA_REGIONS.map((reg) => (
              <Pressable
                key={reg.id}
                onPress={() =>
                  setFocusCoords({ lat: reg.lat, lng: reg.lng, zoom: reg.zoom, label: reg.label })
                }
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: radius.full,
                  backgroundColor: focusCoords?.label === reg.label ? brand.accent : brand.cardBg,
                  borderWidth: 1,
                  borderColor: focusCoords?.label === reg.label ? brand.accent : brand.borderColor,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: focusCoords?.label === reg.label ? "#FFFFFF" : brand.textPrimary,
                  }}
                >
                  {reg.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View
            style={{
              height: 280,
              borderRadius: radius.xl,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: brand.borderColor,
              backgroundColor: brand.cardSubtleBg,
            }}
          >
            <Image
              source={{
                uri: modalTile.url,
                headers: { "User-Agent": "CervosPharmaMobile/1.0 (https://cervos.online)" },
              }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
            <View
              style={{
                position: "absolute",
                inset: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: brand.accent,
                  borderWidth: 3,
                  borderColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlatformIcon sf="cross.case.fill" md="local-pharmacy" color="#FFFFFF" size={16} />
              </View>
            </View>
          </View>

          <Text style={{ fontSize: 11, fontWeight: "700", color: brand.textMuted, letterSpacing: 0.8 }}>
            REGISTERED BRANCH LOCATIONS ({centres.length})
          </Text>

          <ScrollView contentContainerStyle={{ gap: spacing.xs }}>
            {centres.map((br) => {
              const active = br.id === centre?.id;
              return (
                <Pressable
                  key={br.id}
                  onPress={() => {
                    setFocusCoords({
                      lat: br.lat ?? -6.816,
                      lng: br.lng ?? 39.2803,
                      zoom: 15,
                      label: br.name,
                    });
                    onSelectCentre?.(br.id);
                  }}
                  style={{
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: brand.cardBg,
                    borderWidth: 1,
                    borderColor: active ? brand.accent : brand.borderColor,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: brand.textPrimary }}>
                      {br.name} {br.isPrimary ? "· Primary" : ""}
                    </Text>
                    <Text style={{ fontSize: 12, color: brand.textMuted }}>
                      {br.region} · {br.address}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: active ? brand.accent : brand.teal }}>
                    {active ? "Active" : "Locate"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <PrimaryButton title="Close Map" variant="outline" onPress={() => setMapModalOpen(false)} />
        </View>
      </Modal>
    </>
  );
}
