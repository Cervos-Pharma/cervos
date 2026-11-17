"use client";

import { useEffect, useState } from "react";

export function useIsLowEndDevice(): boolean {
  const [lowEnd, setLowEnd] = useState(false);

  useEffect(() => {
    try {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        setLowEnd(true);
        return;
      }

      const cores = navigator.hardwareConcurrency;
      const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      if ((typeof cores === "number" && cores <= 2) || (typeof mem === "number" && mem <= 2)) {
        setLowEnd(true);
        return;
      }

      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("webgl2");
      if (!gl) {
        setLowEnd(true);
        return;
      }

      const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = String(
          (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ""
        ).toLowerCase();
        if (
          renderer.includes("swiftshader") ||
          renderer.includes("llvmpipe") ||
          renderer.includes("software") ||
          renderer.includes("basic render")
        ) {
          setLowEnd(true);
        }
      }
    } catch {
      setLowEnd(true);
    }
  }, []);

  return lowEnd;
}
