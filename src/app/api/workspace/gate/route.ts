import type { NextRequest } from "next/server";
import {
  checkRateLimit,
  clearFailedAttempts,
  normalizeSecurityAnswer,
  recordFailedAttempt,
  sanitizeText,
  validatePinPolicy,
  verifySecret,
} from "@/lib/security/harness";
import {
  createProfileCookieValue,
  createTrustedBrowserCookieValue,
  WORKSPACE_PROFILE_TTL_SEC,
  WORKSPACE_TRUSTED_TTL_SEC,
  WS_PROFILE_COOKIE,
  WS_TRUSTED_COOKIE,
} from "@/lib/security/session";
import {
  appendAuditLog,
  destinationForProfileRole,
  getWorkspaceDb,
  saveWorkspaceDb,
} from "@/lib/workspace/store";
import { noStoreJson, setHttpCookie } from "@/lib/workspace/cookies";
import {
  isBearerClientRequest,
  parseJsonObject,
  readWorkspaceAccountToken,
} from "@/lib/workspace/request-auth";

export async function POST(request: NextRequest) {
  const session = readWorkspaceAccountToken(request);
  if (!session) {
    return noStoreJson({ error: "Account authentication required." }, { status: 401 });
  }
  if (session.accountId.startsWith("joinreq:")) {
    return noStoreJson({ error: "Complete team allocation in the Lounge first." }, { status: 403 });
  }

  const parsed = await parseJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const bearerMode = isBearerClientRequest(request, body);

  const action = sanitizeText(body.action, 32);
  const db = getWorkspaceDb();
  const account = db.accounts.find((a) => a.id === session.accountId);
  if (!account) {
    return noStoreJson({ error: "Account not found." }, { status: 404 });
  }

  if (action === "lock_profile") {
    const res = noStoreJson({ ok: true, redirectTo: "/app/gate?stage=profile" });
    res.cookies.delete(WS_PROFILE_COOKIE);
    return res;
  }

  if (action === "verify_security") {
    const key = `secq:${account.id}`;
    const limit = checkRateLimit(key, 5, 10 * 60 * 1000, 5 * 60 * 1000);
    if (!limit.allowed) {
      return noStoreJson(
        { error: `Too many failed checks. Wait ${limit.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const answer = normalizeSecurityAnswer(body.answer);
    if (!answer || !verifySecret(answer, account.securityAnswerHash)) {
      const rec = recordFailedAttempt(key, 5, 10 * 60 * 1000, 5 * 60 * 1000);
      return noStoreJson(
        {
          error: rec.locked
            ? `Security gate locked for ${rec.retryAfterSec}s.`
            : "Security answer does not match.",
        },
        { status: rec.locked ? 429 : 401 }
      );
    }

    clearFailedAttempts(key);
    const ownerProfile =
      db.profiles.find((p) => p.accountId === account.id && p.isMasterAdmin) ??
      db.profiles.find((p) => p.accountId === account.id);
    // Bind directUnlock strictly to the authenticated loginProfileId when present so
    // non-admin staff can never escalate to the master owner profile via security answer.
    const unlockTarget = session.loginProfileId
      ? db.profiles.find((p) => p.id === session.loginProfileId && p.accountId === account.id) ?? null
      : ownerProfile ?? null;

    const redirectTo =
      body.directUnlock && unlockTarget
        ? destinationForProfileRole(unlockTarget.role, unlockTarget.isMasterAdmin)
        : undefined;

    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockTarget?.displayName || account.fullName,
      category: "SECURITY",
      action: body.rememberBrowser
        ? "Passed security question & trusted browser for 30 days"
        : "Passed security question challenge",
    });
    saveWorkspaceDb(db);

    const profileToken =
      body.directUnlock && unlockTarget
        ? createProfileCookieValue(account.id, unlockTarget.centreId, unlockTarget.id, unlockTarget.role)
        : undefined;
    const trustToken = body.rememberBrowser
      ? createTrustedBrowserCookieValue(account.id, request.headers.get("user-agent") || "")
      : undefined;

    const res = noStoreJson({
      ok: true,
      nextStage: "centre",
      redirectTo,
      ...(bearerMode && (profileToken || trustToken)
        ? {
            tokens: {
              ...(profileToken ? { profileToken } : {}),
              ...(trustToken ? { trustToken } : {}),
              expiresInSec: WORKSPACE_PROFILE_TTL_SEC,
            },
          }
        : {}),
    });
    if (profileToken) {
      setHttpCookie(res, WS_PROFILE_COOKIE, profileToken, WORKSPACE_PROFILE_TTL_SEC);
    }
    if (trustToken) {
      setHttpCookie(res, WS_TRUSTED_COOKIE, trustToken, WORKSPACE_TRUSTED_TTL_SEC);
    }
    return res;
  }

  if (action === "unlock_profile") {
    const profileId = sanitizeText(body.profileId, 80);
    const centreId = sanitizeText(body.centreId, 80);
    const pinRaw = typeof body.pin === "string" ? body.pin.trim() : "";

    const key = `pin:${account.id}:${profileId}`;
    const limit = checkRateLimit(key, 5, 10 * 60 * 1000, 3 * 60 * 1000);
    if (!limit.allowed) {
      return noStoreJson(
        { error: `Too many wrong PINs. Wait ${limit.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const profile = db.profiles.find(
      (p) => p.id === profileId && p.accountId === account.id && (!centreId || p.centreId === centreId)
    );
    if (!profile) {
      return noStoreJson({ error: "Selected profile not found." }, { status: 404 });
    }

    if (!/^\d{4,6}$/.test(pinRaw) || !verifySecret(pinRaw, profile.pinHash)) {
      const rec = recordFailedAttempt(key, 5, 10 * 60 * 1000, 3 * 60 * 1000);
      return noStoreJson(
        {
          error: rec.locked
            ? `Profile locked for ${rec.retryAfterSec}s.`
            : "Incorrect PIN. Please try again.",
        },
        { status: rec.locked ? 429 : 401 }
      );
    }

    const pinPolicyCheck = validatePinPolicy(pinRaw);
    void pinPolicyCheck;

    clearFailedAttempts(key);
    appendAuditLog(db, {
      accountId: account.id,
      actor: profile.displayName,
      category: "SECURITY",
      action: `Unlocked profile (${profile.role.replace(/_/g, " ")})`,
    });
    saveWorkspaceDb(db);

    const profileToken = createProfileCookieValue(account.id, profile.centreId, profile.id, profile.role);
    const res = noStoreJson({
      ok: true,
      redirectTo: destinationForProfileRole(profile.role, profile.isMasterAdmin),
      ...(bearerMode
        ? { tokens: { profileToken, expiresInSec: WORKSPACE_PROFILE_TTL_SEC } }
        : {}),
    });
    setHttpCookie(res, WS_PROFILE_COOKIE, profileToken, WORKSPACE_PROFILE_TTL_SEC);
    return res;
  }

  return noStoreJson({ error: "Invalid gate action." }, { status: 400 });
}
