import { createHash, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { clientIpFrom } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  clearFailedAttempts,
  hasInjectionSignature,
  recordFailedAttempt,
  sanitizeText,
} from "@/lib/security/harness";
import {
  deriveAdminSessionToken,
  extractHqTokenFromRequest,
  getHqSigningSecret,
  HQ_COOKIE_NAME,
  HQ_OP_COOKIE,
  isHqMockMode,
  isHqSecretConfigured,
  isValidHQToken,
  verifyHqPortalGateSlug,
  verifyHQSecretInput,
} from "@/lib/hq-auth";
import { noStoreJson } from "@/lib/workspace/cookies";
import { parseJsonObject } from "@/lib/workspace/request-auth";

const COOKIE_MAX_AGE = 60 * 60 * 8;

function verifyChallengePin(supplied: unknown): boolean {
  const expected = (process.env.HQ_OPERATOR_PIN ?? "").trim();
  if (!expected) return true;
  const candidate = typeof supplied === "string" ? supplied.trim() : "";
  if (!candidate) return false;
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function verifyScryptHash(password: string, stored: string): boolean {
  try {
    const [algo, nStr, rStr, pStr, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt" || !nStr || !rStr || !pStr || !saltB64 || !hashB64) return false;
    const derived = scryptSync(password, Buffer.from(saltB64, "base64"), 64, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
      maxmem: 64 * 1024 * 1024,
    });
    const expected = Buffer.from(hashB64, "base64");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

async function verifyOpsEmailCredentials(email: string, password: string): Promise<{ ok: boolean; operatorLabel?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) return { ok: false };

  const envEmail = (process.env.HQ_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const envHash = (process.env.HQ_ADMIN_HASH ?? "").trim();
  if (envEmail && envHash && envEmail === cleanEmail && verifyScryptHash(password, envHash)) {
    return { ok: true, operatorLabel: cleanEmail };
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = await createServiceClient();
      const { data: admin } = await supabase
        .from("hq_admins")
        .select("id, email, password_hash, name, role, disabled")
        .eq("email", cleanEmail)
        .maybeSingle();
      if (admin && !admin.disabled && typeof admin.password_hash === "string") {
        if (verifyScryptHash(password, admin.password_hash)) {
          return { ok: true, operatorLabel: admin.name || admin.email };
        }
      }
    } catch {
      // Fall through to failure
    }
  }
  return { ok: false };
}

function setOpsCookies(res: ReturnType<typeof noStoreJson>, token: string, operatorLabel: string) {
  res.cookies.set(HQ_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  res.cookies.set(HQ_OP_COOKIE, operatorLabel.slice(0, 120), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function GET(request: NextRequest) {
  const token = extractHqTokenFromRequest(
    request.headers,
    request.cookies.get(HQ_COOKIE_NAME)?.value
  );
  const mockMode = isHqMockMode();
  const authenticated = isValidHQToken(token);
  const operator =
    sanitizeText(request.cookies.get(HQ_OP_COOKIE)?.value, 80) ||
    (mockMode ? "Ops Sandbox Desk" : "Ops Clearance Unit");

  return noStoreJson({
    authenticated,
    mockMode,
    secretConfigured: isHqSecretConfigured(),
    challengeRequired: Boolean((process.env.HQ_OPERATOR_PIN ?? "").trim()),
    operator,
  });
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonObject(request, "Invalid JSON payload.");
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const action = sanitizeText(body.action, 32) || "login";
  const clientIp = clientIpFrom(request);
  const wantsBearerToken =
    request.headers.get("x-ops-mode")?.toLowerCase() === "bearer" || body.clientMode === "bearer";

  if (action === "logout") {
    const res = noStoreJson({ ok: true });
    res.cookies.delete(HQ_COOKIE_NAME);
    res.cookies.delete(HQ_OP_COOKIE);
    return res;
  }

  // Gate verification ensures login attempts cannot bypass the obfuscated portal slug.
  const suppliedGate =
    request.headers.get("x-ops-gate")?.trim() ||
    (typeof body.gateSlug === "string" ? body.gateSlug.trim() : "");
  const hasSecretHeader = Boolean(request.headers.get("x-ops-key")?.trim());

  if (!hasSecretHeader && !verifyHqPortalGateSlug(suppliedGate)) {
    return noStoreJson({ error: "Not found" }, { status: 404 });
  }

  if (action === "demo_enter") {
    if (!isHqMockMode()) {
      return noStoreJson({ error: "Sandbox clearance disabled." }, { status: 403 });
    }
    const operatorName = sanitizeText(body.operatorName, 80) || "Ops Sandbox Desk";
    const secret = getHqSigningSecret()!;
    const token = deriveAdminSessionToken(secret, "mock-ops", "ops_admin");
    const res = noStoreJson(
      wantsBearerToken
        ? { ok: true, operator: operatorName, token, expiresInSec: COOKIE_MAX_AGE }
        : { ok: true, operator: operatorName }
    );
    if (!wantsBearerToken) {
      setOpsCookies(res, token, operatorName);
    }
    return res;
  }

  if (action === "login" || action === "login_credentials") {
    const limit = checkRateLimit(`ops-auth:${clientIp}`, 6, 15 * 60 * 1000, 15 * 60 * 1000);
    if (!limit.allowed) {
      return noStoreJson(
        { error: `Clearance temporarily throttled. Retry in ${limit.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    if (hasInjectionSignature(body.operatorName) || hasInjectionSignature(body.email)) {
      return noStoreJson({ error: "Unsupported characters in credentials." }, { status: 400 });
    }

    if (!getHqSigningSecret()) {
      return noStoreJson(
        { error: "Server clearance secret is not configured (min 32 characters)." },
        { status: 503 }
      );
    }

    let operatorName = sanitizeText(body.operatorName, 80) || "Ops Clearance Unit";
    if (action === "login_credentials") {
      const email = sanitizeText(body.email, 160);
      const password = typeof body.password === "string" ? body.password : "";
      const credCheck = await verifyOpsEmailCredentials(email, password);
      if (!credCheck.ok || !verifyChallengePin(body.challengePin)) {
        recordFailedAttempt(`ops-auth:${clientIp}`, 6, 15 * 60 * 1000, 15 * 60 * 1000);
        return noStoreJson({ error: "Operator credentials rejected." }, { status: 401 });
      }
      operatorName = credCheck.operatorLabel || email;
    } else {
      const suppliedSecret =
        request.headers.get("x-ops-key")?.trim() ||
        (typeof body.secret === "string" ? body.secret : "");
      if (!verifyHQSecretInput(suppliedSecret) || !verifyChallengePin(body.challengePin)) {
        recordFailedAttempt(`ops-auth:${clientIp}`, 6, 15 * 60 * 1000, 15 * 60 * 1000);
        return noStoreJson({ error: "Clearance rejected." }, { status: 401 });
      }
    }

    clearFailedAttempts(`ops-auth:${clientIp}`);
    const secret = getHqSigningSecret()!;
    const adminSlug =
      operatorName
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 24) || "opsadmin";
    const token = deriveAdminSessionToken(secret, adminSlug, "ops_admin");
    const res = noStoreJson(
      wantsBearerToken
        ? { ok: true, operator: operatorName, token, expiresInSec: COOKIE_MAX_AGE }
        : { ok: true, operator: operatorName }
    );
    if (!wantsBearerToken) {
      setOpsCookies(res, token, operatorName);
    }
    return res;
  }

  return noStoreJson({ error: "Unsupported ops session action." }, { status: 400 });
}
