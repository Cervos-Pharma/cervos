/**
 * @route PUT /api/mock/storage/upload?path=<storage path>
 * @access HQ session required (HMAC cookie `hq_sess`)
 * @description Mock-mode stand-in for the Supabase Storage signed-PUT endpoint.
 *   The HQ Downloads client PUTs release binaries here when running with
 *   NEXT_PUBLIC_MOCK_MODE=true (the mock storage shim reports this URL as the
 *   "signed upload URL"). Files are stored under `.mock-releases/<path>` and
 *   later served by GET /mock/storage/app-releases/<path>.
 */
import { NextRequest, NextResponse } from "next/server";
import { promises as fsp } from "fs";
import path from "path";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";

const MOCK_DIR = path.join(process.cwd(), ".mock-releases");

export async function PUT(req: NextRequest) {
  const cookieStore = await (await import("next/headers")).cookies();
  if (!isValidHQToken(cookieStore.get(HQ_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storagePath = req.nextUrl.searchParams.get("path");
  if (!storagePath || storagePath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const file = path.join(MOCK_DIR, storagePath);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const body = await req.arrayBuffer();
  await fsp.writeFile(file, Buffer.from(body));

  return NextResponse.json({ ok: true, path: storagePath, size: body.byteLength });
}
