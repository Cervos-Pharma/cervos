import { fetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import type {
  WorkspaceAuthRequestJoinPayload,
  WorkspaceAuthResponse,
  WorkspaceAuthSignInPayload,
  WorkspaceAuthSignUpPayload,
} from "@cervos/core";
import type { WorkspaceStateResponse } from "@/types/workspace";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "https://cervos.online").replace(/\/$/, "");
const STORE_ACCT_KEY = "cervos_account_token";
const STORE_PROF_KEY = "cervos_profile_token";
const STORE_TRUST_KEY = "cervos_trust_token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface StoredSessionTokens {
  accountToken: string | null;
  profileToken: string | null;
  trustToken: string | null;
}

export async function getStoredTokens(): Promise<StoredSessionTokens> {
  const [accountToken, profileToken, trustToken] = await Promise.all([
    SecureStore.getItemAsync(STORE_ACCT_KEY).catch(() => null),
    SecureStore.getItemAsync(STORE_PROF_KEY).catch(() => null),
    SecureStore.getItemAsync(STORE_TRUST_KEY).catch(() => null),
  ]);
  return { accountToken, profileToken, trustToken };
}

export async function saveTokens(tokens?: {
  accountToken?: string | null;
  profileToken?: string | null;
  trustToken?: string | null;
}) {
  if (!tokens) return;
  if (tokens.accountToken !== undefined) {
    if (tokens.accountToken) await SecureStore.setItemAsync(STORE_ACCT_KEY, tokens.accountToken);
    else await SecureStore.deleteItemAsync(STORE_ACCT_KEY);
  }
  if (tokens.profileToken !== undefined) {
    if (tokens.profileToken) await SecureStore.setItemAsync(STORE_PROF_KEY, tokens.profileToken);
    else await SecureStore.deleteItemAsync(STORE_PROF_KEY);
  }
  if (tokens.trustToken !== undefined) {
    if (tokens.trustToken) await SecureStore.setItemAsync(STORE_TRUST_KEY, tokens.trustToken);
    else await SecureStore.deleteItemAsync(STORE_TRUST_KEY);
  }
}

export async function clearAllTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(STORE_ACCT_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(STORE_PROF_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(STORE_TRUST_KEY).catch(() => undefined),
  ]);
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 14_000
): Promise<{ ok: boolean; status: number; data: T }> {
  const tokens = await getStoredTokens();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Cervos-Client": "mobile",
    ...(tokens.accountToken ? { Authorization: `Bearer ${tokens.accountToken}` } : {}),
    ...(tokens.profileToken ? { "X-Workspace-Profile": tokens.profileToken } : {}),
    ...(tokens.trustToken ? { "X-Workspace-Trusted": tokens.trustToken } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    } as Parameters<typeof fetch>[1]);
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Request timed out. Check connection.", 0, "TIMEOUT");
    }
    throw new ApiError(
      err instanceof Error ? err.message : "Network connection unavailable",
      0,
      "NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function signInWorkspace(payload: WorkspaceAuthSignInPayload) {
  const res = await apiRequest<WorkspaceAuthResponse & { error?: string }>("/api/workspace/auth", {
    method: "POST",
    body: JSON.stringify({ ...payload, clientMode: "bearer" }),
  });
  if (res.ok && res.data.tokens) {
    await saveTokens(res.data.tokens);
  }
  return res;
}

export async function signUpWorkspace(
  payload: WorkspaceAuthSignUpPayload | WorkspaceAuthRequestJoinPayload
) {
  const res = await apiRequest<WorkspaceAuthResponse & { error?: string }>("/api/workspace/auth", {
    method: "POST",
    body: JSON.stringify({ ...payload, clientMode: "bearer" }),
  });
  if (res.ok && res.data.tokens) {
    await saveTokens(res.data.tokens);
  }
  return res;
}

export async function signOutWorkspace() {
  await apiRequest("/api/workspace/auth", {
    method: "POST",
    body: JSON.stringify({ action: "signout" }),
  }).catch(() => undefined);
  await clearAllTokens();
}

export async function searchOrgs(q: string) {
  return apiRequest<{
    organizations: Array<{ id: string; orgName: string; region: string; ownerName: string }>;
  }>(`/api/workspace/orgs?q=${encodeURIComponent(q)}`, { method: "GET" });
}

export async function fetchWorkspaceState() {
  return apiRequest<WorkspaceStateResponse & { error?: string }>("/api/workspace/state", {
    method: "GET",
  });
}

export async function postWorkspaceAction<T = Record<string, unknown>>(
  payload: Record<string, unknown>
) {
  return apiRequest<T & { ok?: boolean; error?: string }>("/api/workspace/state", {
    method: "POST",
    body: JSON.stringify({ ...payload, clientMode: "bearer" }),
  });
}

export async function postGateAction(payload: Record<string, unknown>) {
  const res = await apiRequest<
    Record<string, unknown> & {
      ok?: boolean;
      error?: string;
      tokens?: { profileToken?: string; trustToken?: string };
    }
  >("/api/workspace/gate", {
    method: "POST",
    body: JSON.stringify({ ...payload, clientMode: "bearer" }),
  });
  if (res.ok && res.data.tokens) {
    await saveTokens(res.data.tokens);
  }
  return res;
}

export async function submitOnboarding(payload: Record<string, unknown>) {
  return apiRequest<{ ok?: boolean; error?: string }>("/api/workspace/onboarding", {
    method: "POST",
    body: JSON.stringify({ ...payload, clientMode: "bearer" }),
  });
}

export async function fetchLoungeState() {
  return apiRequest<Record<string, unknown> & { error?: string }>("/api/workspace/lounge", {
    method: "GET",
  });
}

export async function postLoungeAction(payload: Record<string, unknown>) {
  const res = await apiRequest<
    Record<string, unknown> & {
      ok?: boolean;
      error?: string;
      tokens?: { accountToken?: string; profileToken?: string };
    }
  >("/api/workspace/lounge", {
    method: "POST",
    body: JSON.stringify({ ...payload, clientMode: "bearer" }),
  });
  if (res.ok && res.data.tokens) {
    await saveTokens(res.data.tokens);
  }
  return res;
}

export async function fetchPackages(audience?: string) {
  const suffix = audience ? `?audience=${encodeURIComponent(audience)}` : "";
  return apiRequest<{ packages: Array<Record<string, unknown>> }>(`/api/workspace/packages${suffix}`, {
    method: "GET",
  });
}

export async function pullDeltaSync(sinceIso: string) {
  return apiRequest<Record<string, unknown>>(`/api/sync?since=${encodeURIComponent(sinceIso)}`, {
    method: "GET",
  });
}

export async function pushDeltaSync(mutations: Array<Record<string, unknown>>) {
  return apiRequest<{ ok?: boolean; syncedKeys?: string[]; serverTime?: string }>("/api/sync", {
    method: "POST",
    body: JSON.stringify({ mutations }),
  });
}
