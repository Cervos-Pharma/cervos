import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkIpRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = checkIpRateLimit(req, "download-meta", 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing release ID" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: release, error } = await supabase
    .from("app_releases")
    .select("file_path, file_url, platform, version")
    .eq("id", id)
    .single();

  if (error || !release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  const filePath = release.file_path || release.file_url;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/app-releases/${filePath}`;

  return NextResponse.json({ url: publicUrl });
}
