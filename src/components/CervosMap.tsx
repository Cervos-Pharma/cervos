"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";

export type MapStyleId = "light" | "dark" | "street";

export interface MarkerData {
  id?: string;
  lat: number;
  lng: number;
  label: string;
  status?:
    | "online"
    | "offline"
    | "grace"
    | "active"
    | "trial"
    | "locked"
    | "healthy"
    | "at_risk";
  kind?: "branch" | "supplier" | "hq";
  detail?: string | null;
  accountName?: string;
  lastSync?: string;
  revenue?: number;
  region?: string;
}

export interface MapRoute {
  id?: string;
  from: [number, number];
  to: [number, number];
  label?: string;
  status?: "active" | "pending" | "delivered";
}

interface CervosMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MarkerData[];
  routes?: MapRoute[];
  className?: string;
  onMarkerClick?: (marker: MarkerData) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  selectedId?: string | null;
  defaultStyle?: MapStyleId;
  showControls?: boolean;
  enableRegionJump?: boolean;
  fitBoundsOnUpdate?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  online: "#1039b9",
  active: "#146c2e",
  healthy: "#146c2e",
  trial: "#2563eb",
  grace: "#d97706",
  at_risk: "#d97706",
  offline: "#ba1a1a",
  locked: "#ba1a1a",
};

const ROUTE_COLORS: Record<string, string> = {
  active: "#1039b9",
  pending: "#d97706",
  delivered: "#146c2e",
};

const TILE_LAYERS: Record<
  MapStyleId,
  { label: string; url: string; attribution: string; maxZoom: number; bg: string; className?: string }
> = {
  street: {
    label: "Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 20,
    bg: "#e9ecef",
  },
  light: {
    label: "Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 20,
    bg: "#eef2f9",
  },
  dark: {
    label: "Dark Matter",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 20,
    bg: "#0e1320",
  },
};

const TANZANIA_REGIONS: Array<{
  id: string;
  label: string;
  center: [number, number];
  zoom: number;
}> = [
  { id: "all", label: "All TZ", center: [-6.369, 34.8888], zoom: 6 },
  { id: "dar", label: "Dar es Salaam", center: [-6.816, 39.2803], zoom: 12 },
  { id: "arusha", label: "Arusha", center: [-3.3869, 36.683], zoom: 12 },
  { id: "mwanza", label: "Mwanza", center: [-2.5164, 32.9175], zoom: 12 },
  { id: "dodoma", label: "Dodoma", center: [-6.163, 35.7516], zoom: 12 },
  { id: "zanzibar", label: "Zanzibar", center: [-6.1659, 39.2026], zoom: 12 },
];

// Geographic bounding box for built-in offline Tanzania vector fallback
const TZ_BOUNDS = {
  minLat: -11.9,
  maxLat: -0.9,
  minLng: 29.2,
  maxLng: 40.6,
};

function projectToSvg(lat: number, lng: number): { x: number; y: number } {
  const x =
    ((lng - TZ_BOUNDS.minLng) / (TZ_BOUNDS.maxLng - TZ_BOUNDS.minLng)) * 420 + 40;
  const y =
    ((TZ_BOUNDS.maxLat - lat) / (TZ_BOUNDS.maxLat - TZ_BOUNDS.minLat)) * 340 + 30;
  return {
    x: Math.max(24, Math.min(476, x)),
    y: Math.max(24, Math.min(376, y)),
  };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createMarkerIcon(
  L: typeof import("leaflet"),
  m: MarkerData,
  isSelected: boolean
) {
  const color =
    m.kind === "supplier"
      ? "#0d9488"
      : m.kind === "hq"
      ? "#1a1a2e"
      : STATUS_COLORS[m.status ?? "online"] ?? STATUS_COLORS.online;

  const size = isSelected ? 26 : m.kind === "hq" ? 22 : 18;
  const isPulse =
    m.status === "online" || m.status === "active" || m.status === "healthy";

  const glyph =
    m.kind === "supplier"
      ? `<path d="M4 9.5V5.5L8 3.5L12 5.5V9.5L8 11.5L4 9.5Z" stroke="white" stroke-width="1.4" fill="none"/>`
      : m.kind === "hq"
      ? `<circle cx="8" cy="8" r="2.5" fill="white"/>`
      : `<circle cx="8" cy="8" r="2.2" fill="white"/>`;

  return L.divIcon({
    className: "cervos-map-pin",
    html: `<div style="
      position:relative;
      width:${size}px;
      height:${size}px;
      display:flex;
      align-items:center;
      justify-content:center;
      border-radius:9999px;
      background:${color};
      border:2.5px solid ${isSelected ? "#ffffff" : "rgba(255,255,255,0.9)"};
      box-shadow:${
        isSelected
          ? "0 0 0 4px rgba(16,57,185,0.3), 0 6px 14px rgba(0,0,0,0.35)"
          : "0 2px 8px rgba(0,0,0,0.3)"
      };
      cursor:pointer;
      transition:transform 150ms ease;
    ">
      ${
        isPulse
          ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid ${color};opacity:0.45;animation:cervos-pulse-ring 2.2s ease-out infinite;"></span>`
          : ""
      }
      <svg width="${Math.round(size * 0.65)}" height="${Math.round(size * 0.65)}" viewBox="0 0 16 16" aria-hidden="true">
        ${glyph}
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -Math.round(size * 0.6)],
  });
}

function createPopupContent(m: MarkerData, dark: boolean): string {
  const color =
    m.kind === "supplier"
      ? "#0d9488"
      : STATUS_COLORS[m.status ?? "online"] ?? STATUS_COLORS.online;
  const fg = dark ? "#f8fafc" : "#111827";
  const muted = dark ? "#cbd5e1" : "#4b5563";
  const subtle = dark ? "#94a3b8" : "#6b7280";
  const kindLabel =
    m.kind === "supplier" ? "Supplier Hub" : m.kind === "hq" ? "HQ Node" : "Pharmacy Branch";

  return [
    `<div style="min-width:185px;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.4">`,
    `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${color};margin-bottom:2px">${kindLabel}</div>`,
    `<div style="font-weight:700;font-size:14px;color:${fg};margin-bottom:2px">${escapeHtml(m.label)}</div>`,
    m.accountName
      ? `<div style="font-size:12px;color:${muted};margin-bottom:4px">${escapeHtml(m.accountName)}</div>`
      : "",
    m.region
      ? `<div style="font-size:11px;color:${subtle};margin-bottom:2px">${escapeHtml(m.region)}</div>`
      : "",
    typeof m.revenue === "number"
      ? `<div style="font-size:12px;font-weight:600;color:${fg};margin-top:4px">TZS ${Math.round(m.revenue).toLocaleString()}</div>`
      : "",
    m.detail
      ? `<div style="font-size:11px;color:${muted};margin-top:3px">${escapeHtml(m.detail)}</div>`
      : "",
    m.lastSync
      ? `<div style="font-size:11px;color:${subtle};margin-top:4px">Sync: ${escapeHtml(m.lastSync)}</div>`
      : "",
    `<div style="margin-top:6px;display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;background:${color}1f;color:${color}">${escapeHtml(
      (m.status ?? "online").replaceAll("_", " ")
    )}</div>`,
    `</div>`,
  ].join("");
}

export default function CervosMap({
  center = [-6.816, 39.2803],
  zoom = 11,
  markers = [],
  routes = [],
  className = "h-full w-full",
  onMarkerClick,
  onMapClick,
  selectedId,
  defaultStyle = "street",
  showControls = true,
  enableRegionJump = false,
  fitBoundsOnUpdate = true,
}: CervosMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const routesLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [tileStyle, setTileStyle] = useState<MapStyleId>(defaultStyle);
  const [activeRegion, setActiveRegion] = useState<string>("all");
  const [tileErrors, setTileErrors] = useState(0);
  const [locating, setLocating] = useState(false);

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  const centerLat = center[0];
  const centerLng = center[1];
  const prevViewRef = useRef<{ lat: number; lng: number; zoom: number }>({
    lat: centerLat,
    lng: centerLng,
    zoom,
  });

  const validMarkers = useMemo(
    () =>
      markers.filter(
        (m) =>
          typeof m.lat === "number" &&
          typeof m.lng === "number" &&
          Number.isFinite(m.lat) &&
          Number.isFinite(m.lng)
      ),
    [markers]
  );

  const validRoutes = useMemo(
    () =>
      routes.filter(
        (r) =>
          Number.isFinite(r.from?.[0]) &&
          Number.isFinite(r.from?.[1]) &&
          Number.isFinite(r.to?.[0]) &&
          Number.isFinite(r.to?.[1])
      ),
    [routes]
  );

  const markersKey = useMemo(
    () =>
      validMarkers
        .map((m) => `${m.id ?? ""}:${m.lat},${m.lng},${m.status ?? ""},${m.kind ?? ""},${m.label}`)
        .join("|"),
    [validMarkers]
  );

  const routesKey = useMemo(
    () =>
      validRoutes
        .map((r) => `${r.id ?? ""}:${r.from.join(",")}->${r.to.join(",")}:${r.status ?? ""}`)
        .join("|"),
    [validRoutes]
  );

  const applyTileLayer = useCallback(
    (L: typeof import("leaflet"), map: import("leaflet").Map, style: MapStyleId) => {
      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }
      setTileErrors(0);
      const spec = TILE_LAYERS[style];
      const layer = L.tileLayer(spec.url, {
        attribution: spec.attribution,
        maxZoom: spec.maxZoom,
        ...(spec.className ? { className: spec.className } : {}),
      });
      layer.on("tileerror", () => {
        setTileErrors((c) => Math.min(c + 1, 20));
      });
      layer.addTo(map);
      tileLayerRef.current = layer;
    },
    []
  );

  // 1) Mount Leaflet map once + attach ResizeObserver
  useEffect(() => {
    const el = mapRef.current;
    if (!el || mapInstanceRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    import("leaflet").then((LModule) => {
      const L = LModule.default ?? LModule;
      if (cancelled || !el || mapInstanceRef.current) return;

      leafletRef.current = L;

      const map = L.map(el, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      applyTileLayer(L, map, tileStyle);

      routesLayerRef.current = L.layerGroup().addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapInstanceRef.current = map;
      setMapReady(true);

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize({ animate: false });
        });
        resizeObserver.observe(el);
      }
      // Initial invalidate tick for modals/drawers
      requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersLayerRef.current = null;
        routesLayerRef.current = null;
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Switch tile layer cleanly when tileStyle changes
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapInstanceRef.current) return;
    applyTileLayer(leafletRef.current, mapInstanceRef.current, tileStyle);
  }, [mapReady, tileStyle, applyTileLayer]);

  // 3) Sync markers & supply routes whenever map becomes ready or data updates
  useEffect(() => {
    if (
      !mapReady ||
      !leafletRef.current ||
      !mapInstanceRef.current ||
      !markersLayerRef.current ||
      !routesLayerRef.current
    ) {
      return;
    }

    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    const mLayer = markersLayerRef.current;
    const rLayer = routesLayerRef.current;

    rLayer.clearLayers();
    mLayer.clearLayers();

    const isDark = tileStyle === "dark";

    for (const r of validRoutes) {
      const color = ROUTE_COLORS[r.status ?? "active"] ?? ROUTE_COLORS.active;
      const midLat = (r.from[0] + r.to[0]) / 2;
      const midLng = (r.from[1] + r.to[1]) / 2;
      const dx = r.to[1] - r.from[1];
      const dy = r.to[0] - r.from[0];
      // Subtle arc offset so overlapping East-West routes read cleanly
      const curvePoint: [number, number] = [
        midLat + Math.abs(dx) * 0.14,
        midLng - dy * 0.08,
      ];

      const polyline = L.polyline([r.from, curvePoint, r.to], {
        color,
        weight: r.status === "active" ? 2.5 : 2,
        opacity: r.status === "pending" ? 0.7 : 0.85,
        dashArray: r.status === "delivered" ? undefined : "6 6",
        className: "cervos-route-line",
      }).addTo(rLayer);

      if (r.label) {
        polyline.bindTooltip(escapeHtml(r.label), { sticky: true });
      }
    }

    for (const m of validMarkers) {
      const isSelected = Boolean(selectedId && m.id === selectedId);
      const icon = createMarkerIcon(L, m, isSelected);
      const marker = L.marker([m.lat, m.lng], {
        icon,
        zIndexOffset: isSelected ? 900 : m.kind === "hq" ? 500 : 0,
      }).addTo(mLayer);

      marker.bindPopup(createPopupContent(m, isDark), {
        maxWidth: 250,
        className: isDark ? "cervos-popup-dark" : "cervos-popup-light",
      });

      marker.on("click", () => {
        onMarkerClickRef.current?.(m);
      });

      if (isSelected) {
        marker.openPopup();
        map.panTo([m.lat, m.lng], { animate: true });
      }
    }

    if (fitBoundsOnUpdate && validMarkers.length > 1 && !selectedId) {
      const bounds = L.latLngBounds(
        validMarkers.map((m) => [m.lat, m.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 13 });
    }
  }, [
    mapReady,
    markersKey,
    routesKey,
    selectedId,
    tileStyle,
    fitBoundsOnUpdate,
    validMarkers,
    validRoutes,
  ]);

  // 4) Only sync view when primitive coordinates or zoom genuinely change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const prev = prevViewRef.current;
    const changed =
      Math.abs(prev.lat - centerLat) > 0.0001 ||
      Math.abs(prev.lng - centerLng) > 0.0001 ||
      prev.zoom !== zoom;

    if (!changed) return;
    prevViewRef.current = { lat: centerLat, lng: centerLng, zoom };
    mapInstanceRef.current.setView([centerLat, centerLng], zoom, { animate: true });
  }, [mapReady, centerLat, centerLng, zoom]);

  const handleFitAll = () => {
    if (!leafletRef.current || !mapInstanceRef.current) return;
    if (validMarkers.length === 0) {
      mapInstanceRef.current.setView([-6.369, 34.8888], 6, { animate: true });
      return;
    }
    const L = leafletRef.current;
    const bounds = L.latLngBounds(
      validMarkers.map((m) => [m.lat, m.lng] as [number, number])
    );
    mapInstanceRef.current.fitBounds(bounds, { padding: [44, 44], maxZoom: 13 });
    setActiveRegion("all");
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapInstanceRef.current?.setView(
          [pos.coords.latitude, pos.coords.longitude],
          14,
          { animate: true }
        );
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleJumpRegion = (region: (typeof TANZANIA_REGIONS)[number]) => {
    setActiveRegion(region.id);
    if (!mapInstanceRef.current) return;
    if (region.id === "all" && validMarkers.length > 1 && leafletRef.current) {
      handleFitAll();
      return;
    }
    mapInstanceRef.current.setView(region.center, region.zoom, { animate: true });
  };

  const showOfflineVectorFallback = tileErrors >= 4;
  const isDark = tileStyle === "dark";

  return (
    <div
      className={`relative isolate overflow-hidden ${className}`}
      style={{ backgroundColor: TILE_LAYERS[tileStyle].bg }}
    >
      {/* Leaflet Canvas */}
      <div ref={mapRef} className="h-full w-full" />

      {/* Offline / Blocked Tile Vector Fallback Overlay (keeps markers & corridors legible) */}
      {showOfflineVectorFallback && (
        <div
          className={`pointer-events-none absolute inset-0 z-[250] flex items-center justify-center ${
            isDark ? "bg-[#0e1320]/95" : "bg-[#eef2f9]/95"
          }`}
        >
          <svg viewBox="0 0 500 400" className="h-full w-full max-w-[680px] p-4" aria-label="Tanzania network map vector fallback">
            <defs>
              <pattern id="cervos-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke={isDark ? "rgba(148,163,184,0.12)" : "rgba(16,57,185,0.08)"}
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="500" height="400" fill="url(#cervos-map-grid)" rx="12" />
            {/* Stylized Tanzania Mainland + Unguja Silhouette */}
            <path
              d="M 96 62 L 188 46 L 268 78 L 352 96 L 392 174 L 386 248 L 398 334 L 318 358 L 222 332 L 154 276 L 84 198 L 76 118 Z"
              fill={isDark ? "rgba(30,41,59,0.75)" : "rgba(255,255,255,0.88)"}
              stroke={isDark ? "rgba(96,165,250,0.35)" : "rgba(16,57,185,0.28)"}
              strokeWidth="2"
            />
            {validRoutes.map((r, idx) => {
              const p1 = projectToSvg(r.from[0], r.from[1]);
              const p2 = projectToSvg(r.to[0], r.to[1]);
              const color = ROUTE_COLORS[r.status ?? "active"] ?? ROUTE_COLORS.active;
              return (
                <line
                  key={r.id ?? idx}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  opacity="0.85"
                />
              );
            })}
            {validMarkers.map((m, idx) => {
              const { x, y } = projectToSvg(m.lat, m.lng);
              const color =
                m.kind === "supplier"
                  ? "#0d9488"
                  : STATUS_COLORS[m.status ?? "online"] ?? STATUS_COLORS.online;
              return (
                <g
                  key={m.id ?? `${m.label}-${idx}`}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => onMarkerClick?.(m)}
                >
                  <circle cx={x} cy={y} r={10} fill={color} opacity={0.2} />
                  <circle cx={x} cy={y} r={5.5} fill={color} stroke="#ffffff" strokeWidth="2" />
                  <text
                    x={x + 8}
                    y={y + 3}
                    fontSize="10"
                    fontWeight="600"
                    fill={isDark ? "#e2e8f0" : "#1e293b"}
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <span
            className={`absolute bottom-3 right-3 rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
              isDark ? "bg-slate-900/90 text-slate-300" : "bg-white/90 text-slate-600"
            } border border-outline-variant/40 shadow-sm`}
          >
            Offline Vector Telemetry Mode
          </span>
        </div>
      )}

      {/* Streamlined Floating Map Controls */}
      {showControls && (
        <>
          <div className="pointer-events-none absolute top-3 left-3 right-3 z-[450] flex items-center justify-between gap-2">
            {/* Compact Tanzania Region Quick-Jump Select */}
            {enableRegionJump ? (
              <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-outline-variant/80 bg-surface-base/95 px-2.5 py-1 shadow-sm backdrop-blur-md">
                <span className="material-symbols-outlined text-[15px] text-primary" aria-hidden="true">
                  explore
                </span>
                <select
                  aria-label="Jump to Tanzania region"
                  value={activeRegion}
                  onChange={(e) => {
                    const target = TANZANIA_REGIONS.find((r) => r.id === e.target.value);
                    if (target) handleJumpRegion(target);
                  }}
                  className="bg-transparent text-xs font-medium text-ink-deep focus:outline-none cursor-pointer pr-1"
                >
                  {TANZANIA_REGIONS.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div />
            )}

            {/* Right Controls: Tile Switcher + Fit + Locate */}
            <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-outline-variant/80 bg-surface-base/95 p-1 shadow-sm backdrop-blur-md">
              {(["light", "dark", "street"] as MapStyleId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTileStyle(id)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    tileStyle === id
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-ink-deep"
                  }`}
                >
                  {TILE_LAYERS[id].label}
                </button>
              ))}
              <span className="mx-0.5 h-3.5 w-px bg-outline-variant" />
              <button
                type="button"
                onClick={handleFitAll}
                title="Fit all nodes"
                className="flex items-center justify-center rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">fit_screen</span>
              </button>
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locating}
                title="Center on my location"
                className="flex items-center justify-center rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">my_location</span>
              </button>
            </div>
          </div>

          {/* Bottom-left live telemetry pill */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-[450] flex items-center gap-2 rounded-md border border-outline-variant/80 bg-surface-base/95 px-2.5 py-1 text-[11px] font-medium text-on-surface-variant shadow-sm backdrop-blur-md tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>
              {validMarkers.length} node{validMarkers.length !== 1 ? "s" : ""}
              {validRoutes.length > 0
                ? ` · ${validRoutes.length} route${validRoutes.length !== 1 ? "s" : ""}`
                : ""}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
