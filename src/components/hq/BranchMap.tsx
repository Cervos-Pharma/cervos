"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import type { BranchIntelligenceMetrics } from "@/lib/actions/hq";

interface Props {
  branches: BranchIntelligenceMetrics["branchLocations"];
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function projectTz(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - 29.2) / (40.6 - 29.2)) * 420 + 40;
  const y = ((-0.9 - lat) / (-0.9 - -11.9)) * 340 + 30;
  return {
    x: Math.max(24, Math.min(476, x)),
    y: Math.max(24, Math.min(376, y)),
  };
}

export default function BranchMap({ branches }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tileErrors, setTileErrors] = useState(0);

  const validBranches = useMemo(
    () =>
      branches.filter(
        (b) =>
          typeof b.lat === "number" &&
          typeof b.lng === "number" &&
          Number.isFinite(b.lat) &&
          Number.isFinite(b.lng)
      ),
    [branches]
  );

  // Init map once with ResizeObserver
  useEffect(() => {
    const el = mapRef.current;
    if (!el || mapInstanceRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !el || mapInstanceRef.current) return;
        leafletRef.current = L;

        const map = L.map(el, { zoomControl: true }).setView([-6.369, 34.8888], 6);
        const tileLayer = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19,
          }
        );
        tileLayer.on("tileerror", () => {
          setTileErrors((c) => Math.min(c + 1, 20));
        });
        tileLayer.addTo(map);

        mapInstanceRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);
        setMapReady(true);

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            map.invalidateSize({ animate: false });
          });
          resizeObserver.observe(el);
        }
        requestAnimationFrame(() => map.invalidateSize({ animate: false }));
      } catch {
        if (!cancelled) setMapError("Failed to load map. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Sync revenue-scaled circle markers when map is ready OR branches update
  useEffect(() => {
    if (
      !mapReady ||
      !leafletRef.current ||
      !mapInstanceRef.current ||
      !markersLayerRef.current
    ) {
      return;
    }

    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    if (validBranches.length === 0) return;

    const maxRevenue = Math.max(...validBranches.map((b) => b.revenue), 1);

    for (const branch of validBranches) {
      const radius = Math.max(6, Math.min(22, (branch.revenue / maxRevenue) * 22));
      const color =
        branch.revenue > maxRevenue * 0.5
          ? "#146C2E"
          : branch.revenue > maxRevenue * 0.2
          ? "#0061A4"
          : "#B3261E";

      const marker = L.circleMarker([branch.lat!, branch.lng!], {
        radius,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(layer);

      marker.bindPopup(`
        <div style="font-family:Inter,system-ui,sans-serif;min-width:170px">
          <strong style="font-size:14px">${escapeHtml(branch.branchName)}</strong><br/>
          <span style="color:#666;font-size:12px">${escapeHtml(branch.accountName)}</span><br/>
          <hr style="margin:6px 0;border-color:#e5e7eb"/>
          <span style="font-size:13px"><strong>Revenue:</strong> TZS ${Math.round(branch.revenue).toLocaleString()}</span><br/>
          <span style="font-size:12px;color:${color};font-weight:600">&#9679; ${
            radius < 9 ? "Low" : radius < 16 ? "Medium" : "Top"
          } performer</span>
        </div>
      `);
    }

    if (validBranches.length > 1) {
      const group = L.featureGroup(
        validBranches.map((b) =>
          L.circleMarker([b.lat!, b.lng!], { radius: 0.1, interactive: false })
        )
      );
      map.fitBounds(group.getBounds().pad(0.15));
    } else if (validBranches.length === 1) {
      map.setView([validBranches[0].lat!, validBranches[0].lng!], 12);
    }
  }, [mapReady, validBranches]);

  if (validBranches.length === 0) {
    return (
      <div className="bg-surface-base border border-outline-variant p-6 text-center rounded-lg">
        <p className="font-body-md text-on-surface-variant">
          No branches with coordinates available.
        </p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="bg-surface-base border border-outline-variant p-6 text-center rounded-lg">
        <p className="font-body-md text-on-surface-variant">{mapError}</p>
      </div>
    );
  }

  const maxRev = Math.max(...validBranches.map((b) => b.revenue), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 flex-wrap">
        {[
          { color: "#146C2E", label: "Top performer (>50% max)" },
          { color: "#0061A4", label: "Mid performer (20-50%)" },
          { color: "#B3261E", label: "Low performer (<20%)" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: item.color }} />
            <span className="font-body-sm text-on-surface-variant text-xs">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <span className="font-body-sm text-on-surface-variant text-xs">Circle size = revenue</span>
        </div>
      </div>

      <div className="relative isolate w-full h-[500px] max-h-[600px] rounded-lg overflow-hidden border border-outline-variant bg-[#eef2f9]">
        <div ref={mapRef} className="w-full h-full" />
        {tileErrors >= 4 && (
          <div className="pointer-events-none absolute inset-0 z-[250] flex items-center justify-center bg-[#eef2f9]/95">
            <svg viewBox="0 0 500 400" className="h-full w-full max-w-[660px] p-4">
              <path
                d="M 96 62 L 188 46 L 268 78 L 352 96 L 392 174 L 386 248 L 398 334 L 318 358 L 222 332 L 154 276 L 84 198 L 76 118 Z"
                fill="rgba(255,255,255,0.88)"
                stroke="rgba(16,57,185,0.28)"
                strokeWidth="2"
              />
              {validBranches.map((b, i) => {
                const { x, y } = projectTz(b.lat!, b.lng!);
                const color =
                  b.revenue > maxRev * 0.5
                    ? "#146C2E"
                    : b.revenue > maxRev * 0.2
                    ? "#0061A4"
                    : "#B3261E";
                const r = Math.max(5, Math.min(18, (b.revenue / maxRev) * 18));
                return (
                  <g key={`${b.branchName}-${i}`}>
                    <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.78} stroke="#fff" strokeWidth="2" />
                    <text x={x + r + 4} y={y + 3} fontSize="10" fontWeight="600" fill="#1e293b">
                      {b.branchName}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
