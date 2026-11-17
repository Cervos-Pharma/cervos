"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import type { NetworkHealthMetrics } from "@/lib/actions/hq";
import CervosMap from "@/components/MapClientWrapper";
import type { MarkerData } from "@/components/CervosMap";

interface BranchPoint {
  lat: number | null;
  lng: number | null;
  name: string;
  accountName: string;
  status: "healthy" | "at_risk" | "locked";
}

interface Props {
  networkHealth: NetworkHealthMetrics;
  branchLocations?: BranchPoint[];
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "#146C2E",
  at_risk: "#B3261E",
  locked: "#7D5260",
};

interface GlobeInstance {
  container(el: HTMLElement): GlobeInstance;
  globeImageUrl(url: string): GlobeInstance;
  bumpImageUrl(url: string): GlobeInstance;
  backgroundImageUrl(url: string): GlobeInstance;
  pointsData(data: BranchPoint[]): GlobeInstance;
  pointLat(lat: string): GlobeInstance;
  pointLng(lng: string): GlobeInstance;
  pointColor(fn: (p: BranchPoint) => string): GlobeInstance;
  pointAltitude(n: number): GlobeInstance;
  pointRadius(n: number): GlobeInstance;
  pointLabel(fn: (p: BranchPoint) => string): GlobeInstance;
  onGlobeReady(fn: () => void): GlobeInstance;
  autoRotate(n: number): GlobeInstance;
  controls(): { autoRotate: boolean; autoRotateSpeed: number };
  destroy(): void;
}

declare global {
  interface Window {
    Globe: (opts?: Record<string, unknown>) => GlobeInstance;
    THREE: unknown;
  }
}

export default function NetworkGlobe({ networkHealth, branchLocations = [] }: Props) {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<unknown>(null);
  const [view, setView] = useState<"globe" | "map">("map");
  const [globeError, setGlobeError] = useState<string | null>(null);

  const validPoints = useMemo(
    () =>
      branchLocations.filter(
        (b) => typeof b.lat === "number" && typeof b.lng === "number"
      ),
    [branchLocations]
  );

  const mapMarkers: MarkerData[] = useMemo(
    () =>
      validPoints.map((p, idx) => ({
        id: `${p.name}-${idx}`,
        lat: p.lat!,
        lng: p.lng!,
        label: p.name,
        accountName: p.accountName,
        status: p.status,
      })),
    [validPoints]
  );

  // ── 3D Globe via CDN (on explicit toggle) ─────────────────────────────────
  useEffect(() => {
    if (view !== "globe") return;

    let isMounted = true;

    const init = () => {
      if (!isMounted || !globeContainerRef.current) return;
      if (validPoints.length === 0) {
        setGlobeError("No branch locations available for 3D view.");
        return;
      }

      const container = globeContainerRef.current;

      const loadGlobe = () => {
        if (!window.Globe) {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/globe.gl@2.27.2/dist/globe.gl.js";
          script.onload = () => {
            if (!isMounted) return;
            mountGlobe(window.Globe);
          };
          script.onerror = () => {
            if (isMounted) setGlobeError("Failed to load 3D globe assets. Use the interactive 2D map instead.");
          };
          document.head.appendChild(script);
        } else {
          mountGlobe(window.Globe);
        }
      };

      const mountGlobe = (GlobeFn: (opts?: Record<string, unknown>) => GlobeInstance) => {
        if (!isMounted || !container) return;

        let instance: GlobeInstance;
        try {
          instance = GlobeFn({});
        } catch {
          if (isMounted) setGlobeError("Failed to initialize 3D globe. Please use 2D map.");
          return;
        }

        instance
          .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
          .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
          .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png")
          .pointsData(validPoints)
          .pointLat("lat")
          .pointLng("lng")
          .pointColor((p: BranchPoint) => STATUS_COLORS[p.status] ?? "#6750A4")
          .pointAltitude(0.01)
          .pointRadius(0.4)
          .pointLabel(
            (p: BranchPoint) =>
              `<div style="font-family:system-ui,sans-serif;color:#222;padding:8px;min-width:140px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
              <strong>${p.name}</strong><br/>
              <span style="color:#666;font-size:12px">${p.accountName}</span><br/>
              <span style="color:${STATUS_COLORS[p.status]};font-size:11px;font-weight:600">${p.status.toUpperCase().replace("_", " ")}</span>
            </div>`
          );

        try {
          (instance as unknown as (el: HTMLElement) => void)(container);
          const controls = instance.controls();
          if (controls) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.3;
          }
        } catch {
          /* ignore */
        }
        globeInstanceRef.current = instance;
      };

      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("webgl2");
        if (!gl) {
          if (isMounted) setGlobeError("WebGL not available on this device. Use the 2D map view.");
          return;
        }
      } catch {
        if (isMounted) setGlobeError("WebGL check failed. Use the 2D map view.");
        return;
      }

      loadGlobe();
    };

    init();

    return () => {
      isMounted = false;
      if (globeInstanceRef.current) {
        try {
          (globeInstanceRef.current as { destroy: () => void }).destroy();
        } catch {
          /* ignore */
        }
        globeInstanceRef.current = null;
      }
    };
  }, [view, validPoints]);

  const totalPlotted = validPoints.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex rounded-lg border border-outline-variant overflow-hidden">
          <button
            type="button"
            onClick={() => setView("map")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              view === "map"
                ? "bg-primary text-on-primary"
                : "bg-surface text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            2D Network Map
          </button>
          <button
            type="button"
            onClick={() => {
              setGlobeError(null);
              setView("globe");
            }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              view === "globe"
                ? "bg-primary text-on-primary"
                : "bg-surface text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            3D Globe
          </button>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-body-sm text-on-surface-variant text-xs capitalize">
                {status.replace("_", " ")}
              </span>
            </div>
          ))}
          <span className="font-body-sm text-on-surface-variant text-xs ml-2">
            {totalPlotted} location{totalPlotted !== 1 ? "s" : ""} plotted
          </span>
        </div>
      </div>

      {view === "globe" ? (
        globeError ? (
          <div className="w-full h-[420px] flex items-center justify-center border border-outline-variant rounded-lg bg-surface-base">
            <div className="text-center p-6">
              <p className="font-body-md text-on-surface-variant mb-3">{globeError}</p>
              <button
                type="button"
                onClick={() => {
                  setGlobeError(null);
                  setView("map");
                }}
                className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90"
              >
                Switch to 2D Map
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={globeContainerRef}
            className="w-full h-[500px] max-h-[600px] rounded-lg overflow-hidden border border-outline-variant"
            style={{ background: "#0a0a1a" }}
          />
        )
      ) : (
        <div className="w-full h-[500px] max-h-[600px] rounded-lg overflow-hidden border border-outline-variant">
          <CervosMap
            center={[-6.369, 34.8888]}
            zoom={6}
            markers={mapMarkers}
            enableRegionJump
            className="h-full w-full"
          />
        </div>
      )}
      {networkHealth.totalBranches > 0 && (
        <p className="font-body-sm text-xs text-on-surface-variant">
          {networkHealth.onlineNow}/{networkHealth.totalBranches} branches currently synced online.
        </p>
      )}
    </div>
  );
}
