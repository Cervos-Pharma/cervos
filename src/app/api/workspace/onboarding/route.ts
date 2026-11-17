import type { NextRequest } from "next/server";
import {
  hashSecret,
  normalizeSecurityAnswer,
  sanitizeText,
  validatePinPolicy,
} from "@/lib/security/harness";
import {
  createAccountCookieValue,
  createProfileCookieValue,
  createTrustedBrowserCookieValue,
  WORKSPACE_ACCOUNT_TTL_SEC,
  WORKSPACE_PROFILE_TTL_SEC,
  WORKSPACE_TRUSTED_TTL_SEC,
  WS_ACCOUNT_COOKIE,
  WS_PROFILE_COOKIE,
  WS_TRUSTED_COOKIE,
} from "@/lib/security/session";
import {
  appendAuditLog,
  getWorkspaceDb,
  isAccountAccessLocked,
  newId,
  saveWorkspaceDb,
} from "@/lib/workspace/store";
import { noStoreJson, setHttpCookie, setLangCookie } from "@/lib/workspace/cookies";
import {
  hasAnyInjection,
  isBearerClientRequest,
  parseJsonObject,
  readWorkspaceAccountToken,
  sanitizeBrandCustomization,
} from "@/lib/workspace/request-auth";

export async function POST(request: NextRequest) {
  const session = readWorkspaceAccountToken(request);
  if (!session) {
    return noStoreJson({ error: "Session expired. Please sign in again." }, { status: 401 });
  }
  if (session.accountId.startsWith("joinreq:")) {
    return noStoreJson({ error: "Complete team allocation in the Lounge first." }, { status: 403 });
  }

  const parsed = await parseJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const bearerMode = isBearerClientRequest(request, body);

  if (
    hasAnyInjection([
      body.fullName,
      body.centreName,
      body.region,
      body.address,
      body.phone,
      body.securityQuestion,
      body.securityAnswer,
      body.licenseNumber,
      body.certificateFileName,
      body.docType,
    ])
  ) {
    return noStoreJson({ error: "Invalid characters in input." }, { status: 400 });
  }

  const db = getWorkspaceDb();
  const account = db.accounts.find((a) => a.id === session.accountId);
  if (!account) {
    return noStoreJson({ error: "Account not found." }, { status: 404 });
  }

  // Prevent post-onboarding privilege/PIN/security-question overwrite by any account holder.
  if (account.onboardingDone) {
    return noStoreJson(
      { error: "Workspace onboarding has already been completed. Use Organization Settings instead." },
      { status: 403 }
    );
  }

  const accessLock = isAccountAccessLocked(account);
  if (accessLock.locked && accessLock.source === "hq") {
    return noStoreJson({ error: accessLock.reason, accessLock }, { status: 423 });
  }

  const fullName = sanitizeText(body.fullName, 120) || account.fullName;
  const lang = body.lang === "SW" ? "SW" : body.lang === "EN" ? "EN" : account.lang;
  const centreName = sanitizeText(body.centreName, 140) || account.orgName;
  const region = sanitizeText(body.region, 80) || account.region;
  const address = sanitizeText(body.address, 180);
  const phone = sanitizeText(body.phone, 40);
  const securityQuestion = sanitizeText(body.securityQuestion, 180);
  const securityAnswer = normalizeSecurityAnswer(body.securityAnswer);

  if (address.length < 3 || phone.length < 7) {
    return noStoreJson(
      { error: "Primary office street address and phone number are required." },
      { status: 400 }
    );
  }
  if (securityQuestion.length < 6 || securityAnswer.length < 2) {
    return noStoreJson(
      { error: "Choose a security question and provide an answer (at least 2 characters)." },
      { status: 400 }
    );
  }

  const pinCheck = validatePinPolicy(body.masterPin);
  if (!pinCheck.ok) {
    return noStoreJson({ error: pinCheck.error }, { status: 400 });
  }

  const skipCompliance = Boolean(body.skipCompliance);
  const licenseNumber = sanitizeText(body.licenseNumber, 80);
  const certificateFileName = sanitizeText(body.certificateFileName, 140);
  const docType = sanitizeText(body.docType, 100) || "Operating License";

  account.fullName = fullName;
  account.lang = lang;
  account.region = region;
  account.securityQuestion = securityQuestion;
  account.securityAnswerHash = hashSecret(securityAnswer).hash;
  account.requireSecurityEveryTime = Boolean(body.requireSecurityEveryTime);
  account.onboardingDone = true;

  const rawCust =
    body.customization && typeof body.customization === "object" && !Array.isArray(body.customization)
      ? (body.customization as Record<string, unknown>)
      : {};
  account.customization = sanitizeBrandCustomization(rawCust, account.customization ?? {});

  if (!skipCompliance && licenseNumber.length >= 3 && certificateFileName.length >= 3) {
    account.certificates = [
      {
        id: newId("cert"),
        docType,
        licenseNumber,
        fileName: certificateFileName,
        uploadedAt: new Date().toISOString(),
      },
    ];
    account.verificationStatus = "verified";
    account.networkUnlocked = true;
  } else {
    account.verificationStatus = "skipped";
    account.networkUnlocked = false;
  }

  let primaryCentre = db.centres.find((c) => c.accountId === account.id && c.isPrimary);
  if (!primaryCentre) {
    primaryCentre = {
      id: newId("ctr"),
      accountId: account.id,
      name: centreName,
      region,
      address,
      phone,
      isPrimary: true,
      createdAt: new Date().toISOString(),
    };
    db.centres.push(primaryCentre);
  } else {
    primaryCentre.name = centreName;
    primaryCentre.region = region;
    primaryCentre.address = address;
    primaryCentre.phone = phone;
  }

  let masterProfile = db.profiles.find((p) => p.accountId === account.id && p.isMasterAdmin);
  const pinHash = hashSecret(String(body.masterPin)).hash;
  if (!masterProfile) {
    masterProfile = {
      id: newId("prof"),
      accountId: account.id,
      centreId: primaryCentre.id,
      displayName: fullName,
      role: "pharmacy_owner",
      pinHash,
      isMasterAdmin: true,
      createdAt: new Date().toISOString(),
    };
    db.profiles.push(masterProfile);
  } else {
    masterProfile.displayName = fullName;
    masterProfile.centreId = primaryCentre.id;
    masterProfile.pinHash = pinHash;
  }

  appendAuditLog(db, {
    accountId: account.id,
    actor: fullName,
    category: skipCompliance ? "SETUP" : "COMPLIANCE",
    action: skipCompliance
      ? `Completed first-run setup at ${primaryCentre.name} (Certificates skipped)`
      : `Completed setup & uploaded ${docType} (${licenseNumber})`,
  });

  saveWorkspaceDb(db);

  const accountToken = createAccountCookieValue(
    account.id,
    account.email,
    WORKSPACE_ACCOUNT_TTL_SEC,
    masterProfile.id
  );
  const profileToken = createProfileCookieValue(
    account.id,
    primaryCentre.id,
    masterProfile.id,
    masterProfile.role
  );
  const trustToken =
    body.rememberBrowser !== false
      ? createTrustedBrowserCookieValue(account.id, request.headers.get("user-agent") || "")
      : undefined;

  const res = noStoreJson({
    ok: true,
    redirectTo: "/app",
    ...(bearerMode
      ? {
          tokens: {
            accountToken,
            profileToken,
            ...(trustToken ? { trustToken } : {}),
            expiresInSec: WORKSPACE_ACCOUNT_TTL_SEC,
          },
        }
      : {}),
  });
  setHttpCookie(res, WS_ACCOUNT_COOKIE, accountToken, WORKSPACE_ACCOUNT_TTL_SEC);
  setHttpCookie(res, WS_PROFILE_COOKIE, profileToken, WORKSPACE_PROFILE_TTL_SEC);
  setLangCookie(res, account.lang);

  if (trustToken) {
    setHttpCookie(res, WS_TRUSTED_COOKIE, trustToken, WORKSPACE_TRUSTED_TTL_SEC);
  }

  return res;
}
