import { createHash, createPublicKey, createVerify, randomBytes } from "crypto";

interface PendingChallenge {
  challenge: string;
  accountId?: string;
  purpose: "register" | "login" | "unlock";
  expiresAt: number;
}

const g = globalThis as unknown as { __cervosWebAuthnChallenges?: Map<string, PendingChallenge> };
const challenges = (g.__cervosWebAuthnChallenges ??= new Map<string, PendingChallenge>());

export function issueWebAuthnChallenge(
  purpose: "register" | "login" | "unlock",
  accountId?: string
): { challengeId: string; challenge: string } {
  const challengeId = randomBytes(16).toString("hex");
  const challenge = randomBytes(32).toString("base64url");
  const now = Date.now();
  // Clean stale challenges opportunistically
  for (const [k, v] of challenges.entries()) {
    if (v.expiresAt < now) challenges.delete(k);
  }
  challenges.set(challengeId, {
    challenge,
    accountId,
    purpose,
    expiresAt: now + 5 * 60 * 1000,
  });
  return { challengeId, challenge };
}

export function consumeWebAuthnChallenge(
  challengeId: string,
  expectedPurpose: "register" | "login" | "unlock"
): PendingChallenge | null {
  const rec = challenges.get(challengeId);
  if (!rec) return null;
  challenges.delete(challengeId);
  if (rec.expiresAt < Date.now() || rec.purpose !== expectedPurpose) return null;
  return rec;
}

/**
 * Verifies a WebAuthn assertion (ES256 P-256 SPKI PEM/DER base64url public key)
 * against authenticatorData, clientDataJSON, and expected challenge.
 */
export function verifyPasskeyAssertion(params: {
  publicKeySpkiBase64: string;
  authenticatorDataB64u: string;
  clientDataJsonB64u: string;
  signatureB64u: string;
  expectedChallenge: string;
  expectedOrigin: string;
}): boolean {
  try {
    const clientDataRaw = Buffer.from(params.clientDataJsonB64u, "base64url");
    const clientData = JSON.parse(clientDataRaw.toString("utf8")) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };
    if (clientData.type !== "webauthn.get") return false;
    if (clientData.challenge !== params.expectedChallenge) return false;
    if (params.expectedOrigin && clientData.origin !== params.expectedOrigin) return false;

    const authData = Buffer.from(params.authenticatorDataB64u, "base64url");
    // Require User Present bit (0x01)
    if (authData.length < 37 || (authData[32] & 0x01) === 0) return false;

    const clientDataHash = createHash("sha256").update(clientDataRaw).digest();
    const signedData = Buffer.concat([authData, clientDataHash]);
    const sigBuffer = Buffer.from(params.signatureB64u, "base64url");

    const pubKey = createPublicKey({
      key: Buffer.from(params.publicKeySpkiBase64, "base64"),
      format: "der",
      type: "spki",
    });

    const verifier = createVerify("SHA256");
    verifier.update(signedData);
    verifier.end();
    return verifier.verify(pubKey, sigBuffer);
  } catch {
    return false;
  }
}
