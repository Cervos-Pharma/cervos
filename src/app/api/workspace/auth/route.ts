import type { NextRequest } from "next/server";
import { clientIpFrom } from "@/lib/rate-limit";
import {
  checkRateLimit,
  clearFailedAttempts,
  hasInjectionSignature,
  hashSecret,
  recordFailedAttempt,
  sanitizeText,
  validateEmailSafe,
  validatePasswordPolicy,
  validateUsernameSafe,
  verifySecret,
} from "@/lib/security/harness";
import {
  createAccountCookieValue,
  createProfileCookieValue,
  isTrustedBrowserCookieValid,
  WORKSPACE_ACCOUNT_TTL_SEC,
  WORKSPACE_PROFILE_TTL_SEC,
  WS_ACCOUNT_COOKIE,
  WS_PROFILE_COOKIE,
} from "@/lib/security/session";
import {
  appendAuditLog,
  defaultProfileRoleForAccount,
  destinationForProfileRole,
  getWorkspaceDb,
  isUsernameTaken,
  newId,
  saveWorkspaceDb,
  suggestUniqueUsername,
  warmDbFromSupabase,
  type WorkspaceRoleType,
} from "@/lib/workspace/store";
import { clearWorkspaceCookies, noStoreJson, setHttpCookie, setLangCookie } from "@/lib/workspace/cookies";
import {
  hasAnyInjection,
  isBearerClientRequest,
  parseJsonObject,
  readWorkspaceTrustedToken,
} from "@/lib/workspace/request-auth";

const ALLOWED_ROLES = new Set<WorkspaceRoleType>([
  "pharmacy",
  "supplier",
  "dispensary",
  "researcher",
  "investor",
  "other",
]);

export async function POST(request: NextRequest) {
  // Warm the in-memory DB from Supabase on cold start (non-blocking on subsequent calls)
  await warmDbFromSupabase();

  const parsed = await parseJsonObject(request, "Invalid request format.");
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const action = sanitizeText(body.action, 24);
  const clientIp = clientIpFrom(request);
  const bearerMode = isBearerClientRequest(request, body);

  if (action === "signout") {
    const res = noStoreJson({ ok: true, redirectTo: "/auth" });
    clearWorkspaceCookies(res, Boolean(body.revokeTrustedBrowser));
    return res;
  }

  if (action === "signup") {
    const emailCheck = validateEmailSafe(body.email);
    if (!emailCheck.ok) {
      return noStoreJson({ error: emailCheck.error }, { status: 400 });
    }
    const email = emailCheck.email;

    const limit = checkRateLimit(`signup:${clientIp}`, 10, 15 * 60 * 1000, 10 * 60 * 1000);
    if (!limit.allowed) {
      return noStoreJson(
        { error: `Too many requests. Try again in ${limit.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    if (hasAnyInjection([body.fullName, body.orgName, body.region, body.customRole, body.username])) {
      return noStoreJson({ error: "Unsupported characters in form input." }, { status: 400 });
    }

    const fullName = sanitizeText(body.fullName, 120);
    const orgName = sanitizeText(body.orgName, 140);
    const region = sanitizeText(body.region, 80) || "Dar es Salaam";
    const customRoleLabel = sanitizeText(body.customRole, 80);
    const lang = body.lang === "SW" ? "SW" : "EN";
    const rawRole = sanitizeText(body.role, 32) as WorkspaceRoleType;
    const roleType: WorkspaceRoleType = ALLOWED_ROLES.has(rawRole) ? rawRole : "pharmacy";

    if (fullName.length < 2 || orgName.length < 2) {
      return noStoreJson(
        { error: "Full name and business/organization name are required." },
        { status: 400 }
      );
    }

    const passCheck = validatePasswordPolicy(body.password, body.confirmPassword);
    if (!passCheck.ok) {
      return noStoreJson({ error: passCheck.error }, { status: 400 });
    }

    const db = getWorkspaceDb();
    if (
      db.accounts.some((a) => a.email === email) ||
      (db.joinRequests ?? []).some((r) => r.status !== "accepted" && r.requesterEmail === email)
    ) {
      return noStoreJson(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    let username = "";
    if (typeof body.username === "string" && body.username.trim().length > 0) {
      const uCheck = validateUsernameSafe(body.username);
      if (!uCheck.ok) {
        return noStoreJson({ error: uCheck.error }, { status: 400 });
      }
      if (isUsernameTaken(db, uCheck.username)) {
        return noStoreJson(
          { error: `Username "@${uCheck.username}" is already taken.` },
          { status: 409 }
        );
      }
      username = uCheck.username;
    } else {
      username = suggestUniqueUsername(db, fullName);
    }

    const accountId = newId("acc");
    const centreId = newId("ctr");
    const profileId = newId("prof");
    const nowIso = new Date().toISOString();

    const sexRaw = sanitizeText(body.sex, 24);
    const sex: "female" | "male" | "prefer_not_to_say" =
      sexRaw === "female" || sexRaw === "male" ? sexRaw : "prefer_not_to_say";
    const geoRaw = (body.signupGeo ?? null) as Record<string, unknown> | null;
    const signupGeo = geoRaw
      ? {
          region: sanitizeText(geoRaw.region, 80) || region,
          lat: typeof geoRaw.lat === "number" && Number.isFinite(geoRaw.lat) ? geoRaw.lat : undefined,
          lng: typeof geoRaw.lng === "number" && Number.isFinite(geoRaw.lng) ? geoRaw.lng : undefined,
          source: (geoRaw.source === "gps" ? "gps" : "manual") as "gps" | "manual",
          snappedAt: nowIso,
        }
      : { region, source: "manual" as const, snappedAt: nowIso };

    db.accounts.push({
      id: accountId,
      username,
      email,
      fullName,
      sex,
      signupGeo,
      roleType,
      customRoleLabel: roleType === "other" ? customRoleLabel : undefined,
      orgName,
      region,
      lang,
      passwordHash: hashSecret(String(body.password)).hash,
      securityQuestion: "",
      securityAnswerHash: "",
      requireSecurityEveryTime: false,
      trustGeneration: 1,
      onboardingDone: false,
      verificationStatus: "skipped",
      networkUnlocked: false,
      subscriptionActive: false,
      subscriptionPlan: roleType === "supplier" ? "Wholesale Starter" : "Full Pharmacy",
      certificates: [],
      createdAt: nowIso,
    });

    db.centres.push({
      id: centreId,
      accountId,
      name: orgName,
      region,
      address: "",
      phone: "",
      isPrimary: true,
      createdAt: nowIso,
    });

    db.profiles.push({
      id: profileId,
      accountId,
      centreId,
      username,
      displayName: fullName,
      role: defaultProfileRoleForAccount(roleType),
      pinHash: "",
      isMasterAdmin: true,
      createdAt: nowIso,
    });

    appendAuditLog(db, {
      accountId,
      actor: fullName,
      category: "AUTH",
      action: `Created ${roleType} organization account (${orgName}) · @${username}`,
    });

    saveWorkspaceDb(db);

    const accountToken = createAccountCookieValue(accountId, email, WORKSPACE_ACCOUNT_TTL_SEC, profileId);
    const res = noStoreJson({
      ok: true,
      username,
      redirectTo: "/app/onboarding",
      ...(bearerMode ? { tokens: { accountToken, expiresInSec: WORKSPACE_ACCOUNT_TTL_SEC } } : {}),
    });
    setHttpCookie(res, WS_ACCOUNT_COOKIE, accountToken, WORKSPACE_ACCOUNT_TTL_SEC);
    setLangCookie(res, lang);
    return res;
  }

  if (action === "request_join") {
    const limit = checkRateLimit(`joinreq:${clientIp}`, 10, 15 * 60 * 1000, 10 * 60 * 1000);
    if (!limit.allowed) {
      return noStoreJson(
        { error: `Too many requests. Try again in ${limit.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const emailCheck = validateEmailSafe(body.email);
    if (!emailCheck.ok) {
      return noStoreJson({ error: emailCheck.error }, { status: 400 });
    }
    const email = emailCheck.email;

    if (hasAnyInjection([body.fullName, body.username, body.requestedRoleLabel, body.note, body.region])) {
      return noStoreJson({ error: "Unsupported characters in input." }, { status: 400 });
    }

    const fullName = sanitizeText(body.fullName, 120);
    const targetAccountId = sanitizeText(body.targetAccountId, 80);
    if (fullName.length < 2 || !targetAccountId) {
      return noStoreJson(
        { error: "Full name and target organization selection are required." },
        { status: 400 }
      );
    }

    const passCheck = validatePasswordPolicy(body.password, body.confirmPassword);
    if (!passCheck.ok) {
      return noStoreJson({ error: passCheck.error }, { status: 400 });
    }

    const db = getWorkspaceDb();
    const targetAcc = db.accounts.find((a) => a.id === targetAccountId && a.onboardingDone);
    if (!targetAcc) {
      return noStoreJson({ error: "Selected Cervos organization was not found." }, { status: 404 });
    }

    if (
      db.accounts.some((a) => a.email === email) ||
      (db.joinRequests ?? []).some((r) => r.status !== "accepted" && r.requesterEmail === email)
    ) {
      return noStoreJson(
        { error: "This email already has an account or pending join request." },
        { status: 409 }
      );
    }

    let username = "";
    if (typeof body.username === "string" && body.username.trim().length > 0) {
      const uCheck = validateUsernameSafe(body.username);
      if (!uCheck.ok) return noStoreJson({ error: uCheck.error }, { status: 400 });
      if (isUsernameTaken(db, uCheck.username)) {
        return noStoreJson({ error: `Username "@${uCheck.username}" is already taken.` }, { status: 409 });
      }
      username = uCheck.username;
    } else {
      username = suggestUniqueUsername(db, fullName);
    }

    const sexRaw = sanitizeText(body.sex, 24);
    const requesterSex: "female" | "male" | "prefer_not_to_say" =
      sexRaw === "female" || sexRaw === "male" ? sexRaw : "prefer_not_to_say";
    const lang = body.lang === "SW" ? "SW" : "EN";
    const region = sanitizeText(body.region, 80) || targetAcc.region;
    const geoRaw = (body.signupGeo ?? null) as Record<string, unknown> | null;
    const requesterGeo = geoRaw
      ? {
          lat: typeof geoRaw.lat === "number" && Number.isFinite(geoRaw.lat) ? geoRaw.lat : undefined,
          lng: typeof geoRaw.lng === "number" && Number.isFinite(geoRaw.lng) ? geoRaw.lng : undefined,
          source: (geoRaw.source === "gps" ? "gps" : "manual") as "gps" | "manual",
        }
      : { source: "manual" as const };

    const reqId = newId("jreq");
    const nowIso = new Date().toISOString();
    (db.joinRequests ??= []).unshift({
      id: reqId,
      targetAccountId: targetAcc.id,
      targetOrgName: targetAcc.orgName,
      requesterFullName: fullName,
      requesterUsername: username,
      requesterEmail: email,
      requesterSex,
      requesterPasswordHash: hashSecret(String(body.password)).hash,
      requesterLang: lang,
      requesterRegion: region,
      requesterGeo,
      requestedRoleLabel: sanitizeText(body.requestedRoleLabel, 60) || undefined,
      note: sanitizeText(body.note, 220) || undefined,
      status: "pending",
      createdAt: nowIso,
    });

    (db.notifications ??= []).unshift({
      id: newId("ntf"),
      accountId: targetAcc.id,
      centreId: db.centres.find((c) => c.accountId === targetAcc.id)?.id || "",
      kind: "approval",
      title: "New team join request",
      body: `${fullName} (@${username}) from ${region} requested access to ${targetAcc.orgName}.`,
      read: false,
      createdAt: nowIso,
    });

    appendAuditLog(db, {
      accountId: targetAcc.id,
      actor: fullName,
      category: "AUTH",
      action: `Submitted join request as @${username} (${region})`,
    });
    saveWorkspaceDb(db);

    const accountToken = createAccountCookieValue(`joinreq:${reqId}`, email, WORKSPACE_ACCOUNT_TTL_SEC);
    const res = noStoreJson({
      ok: true,
      username,
      redirectTo: "/app/lounge",
      ...(bearerMode ? { tokens: { accountToken, expiresInSec: WORKSPACE_ACCOUNT_TTL_SEC } } : {}),
    });
    setHttpCookie(res, WS_ACCOUNT_COOKIE, accountToken, WORKSPACE_ACCOUNT_TTL_SEC);
    res.cookies.delete(WS_PROFILE_COOKIE);
    setLangCookie(res, lang);
    return res;
  }

  if (action === "signin") {
    const rawInputId = body.identifier || body.username || body.email;
    if (hasInjectionSignature(rawInputId)) {
      return noStoreJson({ error: "Unsupported characters in username or email." }, { status: 400 });
    }

    const rawIdentifier = sanitizeText(rawInputId, 160).toLowerCase();
    const secret =
      typeof body.password === "string" && body.password.length > 0
        ? body.password
        : typeof body.pin === "string"
          ? body.pin.trim()
          : "";

    if (!rawIdentifier) {
      return noStoreJson({ error: "Enter your username or email." }, { status: 400 });
    }
    if (!secret) {
      return noStoreJson({ error: "Enter your password or 4-6 digit PIN." }, { status: 400 });
    }

    const cleanId = rawIdentifier.replace(/^@+/, "");
    const rateKey = `signin:${cleanId}:${clientIp}`;
    const limit = checkRateLimit(rateKey, 5, 10 * 60 * 1000, 5 * 60 * 1000);
    if (!limit.allowed) {
      return noStoreJson(
        { error: `Too many failed sign-in attempts. Locked for ${limit.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const db = getWorkspaceDb();
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanId);

    let account = looksLikeEmail ? db.accounts.find((a) => a.email.toLowerCase() === cleanId) : undefined;
    let profile = !looksLikeEmail
      ? db.profiles.find((p) => p.username?.toLowerCase() === cleanId)
      : undefined;

    if (!account && !profile && !looksLikeEmail) {
      account = db.accounts.find((a) => a.username?.toLowerCase() === cleanId);
    }
    if (!account && !profile && looksLikeEmail) {
      account = db.accounts.find((a) => a.email.toLowerCase() === cleanId);
    }
    if (!account && !profile) {
      account = db.accounts.find(
        (a) => a.email.toLowerCase() === cleanId || a.username?.toLowerCase() === cleanId
      );
    }
    if (profile && !account) {
      account = db.accounts.find((a) => a.id === profile!.accountId);
    }
    if (account && !profile) {
      profile =
        db.profiles.find((p) => p.accountId === account!.id && p.isMasterAdmin) ??
        db.profiles.find((p) => p.accountId === account!.id);
    }

    // Check pending/approved/declined Lounge join requests first if user hasn't accepted into org yet
    const pendingReq = (db.joinRequests ?? []).find(
      (r) =>
        r.status !== "accepted" &&
        (r.requesterUsername.toLowerCase() === cleanId || r.requesterEmail.toLowerCase() === cleanId)
    );
    if (pendingReq && verifySecret(secret, pendingReq.requesterPasswordHash)) {
      clearFailedAttempts(rateKey);
      const accountToken = createAccountCookieValue(
        `joinreq:${pendingReq.id}`,
        pendingReq.requesterEmail,
        WORKSPACE_ACCOUNT_TTL_SEC
      );
      const res = noStoreJson({
        ok: true,
        username: pendingReq.requesterUsername,
        redirectTo: "/app/lounge",
        ...(bearerMode ? { tokens: { accountToken, expiresInSec: WORKSPACE_ACCOUNT_TTL_SEC } } : {}),
      });
      setHttpCookie(res, WS_ACCOUNT_COOKIE, accountToken, WORKSPACE_ACCOUNT_TTL_SEC);
      res.cookies.delete(WS_PROFILE_COOKIE);
      setLangCookie(res, pendingReq.requesterLang);
      return res;
    }

    const pinValid = Boolean(profile?.pinHash && verifySecret(secret, profile.pinHash));
    const isAdminIdentity = Boolean(
      !profile || profile.isMasterAdmin || profile.role === "pharmacy_owner" || profile.role === "supplier_admin"
    );
    const passwordValid = Boolean(
      (profile?.passwordHash && verifySecret(secret, profile.passwordHash)) ||
        (account && isAdminIdentity && verifySecret(secret, account.passwordHash))
    );

    if (!account || !profile || (!pinValid && !passwordValid)) {
      const rec = recordFailedAttempt(rateKey, 5, 10 * 60 * 1000, 5 * 60 * 1000);
      return noStoreJson(
        {
          error: rec.locked
            ? `Too many failed attempts. Try again in ${rec.retryAfterSec}s.`
            : "Incorrect username, password, or PIN.",
        },
        { status: rec.locked ? 429 : 401 }
      );
    }

    clearFailedAttempts(rateKey);

    appendAuditLog(db, {
      accountId: account.id,
      actor: profile.displayName,
      category: "AUTH",
      action: `Signed in directly as @${profile.username || account.email} (${profile.role.replace(/_/g, " ")})`,
    });
    saveWorkspaceDb(db);

    const ua = request.headers.get("user-agent") || "";
    const trustToken = readWorkspaceTrustedToken(request);
    const isBrowserTrusted =
      !account.requireSecurityEveryTime &&
      Boolean(account.securityAnswerHash) &&
      isTrustedBrowserCookieValid(trustToken, account.id, ua);

    const directDestination = destinationForProfileRole(profile.role, profile.isMasterAdmin);
    const needsSecurityGate =
      account.onboardingDone &&
      Boolean(account.securityAnswerHash) &&
      account.requireSecurityEveryTime &&
      !isBrowserTrusted;

    const redirectTo = !account.onboardingDone
      ? "/app/onboarding"
      : needsSecurityGate
        ? "/app/gate?stage=security"
        : directDestination;

    const accountToken = createAccountCookieValue(
      account.id,
      account.email,
      WORKSPACE_ACCOUNT_TTL_SEC,
      profile.id
    );
    const profileToken =
      account.onboardingDone && !needsSecurityGate
        ? createProfileCookieValue(account.id, profile.centreId, profile.id, profile.role)
        : undefined;

    const res = noStoreJson({
      ok: true,
      browserTrusted: isBrowserTrusted,
      role: profile.role,
      username: profile.username,
      redirectTo,
      ...(bearerMode
        ? {
            tokens: {
              accountToken,
              ...(profileToken ? { profileToken } : {}),
              expiresInSec: WORKSPACE_ACCOUNT_TTL_SEC,
            },
          }
        : {}),
    });
    setHttpCookie(res, WS_ACCOUNT_COOKIE, accountToken, WORKSPACE_ACCOUNT_TTL_SEC);
    if (profileToken) {
      setHttpCookie(res, WS_PROFILE_COOKIE, profileToken, WORKSPACE_PROFILE_TTL_SEC);
    } else {
      res.cookies.delete(WS_PROFILE_COOKIE);
    }
    setLangCookie(res, account.lang);
    return res;
  }

  return noStoreJson({ error: "Unsupported auth action." }, { status: 400 });
}
