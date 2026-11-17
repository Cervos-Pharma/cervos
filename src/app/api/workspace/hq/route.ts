import { noStoreJson } from "@/lib/workspace/cookies";

/** Legacy `/api/workspace/hq` path is intentionally retired (404) so predictable admin routes stay dark. */
export async function GET() {
  return noStoreJson({ error: "Not found" }, { status: 404 });
}

export async function POST() {
  return noStoreJson({ error: "Not found" }, { status: 404 });
}
