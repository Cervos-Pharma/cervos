"use client";

import { useEffect, useRef, useState } from "react";
import worldFeatures from "@/lib/world-geo.json";
import { GLOBE_SHARED_TOKENS } from "@/lib/globe-theme";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export interface ActiveStationPing {
  lat: number;
  lng: number;
}

interface GeoFeature {
  type: string;
  id?: string;
  properties?: { name?: string };
  geometry: unknown;
}

interface Props {
  activePoints: ActiveStationPing[];
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  invertTheme?: boolean;
  onReady?: () => void;
}

export default function TanzaniaGlobe({
  activePoints,
  autoRotate = true,
  autoRotateSpeed = 0.28,
  invertTheme = false,
  onReady,
}: Props) {
  const isLowEnd = useIsLowEndDevice();
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const globeRef = useRef<{
    _destructor?: () => void;
    renderer?: () => {
      domElement?: HTMLCanvasElement;
      dispose?: () => void;
      getContext?: () => WebGLRenderingContext | WebGL2RenderingContext | null;
    };
    pointsData?: (d: unknown[]) => void;
    ringsData?: (d: unknown[]) => void;
    hexPolygonColor?: (fn: (d: object) => string) => void;
    atmosphereColor?: (c: string) => void;
    pointColor?: (fn: () => string) => void;
    ringColor?: (fn: () => (t: number) => string) => void;
    globeMaterial?: () => unknown;
    controls?: () => { autoRotate: boolean; autoRotateSpeed: number };
  } | null>(null);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    if (isLowEnd) return;
    let mounted = true;
    const el = containerRef.current;
    if (!el) return;

    let rafInitId = 0;
    let lostHandler: ((e: Event) => void) | null = null;
    let rendererCanvas: HTMLCanvasElement | null = null;

    const initGlobe = async () => {
      try {
        const { default: Globe } = await import("globe.gl");
        if (!mounted || !containerRef.current) return;

        // Wait one animation frame if layout dimensions are not measured yet
        const measureAndMount = () => {
          if (!mounted || !containerRef.current) return;
          const width = containerRef.current.clientWidth || 560;
          const height = containerRef.current.clientHeight || 560;
          if (width < 20 || height < 20) {
            rafInitId = requestAnimationFrame(measureAndMount);
            return;
          }

          containerRef.current.innerHTML = "";
          const features = worldFeatures as GeoFeature[];

          const palette = invertTheme ? GLOBE_SHARED_TOKENS.dark : GLOBE_SHARED_TOKENS.light;

          const world = new Globe(containerRef.current, {
            rendererConfig: {
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            },
          })
            .width(width)
            .height(height)
            .backgroundColor("rgba(0,0,0,0)")
            .showGraticules(true)
            .atmosphereColor(palette.webglAtmosphere)
            .atmosphereAltitude(0.14)
            .hexPolygonsData(features)
            .hexPolygonResolution(3)
            .hexPolygonMargin(0.32)
            .hexPolygonUseDots(true)
            .hexPolygonColor((d: object) => {
              const feat = d as GeoFeature;
              return feat.id === "TZA" ? palette.tanzaniaDot : palette.landDot;
            })
            .hexPolygonAltitude((d: object) => {
              const feat = d as GeoFeature;
              return feat.id === "TZA" ? 0.016 : 0.002;
            })
            .pointsData(activePoints)
            .pointLat("lat")
            .pointLng("lng")
            .pointColor(() => palette.pingDot)
            .pointAltitude(0.025)
            .pointRadius(0.3)
            .ringsData(activePoints)
            .ringLat("lat")
            .ringLng("lng")
            .ringColor(() => (t: number) =>
              `rgba(${palette.pingRingRgb}, ${Math.max(0, 0.78 * (1 - t))})`
            )
            .ringMaxRadius(1.45)
            .ringPropagationSpeed(0.75)
            .ringRepeatPeriod(2000);

          const globeMat = world.globeMaterial() as unknown as {
            color?: { set: (c: string) => void };
            emissive?: { set: (c: string) => void };
            emissiveIntensity?: number;
            shininess?: number;
          };
          globeMat?.color?.set(palette.webglSurface);
          globeMat?.emissive?.set(palette.webglEmissive);
          if (globeMat) {
            globeMat.emissiveIntensity = invertTheme ? 0.35 : 0.24;
            globeMat.shininess = 10;
          }

          const lights = world.lights() as unknown as Array<{ intensity?: number }>;
          if (lights && lights[0]) {
            lights[0].intensity = 1.65;
          }

          world.pointOfView({ lat: -9.5, lng: 40.5, altitude: 1.72 }, 700);
          if (width >= 640) {
            world.globeOffset([85, 0]);
          }

          const controls = world.controls();
          if (controls) {
            controls.enableZoom = false;
            controls.autoRotate = autoRotate;
            controls.autoRotateSpeed = autoRotateSpeed;
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
          }

          // Match Earth's subtle diagonal axial tilt (~21.5 deg) consistently across Home and Auth
          const scene = (world as unknown as { scene?: () => { rotation: { z: number } } }).scene?.();
          if (scene) {
            scene.rotation.z = -0.375;
          }

          const renderer = world.renderer?.();
          rendererCanvas = renderer?.domElement ?? null;
          if (rendererCanvas) {
            lostHandler = (ev: Event) => {
              ev.preventDefault();
              if (mounted) setWebglError(true);
            };
            rendererCanvas.addEventListener("webglcontextlost", lostHandler);
          }

          globeRef.current = world as unknown as typeof globeRef.current;

          // Signal readiness after WebGL paints first frame
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (mounted) onReadyRef.current?.();
            });
          });
        };

        measureAndMount();
      } catch {
        if (mounted) {
          setWebglError(true);
          onReadyRef.current?.();
        }
      }
    };

    initGlobe();

    const handleResize = () => {
      if (containerRef.current && globeRef.current && "width" in globeRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 20 && h > 20) {
          (globeRef.current as unknown as { width: (n: number) => { height: (n: number) => void } })
            .width(w)
            .height(h);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(handleResize);
      ro.observe(containerRef.current);
    }

    return () => {
      mounted = false;
      if (rafInitId) cancelAnimationFrame(rafInitId);
      window.removeEventListener("resize", handleResize);
      ro?.disconnect();
      if (rendererCanvas && lostHandler) {
        rendererCanvas.removeEventListener("webglcontextlost", lostHandler);
      }
      try {
        const renderer = globeRef.current?.renderer?.();
        const gl = renderer?.getContext?.();
        globeRef.current?._destructor?.();
        renderer?.dispose?.();
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        /* ignore */
      }
      globeRef.current = null;
      if (el) el.innerHTML = "";
    };
  }, [isLowEnd]);

  // React smoothly to active point changes
  useEffect(() => {
    if (!globeRef.current || isLowEnd) return;
    try {
      globeRef.current.pointsData?.(activePoints);
      globeRef.current.ringsData?.(activePoints);
    } catch {
      /* ignore */
    }
  }, [activePoints, isLowEnd]);

  // React smoothly to B&W invert & autoRotate updates without destroying WebGL context
  useEffect(() => {
    if (isLowEnd) return;
    const world = globeRef.current;
    if (!world) return;
    try {
      world.atmosphereColor?.(invertTheme ? "#E5E7EB" : "#93C5FD");
      world.hexPolygonColor?.((d: object) => {
        const feat = d as GeoFeature;
        if (invertTheme) {
          return feat.id === "TZA" ? "#FFFFFF" : "rgba(255, 255, 255, 0.38)";
        }
        return feat.id === "TZA" ? "#1039B9" : "rgba(100, 116, 139, 0.62)";
      });
      world.pointColor?.(() => (invertTheme ? "#FFFFFF" : "#10B981"));
      world.ringColor?.(() => (t: number) =>
        invertTheme
          ? `rgba(255, 255, 255, ${Math.max(0, 0.82 * (1 - t))})`
          : `rgba(16, 185, 129, ${Math.max(0, 0.78 * (1 - t))})`
      );
      const globeMat = world.globeMaterial?.() as unknown as {
        color?: { set: (c: string) => void };
        emissive?: { set: (c: string) => void };
        emissiveIntensity?: number;
      };
      globeMat?.color?.set(invertTheme ? "#09090B" : "#f1f5f9");
      globeMat?.emissive?.set(invertTheme ? "#18181B" : "#dbeafe");
      if (globeMat) {
        globeMat.emissiveIntensity = invertTheme ? 0.38 : 0.28;
      }
      const controls = world.controls?.();
      if (controls) {
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = autoRotateSpeed;
      }
    } catch {
      /* ignore */
    }
  }, [invertTheme, autoRotate, autoRotateSpeed, isLowEnd]);

  useEffect(() => {
    if (webglError || isLowEnd) {
      onReadyRef.current?.();
    }
  }, [webglError, isLowEnd]);

  if (webglError || isLowEnd) {
    return (
      <div className="w-full h-full flex items-center justify-center relative">
        <div
          className={`relative w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] rounded-full border shadow-xl flex items-center justify-center overflow-hidden ${
            invertTheme
              ? "border-neutral-700 bg-neutral-950 text-white"
              : "border-slate-200 bg-gradient-to-br from-white via-[#EFF6FF] to-[#DBEAFE] text-[#1039B9]"
          }`}
          style={{
            backgroundImage: invertTheme
              ? "radial-gradient(circle, rgba(255,255,255,0.22) 1.5px, transparent 1.5px)"
              : "radial-gradient(circle, rgba(16,57,185,0.22) 1.5px, transparent 1.5px)",
            backgroundSize: "18px 18px",
          }}
        >
          <svg viewBox="0 0 120 120" className="w-44 h-44 opacity-90" fill="none">
            <path
              d="M48 20 L65 24 L82 38 L86 58 L78 84 L62 96 L42 94 L30 78 L26 54 L34 32 Z"
              fill={invertTheme ? "rgba(255,255,255,0.85)" : "rgba(16,57,185,0.75)"}
            />
            <circle cx="80" cy="52" r="3.5" fill={invertTheme ? "#FFFFFF" : "#10B981"} />
            <circle cx="62" cy="36" r="3" fill={invertTheme ? "#FFFFFF" : "#10B981"} />
            <circle cx="38" cy="34" r="3" fill={invertTheme ? "#FFFFFF" : "#10B981"} />
            <circle cx="58" cy="54" r="3" fill={invertTheme ? "#FFFFFF" : "#10B981"} />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full block relative cursor-grab active:cursor-grabbing"
      aria-label="Tanzania Mesh Globe"
    />
  );
}
