"use client";

import { useEffect, useRef, useState } from "react";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

interface FlipTextProps {
  text: string;
  flipKey: string;
  mode?: "chars" | "words";
  className?: string;
}

export default function FlipText({
  text,
  flipKey,
  className = "",
}: FlipTextProps) {
  const isLowEnd = useIsLowEndDevice();
  const prevKeyRef = useRef(flipKey);
  const [displayedText, setDisplayedText] = useState(text);
  const [phase, setPhase] = useState<"idle" | "out" | "pre-in" | "in">("idle");

  useEffect(() => {
    // Only animate when flipKey explicitly toggles after initial mount
    if (prevKeyRef.current === flipKey) {
      setDisplayedText(text);
      return;
    }
    prevKeyRef.current = flipKey;

    if (isLowEnd) {
      setPhase("out");
      const t = setTimeout(() => {
        setDisplayedText(text);
        setPhase("idle");
      }, 110);
      return () => clearTimeout(t);
    }

    // 1. Flip OUT the old text while still keeping old string mounted
    setPhase("out");

    const swapTimer = setTimeout(() => {
      // 2. Swap text cleanly at 90deg midpoint, position incoming card at -85deg
      setDisplayedText(text);
      setPhase("pre-in");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // 3. Smoothly spring flip IN to 0deg
          setPhase("in");
        });
      });
    }, 150);

    const doneTimer = setTimeout(() => {
      setPhase("idle");
    }, 420);

    return () => {
      clearTimeout(swapTimer);
      clearTimeout(doneTimer);
    };
  }, [flipKey, text, isLowEnd]);

  // Low-end fallback style: subtle smooth opacity dip
  if (isLowEnd) {
    return (
      <span
        className={`inline-block transition-opacity duration-150 ${className}`}
        style={{ opacity: phase === "out" ? 0.35 : 1 }}
      >
        {displayedText}
      </span>
    );
  }

  // GPU-accelerated smooth split-flap style
  const transformMap = {
    idle: "perspective(700px) rotateX(0deg) translateZ(0)",
    out: "perspective(700px) rotateX(88deg) translateZ(0)",
    "pre-in": "perspective(700px) rotateX(-88deg) translateZ(0)",
    in: "perspective(700px) rotateX(0deg) translateZ(0)",
  };

  const transitionMap = {
    idle: "none",
    out: "transform 150ms ease-in, opacity 140ms ease-in",
    "pre-in": "none",
    in: "transform 250ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out",
  };

  return (
    <span
      className={`inline-block will-change-transform ${className}`}
      style={{
        transformOrigin: "50% 50%",
        backfaceVisibility: "hidden",
        transform: transformMap[phase],
        opacity: phase === "out" || phase === "pre-in" ? 0 : 1,
        transition: transitionMap[phase],
      }}
    >
      {displayedText}
    </span>
  );
}
