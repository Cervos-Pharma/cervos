import type { NextRequest } from "next/server";
import { hasInjectionSignature } from "@/lib/security/harness";
import {
  readAccountCookieValue,
  readProfileCookieValue,
  WS_ACCOUNT_COOKIE,
  WS_PROFILE_COOKIE,
  WS_TRUSTED_COOKIE,
  type WorkspaceAccountTokenPayload,
  type WorkspaceProfileTokenPayload,
} from "@/lib/security/session";
import { noStoreJson } from "@/lib/workspace/cookies";
import type { WorkspaceCustomization } from "@/lib/workspace/store";

const ALLOWED_ACCENTS = new Set(["#1039B9", "#059669", "#006875", "#C2410C", "#475569"]);
const ALLOWED_SCALES = new Set(["compact", "standard", "large"]);
const ALLOWED_LAYOUTS = new Set(["balanced", "focus", "executive"]);
const ALLOWED_THEMES = new Set(["light", "dark", "system"]);

export function extractBearerToken(request: NextRequest): string | undefined {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return undefined;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return undefined;
  const token = authHeader.slice(7).trim();
  return token || undefined;
}

export function readWorkspaceAccountToken(request: NextRequest): WorkspaceAccountTokenPayload | null {
  const cookieToken = request.cookies.get(WS_ACCOUNT_COOKIE)?.value;
  if (cookieToken) {
    const parsed = readAccountCookieValue(cookieToken);
    if (parsed) return parsed;
  }
  const bearer = extractBearerToken(request);
  if (bearer) {
    return readAccountCookieValue(bearer);
  }
  return null;
}

export function readWorkspaceProfileToken(request: NextRequest): WorkspaceProfileTokenPayload | null {
  const cookieToken = request.cookies.get(WS_PROFILE_COOKIE)?.value;
  if (cookieToken) {
    const parsed = readProfileCookieValue(cookieToken);
    if (parsed) return parsed;
  }
  const headerToken = request.headers.get("x-workspace-profile")?.trim();
  if (headerToken) {
    return readProfileCookieValue(headerToken);
  }
  return null;
}

export function readWorkspaceTrustedToken(request: NextRequest): string | undefined {
  return request.cookies.get(WS_TRUSTED_COOKIE)?.value || request.headers.get("x-workspace-trusted")?.trim() || undefined;
}

export function isBearerClientRequest(request: NextRequest, body?: Record<string, unknown>): boolean {
  if (body && body.clientMode === "bearer") return true;
  const header = (request.headers.get("x-cervos-client") || "").trim().toLowerCase();
  return header === "bearer" || header === "mobile" || header === "expo";
}

export async function parseJsonObject(
  request: NextRequest,
  invalidMessage = "Invalid request payload."
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: ReturnType<typeof noStoreJson> }> {
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, response: noStoreJson({ error: invalidMessage }, { status: 400 }) };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: noStoreJson({ error: invalidMessage }, { status: 400 }) };
  }
}

export function hasAnyInjection(values: unknown[]): boolean {
  return values.some((v) => hasInjectionSignature(v));
}

export function isSafeRasterDataUrl(value: unknown, maxLen = 450000): value is string {
  return (
    typeof value === "string" &&
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value) &&
    value.length <= maxLen
  );
}

export function sanitizeBatchImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return undefined;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (isSafeRasterDataUrl(trimmed, 450000)) return trimmed;
  return undefined;
}

export function sanitizeBrandCustomization(
  rawCust: Record<string, unknown>,
  prev: WorkspaceCustomization = {},
  clearLogo = false
): WorkspaceCustomization {
  const safeLogo = clearLogo
    ? undefined
    : isSafeRasterDataUrl(rawCust.brandLogoUrl, 450000)
      ? rawCust.brandLogoUrl
      : prev.brandLogoUrl;

  return {
    brandLogoUrl: safeLogo,
    brandAccent:
      typeof rawCust.brandAccent === "string" && ALLOWED_ACCENTS.has(rawCust.brandAccent)
        ? rawCust.brandAccent
        : prev.brandAccent || "#1039B9",
    fontScale:
      typeof rawCust.fontScale === "string" && ALLOWED_SCALES.has(rawCust.fontScale)
        ? (rawCust.fontScale as "compact" | "standard" | "large")
        : prev.fontScale || "standard",
    layoutType:
      typeof rawCust.layoutType === "string" && ALLOWED_LAYOUTS.has(rawCust.layoutType)
        ? (rawCust.layoutType as "balanced" | "focus" | "executive")
        : prev.layoutType || "balanced",
    themePref:
      typeof rawCust.themePref === "string" && ALLOWED_THEMES.has(rawCust.themePref)
        ? (rawCust.themePref as "light" | "dark" | "system")
        : prev.themePref || "light",
  };
}
