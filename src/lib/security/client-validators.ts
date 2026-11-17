/**
 * Client-and-server shared input validation helpers.
 * Keeps pattern checks consistent between live UI feedback and server APIs.
 */

export interface PinCheckResult {
  ok: boolean;
  reason?: "empty" | "length" | "digits" | "repeated" | "sequential";
  errorEn?: string;
  errorSw?: string;
}

/**
 * Checks whether a numeric PIN avoids trivial repeats (e.g. 1111, 00000)
 * and monotonic sequential runs (e.g. 1234, 4321, 3456, 654321).
 */
export function evaluatePinStrength(pin: string): PinCheckResult {
  if (!pin) {
    return {
      ok: false,
      reason: "empty",
      errorEn: "Enter a 4 to 6 digit numeric PIN.",
      errorSw: "Weka PIN ya tarakimu 4 hadi 6.",
    };
  }
  if (!/^\d+$/.test(pin)) {
    return {
      ok: false,
      reason: "digits",
      errorEn: "Use numeric digits (0-9) only.",
      errorSw: "Tumia namba (0-9) pekee.",
    };
  }
  if (pin.length < 4 || pin.length > 6) {
    return {
      ok: false,
      reason: "length",
      errorEn: "PIN must be 4 to 6 digits long.",
      errorSw: "PIN lazima iwe tarakimu 4 hadi 6.",
    };
  }
  if (/^(\d)\1+$/.test(pin)) {
    return {
      ok: false,
      reason: "repeated",
      errorEn: "Avoid repeating the same digit (e.g. 1111 or 0000).",
      errorSw: "Epuka kurudia namba moja (mfano 1111 au 0000).",
    };
  }

  // Detect any strictly ascending (+1) or descending (-1) run across the whole PIN
  let asc = true;
  let desc = true;
  for (let i = 1; i < pin.length; i += 1) {
    const prev = pin.charCodeAt(i - 1);
    const curr = pin.charCodeAt(i);
    if (curr - prev !== 1) asc = false;
    if (prev - curr !== 1) desc = false;
  }
  if (asc || desc) {
    return {
      ok: false,
      reason: "sequential",
      errorEn: "Avoid sequential patterns like 1234 or 6543.",
      errorSw: "Epuka mpangilio wa mfululizo kama 1234 au 6543.",
    };
  }

  return { ok: true };
}

export function validatePhoneInline(phone: string): { ok: boolean; errorEn?: string; errorSw?: string } {
  const digits = phone.replace(/\D/g, "");
  if (!phone.trim()) {
    return { ok: false, errorEn: "Phone number is required.", errorSw: "Namba ya simu inahitajika." };
  }
  if (digits.length < 7 || digits.length > 15) {
    return {
      ok: false,
      errorEn: "Enter a valid contact number (7 to 15 digits).",
      errorSw: "Weka namba sahihi ya simu (tarakimu 7 hadi 15).",
    };
  }
  return { ok: true };
}

export function hasClientInjectionRisk(value: string): boolean {
  return /<\s*(?:script|iframe)\b|javascript\s*:|\bon(?:error|load|click|focus)\s*=|\b(?:union\s+select|drop\s+table)\b/i.test(
    value
  );
}
