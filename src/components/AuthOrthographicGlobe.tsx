"use client";

import { useEffect, useRef } from "react";
import worldFeatures from "@/lib/world-geo.json";
import { GLOBE_SHARED_TOKENS } from "@/lib/globe-theme";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export interface ActiveStationPing {
  lat: number;
  lng: number;
}

interface GeoFeature {
  id?: string;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

interface GlobeDot {
  x: number;
  y: number;
  z: number;
  isTanzania: boolean;
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildGlobeDots(): GlobeDot[] {
  const dots: GlobeDot[] = [];
  const features = worldFeatures as unknown as GeoFeature[];

  type ParsedPoly = {
    isTanzania: boolean;
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
    rings: number[][][];
  };

  const polys: ParsedPoly[] = [];

  for (const feat of features) {
    if (!feat?.geometry) continue;
    const isTza = feat.id === "TZA";
    const polyList =
      feat.geometry.type === "Polygon"
        ? [feat.geometry.coordinates as number[][][]]
        : (feat.geometry.coordinates as number[][][][]);

    for (const rings of polyList) {
      if (!rings?.[0]?.length) continue;
      let minLng = 180;
      let maxLng = -180;
      let minLat = 90;
      let maxLat = -90;
      for (const [lng, lat] of rings[0]) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      polys.push({ isTanzania: isTza, minLng, maxLng, minLat, maxLat, rings });
    }
  }

  const degToRad = Math.PI / 180;

  // Crisp rich dot-matrix continents matching Home's dotted globe visual DNA
  for (let lat = -76; lat <= 76; lat += 2.2) {
    const cosLat = Math.cos(lat * degToRad);
    const lngStep = Math.max(2.2, 2.35 / Math.max(0.28, cosLat));
    for (let lng = -180; lng < 180; lng += lngStep) {
      let hit = false;
      let isTza = false;
      for (const p of polys) {
        if (lng < p.minLng || lng > p.maxLng || lat < p.minLat || lat > p.maxLat) continue;
        if (pointInRing(lng, lat, p.rings[0])) {
          hit = true;
          if (p.isTanzania) isTza = true;
          break;
        }
      }
      if (hit && !isTza) {
        const phi = lat * degToRad;
        const theta = lng * degToRad;
        dots.push({
          x: Math.cos(phi) * Math.sin(theta),
          y: Math.sin(phi),
          z: Math.cos(phi) * Math.cos(theta),
          isTanzania: false,
        });
      }
    }
  }

  // Elevated cobalt cluster highlighting Tanzania cleanly
  const tzaPolys = polys.filter((p) => p.isTanzania);
  for (const p of tzaPolys) {
    for (let lat = p.minLat; lat <= p.maxLat; lat += 0.52) {
      for (let lng = p.minLng; lng <= p.maxLng; lng += 0.52) {
        if (pointInRing(lng, lat, p.rings[0])) {
          const phi = lat * degToRad;
          const theta = lng * degToRad;
          dots.push({
            x: Math.cos(phi) * Math.sin(theta),
            y: Math.sin(phi),
            z: Math.cos(phi) * Math.cos(theta),
            isTanzania: true,
          });
        }
      }
    }
  }

  return dots;
}

const CACHED_DOTS = buildGlobeDots();

interface Props {
  activePoints: ActiveStationPing[];
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  invertTheme?: boolean;
  onReady?: () => void;
}

export default function AuthOrthographicGlobe({
  activePoints,
  autoRotate = true,
  autoRotateSpeed = 0.55,
  invertTheme = false,
  onReady,
}: Props) {
  const isLowEnd = useIsLowEndDevice();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const invertRef = useRef(invertTheme);
  invertRef.current = invertTheme;

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const speedRef = useRef(autoRotateSpeed);
  speedRef.current = autoRotateSpeed;

  const pointsRef = useRef(activePoints);
  pointsRef.current = activePoints;

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onReadyRef.current?.();
      return;
    }

    const degToRad = Math.PI / 180;
    // Start centered toward East Africa / Tanzania (-9.5 lat, 36 lng) with Earth-like axial tilt
    let yaw = -36 * degToRad;
    const tilt = 15 * degToRad;
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);
    const axialRoll = -GLOBE_SHARED_TOKENS.axialTiltDeg * degToRad;
    const cosRoll = Math.cos(axialRoll);
    const sinRoll = Math.sin(axialRoll);

    const projectPoint = (vx: number, vy: number, vz: number, cosYaw: number, sinYaw: number) => {
      const rx0 = vx * cosYaw + vz * sinYaw;
      const rz0 = -vx * sinYaw + vz * cosYaw;
      const ry0 = vy * cosTilt - rz0 * sinTilt;
      const rz = vy * sinTilt + rz0 * cosTilt;
      // Diagonal axial obliquity matching Earth's 21.5 deg tilt
      const rx = rx0 * cosRoll - ry0 * sinRoll;
      const ry = rx0 * sinRoll + ry0 * cosRoll;
      return { rx, ry, rz };
    };

    let dragging = false;
    let lastX = 0;
    let dragVel = 0;

    let cssWidth = wrapper.clientWidth || 420;
    let cssHeight = wrapper.clientHeight || 420;
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const syncSize = () => {
      if (!wrapper || !canvas) return;
      cssWidth = Math.max(220, wrapper.clientWidth || 420);
      cssHeight = Math.max(220, wrapper.clientHeight || 420);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    };

    syncSize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(syncSize);
      ro.observe(wrapper);
    }
    window.addEventListener("resize", syncSize);

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      dragVel = 0;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      dragVel = dx * 0.0055;
      yaw += dragVel;
    };
    const onPointerUp = () => {
      dragging = false;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    let frameId = 0;
    let lastTs = performance.now();
    let signaled = false;

    const renderFrame = (now: number) => {
      const dt = Math.min(48, Math.max(0, now - lastTs)) / 1000;
      lastTs = now;

      if (!dragging) {
        if (!isLowEnd && autoRotateRef.current) {
          yaw += dt * speedRef.current * 0.24;
        }
        if (Math.abs(dragVel) > 0.0001) {
          yaw += dragVel;
          dragVel *= 0.92;
        }
      }

      const dark = invertRef.current;
      const palette = dark ? GLOBE_SHARED_TOKENS.dark : GLOBE_SHARED_TOKENS.light;
      const w = cssWidth;
      const h = cssHeight;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.43;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Identical outer rim atmosphere halo matching Home's TanzaniaGlobe
      const halo = ctx.createRadialGradient(cx, cy, r * 0.94, cx, cy, r * 1.15);
      halo.addColorStop(0, palette.atmosphereRim);
      halo.addColorStop(0.5, palette.atmosphereMid);
      halo.addColorStop(1, palette.atmosphereOuter);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // Identical bright porcelain / obsidian globe surface lighting
      const bodyGrad = ctx.createRadialGradient(
        cx - r * 0.24,
        cy - r * 0.24,
        r * 0.08,
        cx,
        cy,
        r
      );
      bodyGrad.addColorStop(0, palette.sphereCenter);
      bodyGrad.addColorStop(0.65, palette.sphereMid);
      bodyGrad.addColorStop(1, palette.sphereRim);

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = palette.rimStroke;
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Clip interior to sphere for graticules & dots
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
      ctx.clip();

      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);

      // Graticule meridians (6 crisp longitude rings)
      ctx.strokeStyle = palette.graticule;
      ctx.lineWidth = 0.85;
      for (let m = 0; m < 6; m++) {
        const lon = (m * Math.PI) / 6;
        ctx.beginPath();
        let started = false;
        for (let a = -90; a <= 90; a += 6) {
          const phi = a * degToRad;
          const vx = Math.cos(phi) * Math.sin(lon);
          const vy = Math.sin(phi);
          const vz = Math.cos(phi) * Math.cos(lon);

          const { rx, ry, rz } = projectPoint(vx, vy, vz, cosYaw, sinYaw);

          if (rz > 0) {
            const sx = cx + rx * r;
            const sy = cy - ry * r;
            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // Graticule parallels
      for (const latDeg of [-60, -30, 0, 30, 60]) {
        const phi = latDeg * degToRad;
        const cPhi = Math.cos(phi);
        const sPhi = Math.sin(phi);
        ctx.beginPath();
        let started = false;
        for (let lonDeg = -180; lonDeg <= 180; lonDeg += 6) {
          const theta = lonDeg * degToRad;
          const vx = cPhi * Math.sin(theta);
          const vy = sPhi;
          const vz = cPhi * Math.cos(theta);

          const { rx, ry, rz } = projectPoint(vx, vy, vz, cosYaw, sinYaw);

          if (rz > 0) {
            const sx = cx + rx * r;
            const sy = cy - ry * r;
            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // World land dots matching Home's slate/white dot matrix
      ctx.fillStyle = palette.landDot;
      const worldDotSize = Math.max(1.35, r * 0.0095);
      for (let i = 0; i < CACHED_DOTS.length; i++) {
        const d = CACHED_DOTS[i];
        if (d.isTanzania) continue;

        const { rx, ry, rz } = projectPoint(d.x, d.y, d.z, cosYaw, sinYaw);

        if (rz > 0.02) {
          const sx = cx + rx * r;
          const sy = cy - ry * r;
          ctx.beginPath();
          ctx.arc(sx, sy, worldDotSize * (0.72 + 0.38 * rz), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Tanzania Highlight Cluster
      ctx.fillStyle = palette.tanzaniaDot;
      const tzaDotSize = Math.max(1.8, r * 0.0125);
      for (let i = 0; i < CACHED_DOTS.length; i++) {
        const d = CACHED_DOTS[i];
        if (!d.isTanzania) continue;

        const { rx, ry, rz } = projectPoint(d.x, d.y, d.z, cosYaw, sinYaw);

        if (rz > 0.02) {
          const sx = cx + rx * r;
          const sy = cy - ry * r;
          ctx.beginPath();
          ctx.arc(sx, sy, tzaDotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Active Pharmacy / Supplier Telemetry Rings
      const pts = pointsRef.current;
      const pulsePhase = (now % 2200) / 2200;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        const phi = pt.lat * degToRad;
        const theta = pt.lng * degToRad;
        const vx = Math.cos(phi) * Math.sin(theta);
        const vy = Math.sin(phi);
        const vz = Math.cos(phi) * Math.cos(theta);

        const { rx, ry, rz } = projectPoint(vx, vy, vz, cosYaw, sinYaw);

        if (rz > 0.1) {
          const sx = cx + rx * r;
          const sy = cy - ry * r;

          ctx.fillStyle = palette.pingDot;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(3, r * 0.018), 0, Math.PI * 2);
          ctx.fill();

          if (!isLowEnd) {
            const p = (pulsePhase + i * 0.16) % 1;
            const ringR = r * 0.02 + p * r * 0.07;
            ctx.strokeStyle = `rgba(${palette.pingRingRgb}, ${(1 - p) * 0.72})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      ctx.restore();

      if (!signaled) {
        signaled = true;
        onReadyRef.current?.();
      }

      if (!isLowEnd) {
        frameId = requestAnimationFrame(renderFrame);
      }
    };

    frameId = requestAnimationFrame(renderFrame);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      ro?.disconnect();
      window.removeEventListener("resize", syncSize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isLowEnd]);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full relative flex items-center justify-center"
      aria-label="Cervos Network Globe"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      />
    </div>
  );
}
