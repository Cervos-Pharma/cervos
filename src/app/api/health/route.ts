import type { NextRequest } from "next/server";
import { isHqSecretConfigured } from "@/lib/hq-auth";
import { checkIpRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSigningSecretConfigured } from "@/lib/security/session";
import { createServiceClient } from "@/lib/supabase/server";
import { noStoreJson } from "@/lib/workspace/cookies";
import { getNotificationEnvStatus } from "@/lib/workspace/env";
import { getWorkspaceDb } from "@/lib/workspace/store";

export const dynamic = "force-dynamic";

function isConfiguredValue(raw: string | undefined): boolean {
  const trimmed = (raw ?? "").trim();
  return Boolean(trimmed) && !/YOUR-|REPLACE-WITH|placeholder/i.test(trimmed);
}

export async function GET(request: NextRequest) {
  const rl = checkIpRateLimit(request, "health-check", 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const mockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true";
  const supabaseUrlOk =
    isConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    /^https?:\/\//i.test((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim());
  const supabaseAnonOk = isConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabaseServiceOk = isConfiguredValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabaseConfigured = supabaseUrlOk && supabaseAnonOk && supabaseServiceOk;

  const appUrlRaw = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  const appUrlConfigured =
    isConfiguredValue(appUrlRaw) && /^https?:\/\//i.test(appUrlRaw);

  const hqSecretConfigured = isHqSecretConfigured();
  const sessionSecretConfigured = isSigningSecretConfigured();
  const paymeConfigured =
    isConfiguredValue(process.env.PAYME_APP_ID) &&
    isConfiguredValue(process.env.PAYME_APP_SECRET);
  const textifyConfigured = isConfiguredValue(process.env.TEXTIFY_API_KEY);
  const notifEnv = getNotificationEnvStatus();

  let workspaceDbReadable = false;
  try {
    const db = getWorkspaceDb();
    workspaceDbReadable = Array.isArray(db.accounts);
  } catch {
    workspaceDbReadable = false;
  }

  let supabaseReadable = mockMode ? true : false;
  let workspaceSnapshotOk = mockMode ? true : false;
  if (!mockMode && supabaseConfigured) {
    try {
      const supabase = await createServiceClient();
      const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error("timeout") }), 2500)
      );
      const [acctRes, wsRes] = await Promise.all([
        Promise.race([
          supabase.from("accounts").select("id", { count: "exact", head: true }).limit(1),
          timeoutPromise,
        ]),
        Promise.race([
          supabase.from("workspace_db").select("shard, updated_at").eq("shard", "main").maybeSingle(),
          timeoutPromise,
        ]),
      ]);
      supabaseReadable = !acctRes.error;
      workspaceSnapshotOk = !wsRes.error;
    } catch {
      supabaseReadable = false;
      workspaceSnapshotOk = false;
    }
  }

  const dbReadable = mockMode
    ? workspaceDbReadable
    : workspaceDbReadable && supabaseReadable && workspaceSnapshotOk;
  const requiredEnvReady = mockMode
    ? true
    : supabaseConfigured && hqSecretConfigured && appUrlConfigured && sessionSecretConfigured;

  const ok = dbReadable && requiredEnvReady;

  return noStoreJson(
    {
      ok,
      status: ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      mockMode,
      dbReadable,
      workspaceDbReadable,
      supabaseReadable,
      env: {
        nodeEnv: process.env.NODE_ENV ?? "development",
        mode: notifEnv.mode,
        appUrlConfigured,
        supabaseConfigured,
        hqSecretConfigured,
        sessionSecretConfigured,
        paymeConfigured,
        paymeEnvironment: process.env.PAYME_ENVIRONMENT === "production" ? "production" : "sandbox",
        textifyConfigured,
        exceptionWebhookConfigured: notifEnv.exceptionWebhookConfigured,
        exceptionEmailConfigured: notifEnv.exceptionEmailConfigured,
      },
    },
    { status: ok ? 200 : 503 }
  );
}
