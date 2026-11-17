"use client";

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64UrlToBuffer(b64u: string): ArrayBuffer {
  const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
  const base64 = (b64u + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out.buffer;
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

export async function enrollPasskeyForAccount(params: {
  userName: string;
  displayName: string;
  label: string;
  profileId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isPasskeySupported()) {
    return { ok: false, error: "This browser does not support device biometrics or passkeys." };
  }

  try {
    const chRes = await fetch("/api/workspace/passkeys?purpose=register");
    if (!chRes.ok) return { ok: false, error: "Unable to start passkey enrollment." };
    const chData = (await chRes.json()) as { challengeId: string; challenge: string };

    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: base64UrlToBuffer(chData.challenge),
        rp: { name: "Cervos Pharma", id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(params.userName.slice(0, 64)),
          name: params.userName,
          displayName: params.displayName,
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          userVerification: "preferred",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!cred) return { ok: false, error: "Passkey setup was cancelled." };
    const response = cred.response as AuthenticatorAttestationResponse & {
      getPublicKey?: () => ArrayBuffer | null;
    };
    const spkiBuf = response.getPublicKey?.();
    if (!spkiBuf) {
      return {
        ok: false,
        error: "Browser did not export SPKI public key; try Chrome, Edge, or Safari.",
      };
    }

    const regRes = await fetch("/api/workspace/passkeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        challengeId: chData.challengeId,
        credentialId: bufferToBase64Url(cred.rawId),
        publicKeySpkiBase64: bufferToBase64(spkiBuf),
        label: params.label,
        profileId: params.profileId,
      }),
    });
    const regData = (await regRes.json()) as { ok?: boolean; error?: string };
    if (!regRes.ok || !regData.ok) {
      return { ok: false, error: regData.error || "Failed to save passkey." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Biometric verification was cancelled or unavailable." };
  }
}

export async function authenticateWithPasskey(params: {
  purpose: "login" | "unlock";
  email?: string;
  profileId?: string;
}): Promise<{ ok: boolean; redirectTo?: string; error?: string }> {
  if (!isPasskeySupported()) {
    return { ok: false, error: "Passkeys are not supported on this browser." };
  }

  try {
    const chRes = await fetch(`/api/workspace/passkeys?purpose=${params.purpose}`);
    const chData = (await chRes.json()) as {
      challengeId: string;
      challenge: string;
      allowCredentialIds?: string[];
      error?: string;
    };
    if (!chRes.ok) {
      return { ok: false, error: chData.error || "Unable to initialize passkey sign-in." };
    }

    const allowCredentials =
      chData.allowCredentialIds && chData.allowCredentialIds.length > 0
        ? chData.allowCredentialIds.map((id) => ({
            type: "public-key" as const,
            id: base64UrlToBuffer(id),
          }))
        : undefined;

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: base64UrlToBuffer(chData.challenge),
        rpId: window.location.hostname,
        allowCredentials,
        userVerification: "preferred",
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) return { ok: false, error: "Biometric prompt dismissed." };
    const resp = assertion.response as AuthenticatorAssertionResponse;

    const verifyRes = await fetch("/api/workspace/passkeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: params.purpose,
        challengeId: chData.challengeId,
        credentialId: bufferToBase64Url(assertion.rawId),
        authenticatorDataB64u: bufferToBase64Url(resp.authenticatorData),
        clientDataJsonB64u: bufferToBase64Url(resp.clientDataJSON),
        signatureB64u: bufferToBase64Url(resp.signature),
        email: params.email,
        profileId: params.profileId,
      }),
    });
    const out = (await verifyRes.json()) as { ok?: boolean; redirectTo?: string; error?: string };
    if (!verifyRes.ok || !out.ok) {
      return { ok: false, error: out.error || "Biometric check could not be verified." };
    }
    return { ok: true, redirectTo: out.redirectTo };
  } catch {
    return { ok: false, error: "No matching passkey found or biometric check cancelled." };
  }
}
