"use client";

import React from "react";
import { cn } from "../cn";
import { Icon, type IconName } from "../icons";

/* ---------------------------------------------------------------- Button */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  busy?: boolean;
}

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-[#1F5F5B] text-white hover:bg-[#184C49] border-transparent",
  secondary: "bg-white text-[#1E2522] border-[#DDD8CE] hover:bg-[#EDEAE3]",
  ghost: "bg-transparent text-[#1E2522] border-transparent hover:bg-[#EDEAE3]",
  danger: "bg-[#A23B2F] text-white hover:bg-[#86302A] border-transparent",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-base gap-2",
  lg: "h-13 min-h-[52px] px-6 text-lg gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  busy = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-[8px] border font-semibold",
        "transition-[background-color,transform,filter] duration-150 ease-out",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5F5B]",
        "enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "lg" ? 20 : 18} />}
      <span>{busy ? "Working..." : children}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ Card */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** flat: border only. raised: soft shadow. depth: solid 3D edge. */
  elevation?: "flat" | "raised" | "depth";
  padding?: "none" | "sm" | "md" | "lg";
}

const CARD_ELEVATION = {
  flat: "border border-[#DDD8CE]",
  raised: "border border-[#DDD8CE] shadow-[0_1px_2px_rgba(30,37,34,0.06),0_2px_8px_rgba(30,37,34,0.06)]",
  depth:
    "border border-[#BEB7A9] shadow-[0_4px_0_0_#BEB7A9,0_10px_20px_-8px_rgba(30,37,34,0.18)] transition-transform duration-200 ease-out hover:-translate-y-0.5",
};

const CARD_PADDING = { none: "", sm: "p-3", md: "p-5", lg: "p-7" };

export function Card({ elevation = "flat", padding = "md", className, ...rest }: CardProps) {
  return (
    <div
      className={cn("rounded-[12px] bg-white text-[#1E2522]", CARD_ELEVATION[elevation], CARD_PADDING[padding], className)}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className="text-lg font-semibold leading-7 text-[#1E2522]">{title}</h3>
        {description && <p className="mt-0.5 text-sm leading-5 text-[#545C57]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge */

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONE: Record<Tone, string> = {
  neutral: "bg-[#EDEAE3] text-[#1E2522] border-[#DDD8CE]",
  primary: "bg-[#E2EEEC] text-[#1F5F5B] border-[#1F5F5B]/25",
  success: "bg-[#E3F0E6] text-[#2F6F45] border-[#2F6F45]/25",
  warning: "bg-[#F6EBD6] text-[#8A5A10] border-[#8A5A10]/25",
  danger: "bg-[#F6E1DD] text-[#A23B2F] border-[#A23B2F]/25",
  info: "bg-[#E1E9F3] text-[#2D5486] border-[#2D5486]/25",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Slanted ribbon shape for status labels. */
  slanted?: boolean;
  icon?: IconName;
}

export function Badge({ tone = "neutral", slanted = false, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2.5 py-1 text-sm font-semibold leading-none",
        slanted ? "-skew-x-12 rounded-[4px]" : "rounded-full",
        TONE[tone],
        className
      )}
      {...rest}
    >
      <span className={cn("inline-flex items-center gap-1.5", slanted && "skew-x-12")}>
        {icon && <Icon name={icon} size={14} strokeWidth={2} />}
        {children}
      </span>
    </span>
  );
}

/* ----------------------------------------------------------------- Input */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  icon?: IconName;
}

export function Input({ label, hint, error, icon, id, className, ...rest }: InputProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-semibold text-[#1E2522]">
        {label}
      </label>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-[8px] border bg-white px-3",
          "focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[#1F5F5B]",
          error ? "border-[#A23B2F]" : "border-[#DDD8CE]"
        )}
      >
        {icon && <Icon name={icon} size={18} className="text-[#7A817C]" />}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-full w-full bg-transparent text-base text-[#1E2522] placeholder:text-[#7A817C] focus:outline-none"
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-[#A23B2F]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-[#7A817C]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Stat */

export interface StatProps {
  label: string;
  value: React.ReactNode;
  /** Short change note, for example "+12% vs yesterday". */
  change?: string;
  trend?: "up" | "down" | "flat";
  className?: string;
}

export function Stat({ label, value, change, trend = "flat", className }: StatProps) {
  const trendColor = trend === "up" ? "text-[#2F6F45]" : trend === "down" ? "text-[#A23B2F]" : "text-[#545C57]";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-sm font-medium text-[#545C57]">{label}</span>
      <span className="text-3xl font-semibold leading-9 tracking-tight tabular-nums text-[#1E2522] sm:text-4xl sm:leading-10">
        {value}
      </span>
      {change && <span className={cn("text-sm font-medium tabular-nums", trendColor)}>{change}</span>}
    </div>
  );
}

/* --------------------------------------------------------------- Notice */

export interface NoticeProps {
  tone?: Exclude<Tone, "neutral" | "primary">;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

const NOTICE_ICON: Record<NonNullable<NoticeProps["tone"]>, IconName> = {
  success: "check",
  warning: "alert",
  danger: "alert",
  info: "info",
};

export function Notice({ tone = "info", title, children, action }: NoticeProps) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-[12px] border p-4", TONE[tone])}>
      <Icon name={NOTICE_ICON[tone]} size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-[#1E2522]/80">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({
  icon = "box",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-[#BEB7A9] bg-[#F5F3EE] px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#545C57]">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-lg font-semibold text-[#1E2522]">{title}</p>
      {description && <p className="max-w-sm text-base text-[#545C57]">{description}</p>}
      {action}
    </div>
  );
}
