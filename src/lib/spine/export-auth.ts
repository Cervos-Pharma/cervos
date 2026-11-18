import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HQ_COOKIE_NAME, isValidHQToken, parseHqToken } from "@/lib/hq-auth";
import {
  canHqWorker,
  clampHqCapabilities,
  type HqWorkerCapabilities,
} from "@/lib/hq-workers";
import { getWorkspaceDb, warmDbFromSupabase } from "@/lib/workspace/store";

export async function authorizeHqExport(requiredCap: keyof HqWorkerCapabilities) {
  const cookieStore = await cookies();
  const token = cookieStore.get(HQ_COOKIE_NAME)?.value;
  const parsed = parseHqToken(token);
  if (!parsed || !isValidHQToken(token)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  await warmDbFromSupabase();
  const db = getWorkspaceDb();
  const worker = (db.hqWorkers ?? []).find((w) => w.id === parsed.adminId);
  const role = worker?.role ?? parsed.role;
  const caps = clampHqCapabilities(role, worker?.capabilities);

  if (worker?.status === "suspended" || !canHqWorker(role, caps, requiredCap)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: `Clearance denied: ${requiredCap} required.` },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, db, workerId: parsed.adminId };
}
