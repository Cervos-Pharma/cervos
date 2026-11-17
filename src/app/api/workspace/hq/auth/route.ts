import { noStoreJson } from "@/lib/workspace/cookies";

/** Legacy `/api/workspace/hq/auth` path is intentionally retired (404). */
export async function GET() {
  return noStoreJson({ error: "Not found" }, { status: 404 });
}

export async function POST() {
  return noStoreJson({ error: "Not found" }, { status: 404 });
}
