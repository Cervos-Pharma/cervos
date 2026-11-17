import type { NextRequest } from "next/server";
import { clientIpFrom } from "@/lib/rate-limit";
import {
  consumeWebAuthnChallenge,
  issueWebAuthnChallenge,
  verifyPasskeyAssertion,
} from "@/lib/security/webauthn";
import { checkRateLimit, clearFailedAttempts, recordFailedAttempt, sanitizeText, validateEmailSafe } from "@/lib/security/harness";
import {
  createAccountCookieValue,
  createProfileCookieValue,
  WORKSPACE_ACCOUNT_TTL_SEC,
  WORKSPACE_PROFILE_TTL_SEC,
  WS_ACCOUNT_COOKIE,
  WS_PROFILE_COOKIE,
} from "@/lib/security/session";
import {
  appendAuditLog,
  flushWorkspaceDb,
  getWorkspaceDb,
  saveWorkspaceDb,
  warmDbFromSupabase,
} from "@/lib/workspace/store";
import { noStoreJson, setHttpCookie } from "@/lib/workspace/cookies";
import {
  hasAnyInjection,
  isBearerClientRequest,
  parseJsonObject,
  readWorkspaceAccountToken,
} from "@/lib/workspace/request-auth";

export async function GET(request: NextRequest) {
  await warmDbFromSupabase(true);
  const purposeParam = sanitizeText(request.nextUrl.searchParams.get("purpose"), 16);
  const purpose =
    purposeParam === "register" || purposeParam === "unlock" ? purposeParam : "login";

  const accountSession = readWorkspaceAccountToken(request);
  if (
    (purpose === "register" || purpose === "unlock") &&
    (!accountSession || accountSession.accountId.startsWith("joinreq:"))
  ) {
    return noStoreJson({ error: "Sign in first to use passkey actions." }, { status: 401 });
  }

  const db = getWorkspaceDb();
  const allowCredentialIds =
    accountSession && !accountSession.accountId.startsWith("joinreq:")
      ? db.passkeys.filter((p) => p.accountId === accountSession.accountId).map((p) => p.credentialId)
      : [];

  const issued = issueWebAuthnChallenge(purpose, accountSession?.accountId);
  return noStoreJson({
    ...issued,
    rpName: "Cervos Pharma",
    allowCredentialIds,
  });
}

export async function POST(request: NextRequest) {
  await warmDbFromSupabase(true);
  const parsed = await parseJsonObject(request, "Invalid passkey request.");
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const bearerMode = isBearerClientRequest(request, body);

  const action = sanitizeText(body.action, 24);
  const challengeId = sanitizeText(body.challengeId, 64);
  const db = getWorkspaceDb();

  if (action === "register") {
    const accountSession = readWorkspaceAccountToken(request);
    if (!accountSession || accountSession.accountId.startsWith("joinreq:")) {
      return noStoreJson({ error: "Not authenticated." }, { status: 401 });
    }
    const pending = consumeWebAuthnChallenge(challengeId, "register");
    if (!pending || pending.accountId !== accountSession.accountId) {
      return noStoreJson({ error: "Passkey registration challenge expired." }, { status: 400 });
    }

    if (hasAnyInjection([body.label, body.credentialId, body.profileId])) {
      return noStoreJson({ error: "Invalid passkey metadata." }, { status: 400 });
    }

    const credentialId = sanitizeText(body.credentialId, 300);
    const publicKeySpkiBase64 = sanitizeText(body.publicKeySpkiBase64, 800);
    const label = sanitizeText(body.label, 80) || "This Device Passkey";
    const requestedProfileId = sanitizeText(body.profileId, 80) || undefined;

    if (
      requestedProfileId &&
      !db.profiles.some((p) => p.id === requestedProfileId && p.accountId === accountSession.accountId)
    ) {
      return noStoreJson({ error: "Profile not found on this account." }, { status: 403 });
    }

    if (!credentialId || !publicKeySpkiBase64) {
      return noStoreJson(
        { error: "Browser passkey public key missing. Ensure platform biometrics are available." },
        { status: 400 }
      );
    }

    const existing = db.passkeys.findIndex((p) => p.credentialId === credentialId);
    const rec = {
      credentialId,
      accountId: accountSession.accountId,
      profileId: requestedProfileId,
      label,
      publicKeySpkiBase64,
      createdAt: new Date().toISOString(),
    };
    if (existing >= 0) db.passkeys[existing] = rec;
    else db.passkeys.push(rec);
    appendAuditLog(db, {
      accountId: accountSession.accountId,
      actor: label,
      category: "SECURITY",
      action: `Enrolled biometric passkey (${label})`,
    });
    saveWorkspaceDb(db);
    await flushWorkspaceDb();

    return noStoreJson({ ok: true, passkey: { credentialId, label, profileId: requestedProfileId } });
  }

  if (action === "login" || action === "unlock") {
    const clientIp = clientIpFrom(request);
    const rateKey = `passkey:${action}:${clientIp}`;
    const limit = checkRateLimit(rateKey, 10, 10 * 60 * 1000, 5 * 60 * 1000);
    if (!limit.allowed) {
      return noStoreJson(
        { error: `Too many passkey attempts. Wait ${limit.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const accountSession = action === "unlock" ? readWorkspaceAccountToken(request) : null;
    if (action === "unlock" && (!accountSession || accountSession.accountId.startsWith("joinreq:"))) {
      return noStoreJson({ error: "Account authentication required." }, { status: 401 });
    }

    const pending = consumeWebAuthnChallenge(challengeId, action);
    if (!pending) {
      return noStoreJson({ error: "Passkey challenge expired." }, { status: 400 });
    }
    if (action === "unlock" && pending.accountId !== accountSession!.accountId) {
      return noStoreJson({ error: "Passkey challenge does not match signed-in account." }, { status: 403 });
    }

    const credentialId = sanitizeText(body.credentialId, 300);
    const matched = db.passkeys.find((p) => p.credentialId === credentialId);
    if (!matched) {
      recordFailedAttempt(rateKey, 10, 10 * 60 * 1000, 5 * 60 * 1000);
      return noStoreJson({ error: "Passkey not recognized on this account." }, { status: 401 });
    }
    if (action === "unlock" && matched.accountId !== accountSession!.accountId) {
      recordFailedAttempt(rateKey, 10, 10 * 60 * 1000, 5 * 60 * 1000);
      return noStoreJson({ error: "Passkey does not belong to this workspace account." }, { status: 403 });
    }

    const originHeader = request.headers.get("origin") || request.nextUrl.origin;
    const validSig = verifyPasskeyAssertion({
      publicKeySpkiBase64: matched.publicKeySpkiBase64,
      authenticatorDataB64u: String(body.authenticatorDataB64u ?? ""),
      clientDataJsonB64u: String(body.clientDataJsonB64u ?? ""),
      signatureB64u: String(body.signatureB64u ?? ""),
      expectedChallenge: pending.challenge,
      expectedOrigin: originHeader,
    });

    if (!validSig) {
      recordFailedAttempt(rateKey, 10, 10 * 60 * 1000, 5 * 60 * 1000);
      return noStoreJson({ error: "Biometric signature verification failed." }, { status: 401 });
    }

    const account = db.accounts.find((a) => a.id === matched.accountId);
    if (!account) {
      return noStoreJson({ error: "Account not found." }, { status: 404 });
    }

    clearFailedAttempts(rateKey);

    if (action === "login") {
      if (body.email) {
        const emailCheck = validateEmailSafe(body.email);
        if (emailCheck.ok && emailCheck.email !== account.email) {
          return noStoreJson({ error: "Passkey does not match email." }, { status: 401 });
        }
      }
      const linkedProfile = matched.profileId
        ? db.profiles.find((p) => p.id === matched.profileId && p.accountId === account.id)
        : db.profiles.find((p) => p.accountId === account.id && p.isMasterAdmin) ??
          db.profiles.find((p) => p.accountId === account.id);

      const accountToken = createAccountCookieValue(
        account.id,
        account.email,
        WORKSPACE_ACCOUNT_TTL_SEC,
        linkedProfile?.id
      );
      const res = noStoreJson({
        ok: true,
        redirectTo: account.onboardingDone ? "/app/gate?stage=centre" : "/app/onboarding",
        ...(bearerMode ? { tokens: { accountToken, expiresInSec: WORKSPACE_ACCOUNT_TTL_SEC } } : {}),
      });
      setHttpCookie(res, WS_ACCOUNT_COOKIE, accountToken, WORKSPACE_ACCOUNT_TTL_SEC);
      return res;
    }

    const requestedProfileId = matched.profileId ?? sanitizeText(body.profileId, 80);
    const targetProfile =
      db.profiles.find((p) => p.id === requestedProfileId && p.accountId === account.id) ??
      db.profiles.find((p) => p.accountId === account.id);
    if (!targetProfile) {
      return noStoreJson({ error: "No profile linked to passkey." }, { status: 404 });
    }

    const profileToken = createProfileCookieValue(
      account.id,
      targetProfile.centreId,
      targetProfile.id,
      targetProfile.role
    );
    const res = noStoreJson({
      ok: true,
      redirectTo: "/app",
      ...(bearerMode ? { tokens: { profileToken, expiresInSec: WORKSPACE_PROFILE_TTL_SEC } } : {}),
    });
    setHttpCookie(res, WS_PROFILE_COOKIE, profileToken, WORKSPACE_PROFILE_TTL_SEC);
    return res;
  }

  return noStoreJson({ error: "Unsupported passkey action." }, { status: 400 });
}
