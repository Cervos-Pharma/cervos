/**
 * @file lib/hq-auth.ts
 * @description Isolated Operations Command Portal authentication helpers.
 *
 * Strictly separated from pharmacy/supplier tenant authentication:
 *  - Uses obfuscated session cookie (`cv_ops_k9`) and operator cookie (`cv_ops_op`),
 *    never sharing `cervos_ws_acct`, `cervos_ws_prof`, or tenant Supabase sessions.
 *  - Requires a non-obvious portal gate slug (`HQ_PORTAL_GATE` or HMAC-derived gate)
 *    before exposing even the sign-in challenge.
 *  - Never bypasses token validation when mock mode is enabled: unauthenticated
 *    requests (`token === undefined`) always return false.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { sanitizeHqRole, type HqWorkerRole } from "@/lib/hq-workers";

export const HQ_COOKIE_NAME = "cv_ops_k9";
export const HQ_OP_COOKIE = "cv_ops_op";
export const OPS_PORTAL_PREFIX = "/ops-v9k4m";
export const OPS_API_PREFIX = "/api/ops-v9k4m";

const PLACEHOLDER = "placeholder-hq-secret";
const MOCK_HQ_FALLBACK_SECRET = "mock-hq-secret-for-local-demo-2026-xxxxxxxxxx";
const HQ_SESSION_MAX_AGE_SEC = 8 * 60 * 60;

export function isHqMockMode(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_MODE === "true" || process.env.CERVOS_MOCK_AUTH === "true";
}

export function getHQSecret(): string | undefined {
  return process.env.HQ_SECRET;
}

export function isHqSecretConfigured(): boolean {
  const secret = (process.env.HQ_SECRET ?? "").trim();
  return Boolean(
    secret &&
      secret !== PLACEHOLDER &&
      !secret.includes("REPLACE-WITH") &&
      !secret.includes("YOUR-") &&
      secret.length >= 32
  );
}

/**
 * Returns the active HMAC signing secret for ops sessions.
 * In mock mode, falls back cleanly when `HQ_SECRET` is omitted; in production returns undefined if unconfigured.
 */
export function getHqSigningSecret(): string | undefined {
  if (isHqSecretConfigured()) return (process.env.HQ_SECRET ?? "").trim();
  if (isHqMockMode()) return MOCK_HQ_FALLBACK_SECRET;
  return undefined;
}

export function verifyHQSecretInput(supplied: string | undefined): boolean {
  const configured = getHqSigningSecret();
  if (!configured) return false;
  const candidate = (supplied ?? "").trim();
  if (!candidate) return false;
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(configured, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Derives or reads the private obfuscated portal gate slug (`/ops-v9k4m/<slug>`).
 * Configure explicitly with `HQ_PORTAL_GATE` (>= 12 chars) or let the server derive
 * a stable 16-char HMAC slug from `HQ_SECRET`. Never exposed in client bundles.
 */
export function getHqPortalGateSlug(): string {
  const explicit = (process.env.HQ_PORTAL_GATE ?? "").trim();
  if (explicit && explicit.length >= 12 && !/REPLACE-WITH|placeholder/i.test(explicit)) {
    return explicit;
  }
  const secret = getHqSigningSecret() || "cervos-ops-gate-fallback-key";
  return createHmac("sha256", secret).update("cv:ops:gate:v9k4m").digest("hex").slice(0, 16);
}

export function verifyHqPortalGateSlug(candidate: string | undefined): boolean {
  const supplied = (candidate ?? "").trim();
  if (!supplied) return false;
  const expected = getHqPortalGateSlug();
  const a = createHash("sha256").update(supplied, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function deriveHQSessionToken(secret: string): string {
  return createHmac("sha256", secret).update("hq:session:v1").digest("hex");
}

export function deriveAdminSessionToken(secret: string, adminId: string, role = "hq_master"): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `v2.${adminId}.${role}.${issuedAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export interface ParsedHqSession {
  adminId: string;
  role: HqWorkerRole;
  rawRole: string;
}

export function parseHqToken(token: string | undefined): ParsedHqSession | null {
  if (!isValidHQToken(token) || !token) return null;
  if (token.startsWith("v2.")) {
    const parts = token.split(".");
    if (parts.length !== 5) return null;
    const [, adminId, rawRole] = parts;
    return {
      adminId,
      role: sanitizeHqRole(rawRole),
      rawRole,
    };
  }
  return {
    adminId: "master",
    role: "hq_master",
    rawRole: "ops_admin",
  };
}

/**
 * Extracts an ops session token from dedicated headers (`Authorization`, `X-Ops-Session`)
 * or cookie value.
 */
export function extractHqTokenFromRequest(headers: Headers, cookieVal?: string): string | undefined {
  const direct = headers.get("x-ops-session")?.trim();
  if (direct) return direct;
  const auth = headers.get("authorization")?.trim() ?? "";
  if (auth.toLowerCase().startsWith("opstoken ")) {
    return auth.slice(9).trim();
  }
  if (auth.toLowerCase().startsWith("bearer v2.")) {
    return auth.slice(7).trim();
  }
  return cookieVal?.trim() || undefined;
}

export function isValidHQToken(token: string | undefined): boolean {
  const secret = getHqSigningSecret();
  if (!secret) return false;
  if (!token) return false;

  if (token.startsWith("v2.")) {
    const parts = token.split(".");
    if (parts.length !== 5) return false;
    const [, adminId, role, issuedAtRaw, providedSig] = parts;
    const issuedAt = Number.parseInt(issuedAtRaw, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!adminId || !role || !Number.isFinite(issuedAt)) return false;
    if (issuedAt > nowSec + 60 || nowSec - issuedAt > HQ_SESSION_MAX_AGE_SEC) return false;

    const expectedSig = createHmac("sha256", secret)
      .update(`v2.${adminId}.${role}.${issuedAtRaw}`)
      .digest("hex");
    try {
      const a = Buffer.from(providedSig, "utf8");
      const b = Buffer.from(expectedSig, "utf8");
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  const expected = deriveHQSessionToken(secret);
  try {
    const a = Buffer.from(token, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
