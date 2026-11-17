import type { NextRequest } from "next/server";
import { sanitizeText } from "@/lib/security/harness";
import {
  createAccountCookieValue,
  createProfileCookieValue,
  WORKSPACE_ACCOUNT_TTL_SEC,
  WORKSPACE_PROFILE_TTL_SEC,
  WS_ACCOUNT_COOKIE,
  WS_PROFILE_COOKIE,
} from "@/lib/security/session";
import { noStoreJson, setHttpCookie, setLangCookie } from "@/lib/workspace/cookies";
import {
  hasAnyInjection,
  isBearerClientRequest,
  parseJsonObject,
  readWorkspaceAccountToken,
} from "@/lib/workspace/request-auth";
import {
  appendAuditLog,
  defaultProfileRoleForAccount,
  destinationForProfileRole,
  getHqUpdates,
  getWorkspaceDb,
  isUsernameTaken,
  newId,
  publicJoinRequestSummary,
  saveWorkspaceDb,
  searchPublicOrganizations,
  suggestUniqueUsername,
} from "@/lib/workspace/store";

function resolveJoinSession(request: NextRequest) {
  const session = readWorkspaceAccountToken(request);
  if (!session || !session.accountId.startsWith("joinreq:")) return null;
  const reqId = session.accountId.slice("joinreq:".length);
  const db = getWorkspaceDb();
  const req = (db.joinRequests ?? []).find((r) => r.id === reqId && r.status !== "accepted");
  if (!req) return null;
  return { db, req };
}

export async function GET(request: NextRequest) {
  const resolved = resolveJoinSession(request);
  if (!resolved) {
    return noStoreJson({ authenticated: false }, { status: 401 });
  }
  const { db, req } = resolved;
  const organizations = searchPublicOrganizations(db, { preferredRegion: req.requesterRegion });
  return noStoreJson({
    authenticated: true,
    joinRequest: publicJoinRequestSummary(req),
    organizations: organizations.slice(0, 15),
    hqUpdates: getHqUpdates(db),
  });
}

export async function POST(request: NextRequest) {
  const resolved = resolveJoinSession(request);
  if (!resolved) {
    return noStoreJson({ error: "Lounge session not found." }, { status: 401 });
  }
  const { db, req } = resolved;

  const parsed = await parseJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const bearerMode = isBearerClientRequest(request, body);

  const action = sanitizeText(body.action, 40);

  if (action === "accept_allocation") {
    if (req.status !== "approved" || !req.allocatedProfileId || !req.allocatedCentreId || !req.allocatedRole) {
      return noStoreJson({ error: "Allocation is not ready yet." }, { status: 400 });
    }
    const targetAcc = db.accounts.find((a) => a.id === req.targetAccountId);
    const targetProf = db.profiles.find((p) => p.id === req.allocatedProfileId && p.accountId === req.targetAccountId);
    if (!targetAcc || !targetProf) {
      return noStoreJson({ error: "Target workspace allocation no longer exists." }, { status: 404 });
    }

    req.status = "accepted";
    delete req.allocatedPinPreview;

    appendAuditLog(db, {
      accountId: targetAcc.id,
      actor: targetProf.displayName,
      category: "AUTH",
      action: `Accepted allocation & entered workspace as @${targetProf.username || targetProf.displayName}`,
    });
    saveWorkspaceDb(db);

    const dest = destinationForProfileRole(targetProf.role, targetProf.isMasterAdmin);
    const accountToken = createAccountCookieValue(
      targetAcc.id,
      targetAcc.email,
      WORKSPACE_ACCOUNT_TTL_SEC,
      targetProf.id
    );
    const profileToken = createProfileCookieValue(
      targetAcc.id,
      targetProf.centreId,
      targetProf.id,
      targetProf.role
    );

    const res = noStoreJson({
      ok: true,
      redirectTo: dest,
      ...(bearerMode
        ? { tokens: { accountToken, profileToken, expiresInSec: WORKSPACE_ACCOUNT_TTL_SEC } }
        : {}),
    });
    setHttpCookie(res, WS_ACCOUNT_COOKIE, accountToken, WORKSPACE_ACCOUNT_TTL_SEC);
    setHttpCookie(res, WS_PROFILE_COOKIE, profileToken, WORKSPACE_PROFILE_TTL_SEC);
    setLangCookie(res, targetAcc.lang);
    return res;
  }

  if (action === "resubmit_request") {
    const targetAccountId = sanitizeText(body.targetAccountId, 80);
    const targetAcc = db.accounts.find((a) => a.id === targetAccountId && a.onboardingDone);
    if (!targetAcc) {
      return noStoreJson({ error: "Selected organization not found." }, { status: 404 });
    }
    if (hasAnyInjection([body.note, body.requestedRoleLabel])) {
      return noStoreJson({ error: "Unsupported characters in request note." }, { status: 400 });
    }
    req.targetAccountId = targetAcc.id;
    req.targetOrgName = targetAcc.orgName;
    req.requestedRoleLabel = sanitizeText(body.requestedRoleLabel, 60) || undefined;
    req.note = sanitizeText(body.note, 220) || undefined;
    req.status = "pending";
    delete req.declineReason;
    req.reviewedAt = undefined;
    req.createdAt = new Date().toISOString();

    (db.notifications ??= []).unshift({
      id: newId("ntf"),
      accountId: targetAcc.id,
      centreId: db.centres.find((c) => c.accountId === targetAcc.id)?.id || "",
      kind: "approval",
      title: "New team join request",
      body: `${req.requesterFullName} (@${req.requesterUsername}) requested access to ${targetAcc.orgName}.`,
      read: false,
      createdAt: new Date().toISOString(),
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, joinRequest: publicJoinRequestSummary(req) });
  }

  if (action === "convert_to_create_org") {
    if (hasAnyInjection([body.orgName])) {
      return noStoreJson({ error: "Unsupported characters in organization name." }, { status: 400 });
    }
    if (db.accounts.some((a) => a.email === req.requesterEmail)) {
      return noStoreJson({ error: "An organization account with this email already exists." }, { status: 409 });
    }

    const orgName = sanitizeText(body.orgName, 140) || `${req.requesterFullName}'s Pharmacy`;
    const accountId = newId("acc");
    const centreId = newId("ctr");
    const profileId = newId("prof");
    const nowIso = new Date().toISOString();
    const safeUsername = isUsernameTaken(db, req.requesterUsername)
      ? suggestUniqueUsername(db, req.requesterUsername)
      : req.requesterUsername;

    db.accounts.push({
      id: accountId,
      username: safeUsername,
      email: req.requesterEmail,
      fullName: req.requesterFullName,
      sex: req.requesterSex,
      signupGeo: req.requesterGeo
        ? {
            region: req.requesterRegion,
            lat: req.requesterGeo.lat,
            lng: req.requesterGeo.lng,
            source: req.requesterGeo.source,
            snappedAt: nowIso,
          }
        : undefined,
      roleType: "pharmacy",
      orgName,
      region: req.requesterRegion || "Dar es Salaam",
      lang: req.requesterLang,
      passwordHash: req.requesterPasswordHash,
      securityQuestion: "",
      securityAnswerHash: "",
      requireSecurityEveryTime: false,
      trustGeneration: 1,
      onboardingDone: false,
      verificationStatus: "skipped",
      networkUnlocked: false,
      subscriptionActive: false,
      subscriptionPlan: "Full Pharmacy",
      certificates: [],
      createdAt: nowIso,
    });

    db.centres.push({
      id: centreId,
      accountId,
      name: orgName,
      region: req.requesterRegion || "Dar es Salaam",
      address: "",
      phone: "",
      isPrimary: true,
      createdAt: nowIso,
    });

    db.profiles.push({
      id: profileId,
      accountId,
      centreId,
      username: safeUsername,
      displayName: req.requesterFullName,
      role: defaultProfileRoleForAccount("pharmacy"),
      pinHash: "",
      passwordHash: req.requesterPasswordHash,
      isMasterAdmin: true,
      createdAt: nowIso,
    });

    db.joinRequests = (db.joinRequests ?? []).filter((r) => r.id !== req.id);
    appendAuditLog(db, {
      accountId,
      actor: req.requesterFullName,
      category: "AUTH",
      action: `Converted Lounge request into new organization (${orgName})`,
    });
    saveWorkspaceDb(db);

    const accountToken = createAccountCookieValue(
      accountId,
      req.requesterEmail,
      WORKSPACE_ACCOUNT_TTL_SEC,
      profileId
    );
    const res = noStoreJson({
      ok: true,
      redirectTo: "/app/onboarding",
      ...(bearerMode ? { tokens: { accountToken, expiresInSec: WORKSPACE_ACCOUNT_TTL_SEC } } : {}),
    });
    setHttpCookie(res, WS_ACCOUNT_COOKIE, accountToken, WORKSPACE_ACCOUNT_TTL_SEC);
    res.cookies.delete(WS_PROFILE_COOKIE);
    return res;
  }

  return noStoreJson({ error: "Unsupported lounge action." }, { status: 400 });
}
