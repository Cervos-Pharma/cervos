import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const WS_ACCOUNT_COOKIE = "cervos_ws_acct";
export const WS_PROFILE_COOKIE = "cervos_ws_prof";
export const WS_TRUSTED_COOKIE = "cervos_trusted_browser";

export const WORKSPACE_ACCOUNT_TTL_SEC = 60 * 60 * 12;
export const WORKSPACE_PROFILE_TTL_SEC = 60 * 60 * 8;
export const WORKSPACE_TRUSTED_TTL_SEC = 60 * 60 * 24 * 30;

const g = globalThis as unknown as { __cervosRuntimeSecret?: string };

function isPlaceholderSecret(val: string): boolean {
  return /REPLACE-WITH|YOUR-|placeholder/i.test(val);
}

export function isSigningSecretConfigured(): boolean {
  const candidates = [
    process.env.WORKSPACE_SESSION_SECRET,
    process.env.HQ_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ];
  return candidates.some((v) => {
    const t = (v ?? "").trim();
    return t.length >= 24 && !isPlaceholderSecret(t);
  });
}

function getSigningSecret(): string {
  const candidates = [
    process.env.WORKSPACE_SESSION_SECRET,
    process.env.HQ_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ];
  for (const raw of candidates) {
    const trimmed = (raw ?? "").trim();
    if (trimmed.length >= 24 && !isPlaceholderSecret(trimmed)) {
      return trimmed;
    }
  }
  if (!g.__cervosRuntimeSecret) {
    g.__cervosRuntimeSecret =
      process.env.NODE_ENV === "production"
        ? randomBytes(32).toString("hex")
        : "cervos-local-dev-workspace-hmac-key-2026";
  }
  return g.__cervosRuntimeSecret;
}

export interface WorkspaceAccountTokenPayload {
  accountId: string;
  email: string;
  loginProfileId?: string;
  exp: number;
}

export interface WorkspaceProfileTokenPayload {
  accountId: string;
  centreId: string;
  profileId: string;
  role: string;
  exp: number;
}

export interface TrustedBrowserPayload {
  accountId: string;
  uaHash: string;
  exp: number;
}

export function computeUserAgentHash(userAgent: string): string {
  return createHash("sha256").update(userAgent || "unknown-ua").digest("hex").slice(0, 24);
}

function signPayload(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getSigningSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyToken<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = createHmac("sha256", getSigningSecret()).update(encoded).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
    if (!decoded || typeof decoded.exp !== "number") return null;
    if (Math.floor(Date.now() / 1000) > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function createAccountCookieValue(
  accountId: string,
  email: string,
  ttlSec = WORKSPACE_ACCOUNT_TTL_SEC,
  loginProfileId?: string
): string {
  return signPayload({
    accountId,
    email,
    ...(loginProfileId ? { loginProfileId } : {}),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  } satisfies WorkspaceAccountTokenPayload);
}

export function readAccountCookieValue(token: string | undefined): WorkspaceAccountTokenPayload | null {
  return verifyToken<WorkspaceAccountTokenPayload>(token);
}

export function createProfileCookieValue(
  accountId: string,
  centreId: string,
  profileId: string,
  role: string,
  ttlSec = 60 * 60 * 8
): string {
  return signPayload({
    accountId,
    centreId,
    profileId,
    role,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  } satisfies WorkspaceProfileTokenPayload);
}

export function readProfileCookieValue(token: string | undefined): WorkspaceProfileTokenPayload | null {
  return verifyToken<WorkspaceProfileTokenPayload>(token);
}

export function createTrustedBrowserCookieValue(
  accountId: string,
  userAgent: string,
  ttlSec = 60 * 60 * 24 * 30
): string {
  return signPayload({
    accountId,
    uaHash: computeUserAgentHash(userAgent),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  } satisfies TrustedBrowserPayload);
}

export function isTrustedBrowserCookieValid(
  token: string | undefined,
  accountId: string,
  userAgent: string
): boolean {
  const payload = verifyToken<TrustedBrowserPayload>(token);
  if (!payload) return false;
  return payload.accountId === accountId && payload.uaHash === computeUserAgentHash(userAgent);
}
