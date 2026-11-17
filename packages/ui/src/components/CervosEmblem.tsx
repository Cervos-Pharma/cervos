"use client";

import React from "react";
import { cn } from "../cn";

export type EmblemState = "idle" | "loading" | "scaling" | "success" | "error";

export interface CervosEmblemProps extends React.SVGProps<SVGSVGElement> {
  state?: EmblemState;
  size?: number;
  className?: string;
}

export function CervosEmblem({
  state = "idle",
  size = 40,
  className,
  ...rest
}: CervosEmblemProps) {
  const isDark = false;
  const isLoading = state === "loading";
  const isSuccess = state === "success";
  const isError = state === "error";
  const isScaling = state === "scaling";

  // Palette determined by state
  const crossColor = isSuccess
    ? "#059669"
    : isError
      ? "#A23B2F"
      : "#1F5F5B";

  const nodeAColor = isSuccess
    ? "#10B981"
    : isError
      ? "#DC2626"
      : "#10B981";

  const nodeBColor = isSuccess
    ? "#047857"
    : isError
      ? "#991B1B"
      : "#0D2E94";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Cervos Emblem (${state})`}
      className={cn(
        "select-none overflow-visible transition-transform duration-200 ease-out",
        isScaling && "animate-pulse scale-105",
        className
      )}
      {...rest}
    >
      <defs>
        <filter id={`cv-emb-shadow-${state}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation={isSuccess ? "3" : isError ? "3" : "2"}
            floodColor={isSuccess ? "#10B981" : isError ? "#DC2626" : "#1E2522"}
            floodOpacity={isSuccess || isError ? 0.35 : 0.08}
          />
        </filter>
      </defs>

      {/* Crisp White Container */}
      <rect
        x="4"
        y="4"
        width="40"
        height="40"
        rx="12"
        fill="#FFFFFF"
        stroke={isSuccess ? "#10B981" : isError ? "#F87171" : "#E2E8F0"}
        strokeWidth="1.5"
        filter={`url(#cv-emb-shadow-${state})`}
        className="transition-colors duration-300"
      />

      {/* Central Cross Group */}
      <g
        className={cn(
          "transition-all duration-300",
          isLoading && "animate-pulse"
        )}
      >
        {/* Vertical Arm */}
        <rect
          x="20.5"
          y="11"
          width="7"
          height="26"
          rx="3.5"
          fill={crossColor}
          className="transition-colors duration-300"
        />
        {/* Horizontal Arm */}
        <rect
          x="11"
          y="20.5"
          width="26"
          height="7"
          rx="3.5"
          fill={crossColor}
          className="transition-colors duration-300"
        />
      </g>

      {/* Composite Satellite Nodes - Orbits during loading, expands during success */}
      <g
        className={cn(
          "origin-center transition-transform duration-500",
          isLoading && "animate-[spin_2s_linear_infinite]"
        )}
        style={{ transformOrigin: "24px 24px" }}
      >
        {/* Upper Right Accent Circle */}
        <circle
          cx="30"
          cy="18"
          r="4.5"
          fill={nodeAColor}
          className="transition-colors duration-300"
        />
        {/* Lower Left Anchor Circle */}
        <circle
          cx="18"
          cy="30"
          r="4"
          fill={nodeBColor}
          className="transition-colors duration-300"
        />
      </g>

      {/* Center Optical Focal Dot */}
      <circle
        cx="24"
        cy="24"
        r="2.2"
        fill="#FFFFFF"
        className={cn(
          "transition-all duration-300",
          isSuccess && "fill-emerald-100"
        )}
      />
    </svg>
  );
}
