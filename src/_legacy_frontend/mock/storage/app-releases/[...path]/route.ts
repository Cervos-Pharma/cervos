/**
 * @route GET /mock/storage/app-releases/<path>
 * @access Public
 * @description Mock-mode stand-in for Supabase Storage. Serves release binaries
 *   from `<repo>/.mock-releases/<path>` so the public /download page and the
 *   /api/downloads/[id]/redirect route work end-to-end without a real Supabase
 *   project. Files land here via /api/mock/storage/upload (used by the HQ
 *   Downloads page in mock mode).
 */
import { NextRequest, NextResponse } from "next/server";
import { promises as fsp } from "fs";
import path from "path";

const MOCK_DIR = path.join(process.cwd(), ".mock-releases");

const MIME: Record<string, string> = {
  ".apk": "application/vnd.android.package-archive",
  ".exe": "application/octet-stream",
  ".dmg": "application/x-apple-diskimage",
  ".deb": "application/vnd.debian.binary-package",
  ".appimage": "application/x-executable",
  ".zip": "application/zip",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params;
  const rel = parts.join("/");

  if (!rel || rel.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = path.join(MOCK_DIR, rel);
  try {
    const data = await fsp.readFile(file);
    const ext = path.extname(file).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="${path.basename(file)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
