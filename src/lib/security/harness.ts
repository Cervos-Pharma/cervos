import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { evaluatePinStrength } from "./client-validators";

const INJECTION_PATTERNS: RegExp[] = [
  /<\s*script\b/i,
  /<\s*iframe\b/i,
  /<\s*(?:object|embed)\b/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /\bon(?:error|load|click|mouseover|focus)\s*=/i,
  /\b(?:union\s+select|drop\s+table|insert\s+into|delete\s+from|alter\s+table)\b/i,
  /(?:--|\bOR\b\s+1\s*=\s*1|\bAND\b\s+1\s*=\s*1)/i,
  /\$(?:where|ne|gt|lt|gte|lte|regex|expr)\b/i,
];

/**
 * Strips ASCII control characters, neutralizes HTML angle brackets, and bounds length.
 */
export function sanitizeText(value: unknown, maxLen = 200): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Detects suspicious SQL/NoSQL/XSS payload patterns before persistence.
 */
export function hasInjectionSignature(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Strict email validation rejecting header injection and whitespace.
 */
export function validateEmailSafe(raw: unknown): { ok: boolean; email: string; error?: string } {
  if (typeof raw !== "string") {
    return { ok: false, email: "", error: "Email is required." };
  }
  const trimmed = raw.trim().toLowerCase();
  if (/[\r\n\0\s]/.test(trimmed) || hasInjectionSignature(trimmed)) {
    return { ok: false, email: "", error: "Invalid email characters detected." };
  }
  if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { ok: false, email: "", error: "Enter a valid email address." };
  }
  return { ok: true, email: trimmed };
}

/**
 * Normalizes and validates a global workspace handle (e.g. `amani`, `baraka.mwenge`).
 */
export function validateUsernameSafe(raw: unknown): {
  ok: boolean;
  username: string;
  error?: string;
} {
  if (typeof raw !== "string") {
    return { ok: false, username: "", error: "Username is required." };
  }
  const clean = raw.trim().toLowerCase().replace(/^@+/, "");
  if (hasInjectionSignature(clean) || /[\r\n\0\s]/.test(clean)) {
    return { ok: false, username: "", error: "Username contains unsupported characters." };
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(clean)) {
    return {
      ok: false,
      username: "",
      error: "Username must be 3-32 characters (letters, numbers, dot, underscore or dash).",
    };
  }
  return { ok: true, username: clean };
}

/**
 * Enforces minimum password entropy and constant-time equality when confirm is given.
 */
export function validatePasswordPolicy(
  password: unknown,
  confirmPassword?: unknown
): { ok: boolean; error?: string } {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { ok: false, error: "Password must be 8 to 128 characters." };
  }
  if (/[\u0000-\u001F\u007F]/.test(password)) {
    return { ok: false, error: "Password contains unsupported control characters." };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':",./<>?\\|`~]/.test(password);
  if (!hasLetter || !hasNumberOrSymbol) {
    return {
      ok: false,
      error: "Include both letters and at least one number or symbol.",
    };
  }
  if (typeof confirmPassword === "string") {
    const a = Buffer.from(password, "utf8");
    const b = Buffer.from(confirmPassword, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Passwords do not match." };
    }
  }
  return { ok: true };
}

/**
 * Validates numeric profile unlock PIN (4 to 6 digits, disallowing trivial sequences).
 */
export function validatePinPolicy(pin: unknown): { ok: boolean; error?: string } {
  if (typeof pin !== "string") {
    return { ok: false, error: "PIN must be 4 to 6 numeric digits." };
  }
  const result = evaluatePinStrength(pin);
  return result.ok ? { ok: true } : { ok: false, error: result.errorEn || "Choose a less predictable PIN." };
}

/**
 * Normalizes security question answer (lowercase, trimmed, collapsed spacing) before hashing.
 */
export function normalizeSecurityAnswer(raw: unknown): string {
  return sanitizeText(raw, 120).toLowerCase();
}

export function hashSecret(secret: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex ?? randomBytes(16).toString("hex");
  const derived = scryptSync(secret, salt, 64).toString("hex");
  return { hash: `${salt}:${derived}`, salt };
}

export function verifySecret(candidate: string, storedComposite: string): boolean {
  const parts = storedComposite.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = scryptSync(candidate, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* In-Process Sliding-Window Rate Limiter & Lockout Harness                   */
/* -------------------------------------------------------------------------- */
interface AttemptBucket {
  count: number;
  windowStart: number;
  lockedUntil: number;
}

const g = globalThis as unknown as { __cervosAuthBuckets?: Map<string, AttemptBucket> };
const buckets = (g.__cervosAuthBuckets ??= new Map<string, AttemptBucket>());

function pruneExpiredBuckets(now: number, windowMs: number): void {
  if (buckets.size <= 2000) return;
  for (const [k, b] of buckets.entries()) {
    if (b.lockedUntil <= now && now - b.windowStart > windowMs) {
      buckets.delete(k);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 10 * 60 * 1000,
  lockoutMs = 5 * 60 * 1000
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  pruneExpiredBuckets(now, windowMs);
  const existing = buckets.get(key);

  if (existing && existing.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.lockedUntil - now) / 1000),
    };
  }

  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { count: 0, windowStart: now, lockedUntil: 0 });
    return { allowed: true, remaining: maxAttempts, retryAfterSec: 0 };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - existing.count),
    retryAfterSec: 0,
  };
}

export function recordFailedAttempt(
  key: string,
  maxAttempts = 5,
  windowMs = 10 * 60 * 1000,
  lockoutMs = 5 * 60 * 1000
): { locked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const prev = buckets.get(key);
  if (!prev || now - prev.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now, lockedUntil: 0 });
    return { locked: false, retryAfterSec: 0 };
  }
  const nextCount = prev.count + 1;
  if (nextCount >= maxAttempts) {
    const lockedUntil = now + lockoutMs;
    buckets.set(key, { count: nextCount, windowStart: prev.windowStart, lockedUntil });
    return { locked: true, retryAfterSec: Math.ceil(lockoutMs / 1000) };
  }
  buckets.set(key, { ...prev, count: nextCount });
  return { locked: false, retryAfterSec: 0 };
}

export function clearFailedAttempts(key: string): void {
  buckets.delete(key);
}
