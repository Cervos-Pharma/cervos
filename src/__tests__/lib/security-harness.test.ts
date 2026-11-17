import { describe, it, expect } from "vitest";
import {
  sanitizeText,
  hasInjectionSignature,
  validateEmailSafe,
  validatePasswordPolicy,
  validatePinPolicy,
  hashSecret,
  verifySecret,
  normalizeSecurityAnswer,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
} from "@/lib/security/harness";
import {
  createAccountCookieValue,
  readAccountCookieValue,
  createTrustedBrowserCookieValue,
  isTrustedBrowserCookieValid,
  createProfileCookieValue,
  readProfileCookieValue,
} from "@/lib/security/session";

describe("Workspace Security Harness", () => {
  it("strips control characters and neutralizes angle brackets in sanitizeText", () => {
    expect(sanitizeText("  Jane\u0000 <script>alert(1)</script>  ")).toBe("Jane scriptalert(1)/script");
  });

  it("flags common SQL, NoSQL, and XSS injection vectors", () => {
    expect(hasInjectionSignature("<script>fetch('/x')</script>")).toBe(true);
    expect(hasInjectionSignature("admin' OR 1=1--")).toBe(true);
    expect(hasInjectionSignature('{"$ne": null}')).toBe(true);
    expect(hasInjectionSignature("Kariakoo Pharmacy Annex")).toBe(false);
  });

  it("validates email safety and rejects header injection", () => {
    expect(validateEmailSafe("owner@pharmacy.co.tz").ok).toBe(true);
    expect(validateEmailSafe("bad\r\n@pharmacy.co.tz").ok).toBe(false);
    expect(validateEmailSafe("not-an-email").ok).toBe(false);
  });

  it("enforces password strength and matching confirmation", () => {
    expect(validatePasswordPolicy("short", "short").ok).toBe(false);
    expect(validatePasswordPolicy("onlyletters", "onlyletters").ok).toBe(false);
    expect(validatePasswordPolicy("Cervos2026!", "Mismatch2026!").ok).toBe(false);
    expect(validatePasswordPolicy("Cervos2026!", "Cervos2026!").ok).toBe(true);
  });

  it("enforces non-trivial 4 to 6 digit profile PIN policy and verifies salted scrypt hashes", () => {
    expect(validatePinPolicy("1234").ok).toBe(false);
    expect(validatePinPolicy("2345").ok).toBe(false);
    expect(validatePinPolicy("654321").ok).toBe(false);
    expect(validatePinPolicy("1111").ok).toBe(false);
    expect(validatePinPolicy("000000").ok).toBe(false);
    expect(validatePinPolicy("8429").ok).toBe(true);

    const hashed = hashSecret("8429");
    expect(verifySecret("8429", hashed.hash)).toBe(true);
    expect(verifySecret("9999", hashed.hash)).toBe(false);
  });

  it("normalizes and verifies security question answers case-insensitively", () => {
    const stored = hashSecret(normalizeSecurityAnswer("  Dar Es Salaam  "));
    expect(verifySecret(normalizeSecurityAnswer("dar es salaam"), stored.hash)).toBe(true);
    expect(verifySecret(normalizeSecurityAnswer("arusha"), stored.hash)).toBe(false);
  });

  it("locks out keys cleanly after max consecutive failed attempts", () => {
    const key = `test-lock-${Date.now()}`;
    clearFailedAttempts(key);
    expect(checkRateLimit(key, 3).allowed).toBe(true);
    recordFailedAttempt(key, 3, 60_000, 60_000);
    recordFailedAttempt(key, 3, 60_000, 60_000);
    const lockRes = recordFailedAttempt(key, 3, 60_000, 60_000);
    expect(lockRes.locked).toBe(true);
    expect(checkRateLimit(key, 3).allowed).toBe(false);
    clearFailedAttempts(key);
  });

  it("signs and verifies HMAC account, profile, and UA-bound trusted browser cookies", () => {
    const acctToken = createAccountCookieValue("acc_1", "owner@pharmacy.co.tz");
    expect(readAccountCookieValue(acctToken)?.accountId).toBe("acc_1");
    expect(readAccountCookieValue(`${acctToken}tamper`)).toBeNull();

    const profToken = createProfileCookieValue("acc_1", "ctr_1", "prof_1", "pharmacy_owner");
    expect(readProfileCookieValue(profToken)?.role).toBe("pharmacy_owner");

    const ua = "Mozilla/5.0 Chrome/130";
    const trustToken = createTrustedBrowserCookieValue("acc_1", ua);
    expect(isTrustedBrowserCookieValid(trustToken, "acc_1", ua)).toBe(true);
    expect(isTrustedBrowserCookieValid(trustToken, "acc_1", "DifferentBrowser/1.0")).toBe(false);
  });
});
