---
name: Cervos Pharma OS
description: Unified clinical light Material-3 design system for Web Control Plane, Pharmacy POS, and Connected Ecosystem portals
colors:
  primary: "#1039b9"
  primary-variant: "#0d2e94"
  primary-container: "#3454d1"
  on-primary: "#ffffff"
  primary-fixed: "#dde1ff"
  secondary: "#006875"
  on-secondary: "#ffffff"
  secondary-fixed: "#9cf0ff"
  tertiary: "#00542c"
  on-tertiary: "#ffffff"
  tertiary-fixed: "#75fca7"
  surface: "#fcf8ff"
  surface-base: "#ffffff"
  surface-container-low: "#f5f2ff"
  surface-container: "#efecff"
  surface-container-high: "#e8e5ff"
  surface-variant: "#e2e0fc"
  on-surface: "#1a1a2e"
  on-surface-variant: "#444654"
  outline: "#747685"
  outline-variant: "#c4c5d6"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-variant}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
---

# DESIGN.md — Cervos Pharma OS

## Overview

Cervos OS operates in **Operate mode**: interfaces stay calm, scannable, tactile, and consistent across all eight stakeholder modes. Visual restraint earns speed and clinical trust—eliminating the mismatched dark-purple supplier dashboard and ad-hoc prototype styling from earlier iterations.

## Colors

- **Primary Action (`#1039b9`):** Reserved strictly for the single primary action per view, active navigation states, and key interactive emphasis. Hover darkens to `#0d2e94` (`primary-variant`).
- **Clinical Secondary (`#006875`):** Prescribing, intelligence telemetry, and connected supply-chain flows.
- **Verified Safe (`#00542c` / `#75fca7`):** Verified batches, active stock, TMDA-cleared lots, and balanced cash shifts.
- **Alert & Clinical Hold (`#ba1a1a` / `#ffdad6`):** Expired/recalled batches, Schedule IV holds, and security warnings.
- **Layered Light Surfaces (`#fcf8ff` -> `#ffffff` -> `#f5f2ff` -> `#efecff`):** Contrast separation relies on gentle tonal stepping and subtle `1px solid #c4c5d6` borders rather than heavy shadows.

## Typography

- **Headers (`Outfit`)** & **Operational UI (`Inter`)** with system fallbacks and single-root font smoothing (`antialiased`).
- **Tabular Numerals (`font-variant-numeric: tabular-nums`):** Mandatory on every TZS price, stock quantity, expiry countdown, shift balance, and analytics metric via `<Money />` and `tabular-nums`.
- **JetBrains Mono (`font-mono`):** Reserved exclusively for batch numbers, GTIN/GS1 strings, `claim_token` codes, and SKU identifiers.

## Layout

- **Unified Workspace Chrome + `Cmd+K` Omnibar:** Shared top context & command bar lets authorized users switch stakeholder lenses seamlessly without dead-end redirects.
- **Mobile & Narrow Viewport Guardrails:** Flex containers use `min-w-0`, grid tracks use `minmax(0, 1fr)`, full-height drawers use `100dvh`, and scrollable modals apply `overscroll-behavior: contain`.

## Elevation & Depth

- Restrained offset shadows paired with `border: 1px solid transparent` (for forced-colors accessibility). Zero decorative blurred ambient halos or hard neobrutalist block shadows on app screens.

## Shapes

- Crisp modern geometry (`0.5rem` standard cards/buttons, `0.75rem` panels, optional `.custom-notch` / `.custom-notch-sm` signature cut on key marketing/HUD surfaces). Inner radius plus padding equals outer radius on nested panels.

## Components

- `<Money />`: Formats `TZS 12,500` uniformly (`tabular-nums`). Never concatenates `$` or mixes `TSh`.
- `<ExpiryBadge />`: Pairs semantic color with crisp icon and explicit label (`Expired`, `Expiring Soon`, `Verified Safe`, `Quarantined`). Never communicates status by color alone.
- `<ConfirmModal />`: Native accessible replacement for forbidden `window.confirm()` / `window.alert()`.
- `<CervosCommandBar />`: Keyboard-first `Cmd+K` / `Ctrl+K` switcher spanning all 8 stakeholder portals and search actions.
- Interactive press feedback: `active:scale-[0.96]` on enabled buttons over `150ms ease-out`, respecting `prefers-reduced-motion`.

## Do's and Don'ts

- **Do:** Keep one primary filled action per screen, group related metrics with generous spacing, and pair every truncated value with full-text visibility.
- **Don't:** Introduce dark-purple off-brand dashboards, eyebrow kickers, gradient text, CSS `transition-all`, unguarded `100vw`, or blocking browser `alert`/`prompt`/`confirm`.

