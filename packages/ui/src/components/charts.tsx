"use client";

import React from "react";
import { cn } from "../cn";

/* ---------------------------------------------------------- ProgressRing */

export interface RingSegment {
  label: string;
  /** 0 to 100 */
  value: number;
  color: string;
}

export interface ProgressRingProps {
  rings: RingSegment[];
  size?: number;
  thickness?: number;
  className?: string;
}

/** Concentric progress rings. The outer ring is the first item. */
export function ProgressRing({ rings, size = 160, thickness = 12, className }: ProgressRingProps) {
  const gap = 4;
  const center = size / 2;
  return (
    <div className={cn("flex items-center gap-5", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={rings.map((r) => `${r.label} ${r.value}%`).join(", ")}>
        {rings.map((ring, i) => {
          const r = center - thickness / 2 - i * (thickness + gap);
          if (r <= 0) return null;
          const c = 2 * Math.PI * r;
          const pct = Math.max(0, Math.min(100, ring.value));
          return (
            <g key={ring.label} transform={`rotate(-90 ${center} ${center})`}>
              <circle cx={center} cy={center} r={r} fill="none" stroke="#EDEAE3" strokeWidth={thickness} />
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct / 100)}
                style={{ transition: "stroke-dashoffset 400ms cubic-bezier(0.2,0,0,1)" }}
              />
            </g>
          );
        })}
      </svg>
      <ul className="flex flex-col gap-2">
        {rings.map((ring) => (
          <li key={ring.label} className="flex items-center gap-2 text-base text-[#1E2522]">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: ring.color }} aria-hidden="true" />
            <span className="text-[#545C57]">{ring.label}</span>
            <span className="font-semibold tabular-nums">{Math.round(ring.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- BarChart */

export interface BarDatum {
  label: string;
  value: number;
  highlight?: boolean;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /** Draws each bar as a solid 3D block with a top and side face. */
  depth?: boolean;
  color?: string;
  formatValue?: (n: number) => string;
  className?: string;
  label?: string;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * amount);
  const g = clamp(((n >> 8) & 255) * amount);
  const b = clamp((n & 255) * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function BarChart({
  data,
  height = 180,
  depth = false,
  color = "#1F5F5B",
  formatValue = (n) => String(n),
  className,
  label = "Bar chart",
}: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 28;
  const step = 48;
  const d = depth ? 8 : 0;
  const top = 24 + d;
  const bottom = 24;
  const width = data.length * step + d + 8;
  const plot = height - top - bottom;

  return (
    <svg
      className={cn("w-full", className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${label}: ${data.map((x) => `${x.label} ${formatValue(x.value)}`).join(", ")}`}
    >
      <line x1={0} x2={width} y1={height - bottom} y2={height - bottom} stroke="#DDD8CE" />
      {data.map((datum, i) => {
        const h = Math.max(2, (datum.value / max) * plot);
        const x = 8 + i * step;
        const y = height - bottom - h;
        const fill = datum.highlight ? "#8A5A10" : color;
        return (
          <g key={datum.label}>
            {depth && (
              <>
                <polygon points={`${x},${y} ${x + d},${y - d} ${x + barW + d},${y - d} ${x + barW},${y}`} fill={shade(fill, 1.35)} />
                <polygon
                  points={`${x + barW},${y} ${x + barW + d},${y - d} ${x + barW + d},${height - bottom - d} ${x + barW},${height - bottom}`}
                  fill={shade(fill, 0.7)}
                />
              </>
            )}
            <rect x={x} y={y} width={barW} height={h} fill={fill} rx={depth ? 0 : 4} />
            <text x={x + barW / 2} y={y - d - 6} textAnchor="middle" fontSize="11" fontWeight={600} fill="#1E2522">
              {formatValue(datum.value)}
            </text>
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#545C57">
              {datum.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
