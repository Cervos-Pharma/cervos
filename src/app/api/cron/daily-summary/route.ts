import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { noStoreJson } from "@/lib/workspace/cookies";
import { runDailyOwnerDigest } from "@/lib/workspace/daily-summary";
import { isValidHqSecret } from "@/lib/workspace/env";

export const dynamic = "force-dynamic";

function isAuthorizedCron(request: NextRequest): boolean {
  const opsKey = request.headers.get("x-ops-key") || request.headers.get("x-cervos-hq-secret");
  if (isValidHqSecret(opsKey)) return true;

  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const provided = authHeader.slice(7).trim();
    if (isValidHqSecret(provided)) return true;
    if (cronSecret) {
      const a = createHash("sha256").update(provided, "utf8").digest();
      const b = createHash("sha256").update(cronSecret, "utf8").digest();
      if (timingSafeEqual(a, b)) return true;
    }
  }

  // Allow Vercel platform scheduled Cron invocation when CRON_SECRET is unset
  if (!cronSecret && request.headers.get("x-vercel-cron") === "1") {
    return true;
  }

  return false;
}

/**
 * Automated Daily 18:00 EAT Summary SMS + In-App Digest Job (`0 15 * * *` UTC).
 */
async function runDailyDigest(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return noStoreJson({ error: "Unauthorized cron trigger." }, { status: 401 });
  }
  const force = request.nextUrl.searchParams.get("force") === "1";
  const targetAccountId = request.nextUrl.searchParams.get("accountId") || undefined;
  const result = await runDailyOwnerDigest({ force, targetAccountId });
  return noStoreJson(result);
}

export async function GET(request: NextRequest) {
  return runDailyDigest(request);
}

export async function POST(request: NextRequest) {
  return runDailyDigest(request);
}
