/**
 * @route GET /api/downloads/[id]/redirect
 * @access Public — release ID is the only credential needed
 * @description Fetches the storage path for a release, generates a short-lived
 *   signed Supabase Storage URL, and redirects the browser there. This avoids
 *   exposing raw storage paths and works even if the bucket is private.
 *
 *   Fallback: if the release has a publicly accessible file_url (already a full
 *   URL), redirect directly to it.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  if (!filePath) {
    return NextResponse.json({ error: "No file associated with this release" }, { status: 404 });
  }

  // Count this as a real download. Best-effort — a logging failure should
  // never block the actual file from being served.
  supabase.rpc("increment_release_download_count", { p_release_id: id }).then(
    () => {},
    (err) => console.error("Failed to record download count:", err)
  );

  // If file_url is already a full public URL (starts with http), redirect directly
  if (release.file_url && release.file_url.startsWith("http")) {
    return NextResponse.redirect(release.file_url);
  }

  // Mock mode: no real Supabase to sign URLs. Seeded releases carry a local
  // public path (/mock/storage/app-releases/...); freshly uploaded ones carry
  // the bare storage path — prefix it and serve from the mock storage route.
  if (IS_MOCK && release.file_url && !release.file_url.startsWith("http")) {
    const mockPath = release.file_url.startsWith("/")
      ? release.file_url
      : `/mock/storage/app-releases/${release.file_url}`;
    return NextResponse.redirect(new URL(mockPath, req.url));
  }

  // Otherwise construct the Supabase Storage URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const filename = filePath.split("/").pop() || "download";

  // Generate a short-lived signed URL for private buckets
  const { data: signedData, error: signError } = await supabase.storage
    .from("app-releases")
    .createSignedUrl(filePath, 3600); // 1 hour

  // The `download` query param makes Supabase Storage add
  // `Content-Disposition: attachment; filename=...` to the response. Without
  // it, Android Chrome can silently ignore the redirect (bare
  // application/octet-stream + redirect chain) instead of saving the file.
  if (signError || !signedData?.signedUrl) {
    // Fallback: redirect to public URL directly (bucket must be public)
    const publicUrl = new URL(
      `${supabaseUrl}/storage/v1/object/public/app-releases/${filePath}`,
    );
    publicUrl.searchParams.set("download", filename);
    return NextResponse.redirect(publicUrl);
  }

  // new URL(...) keeps absolute URLs intact and resolves the mock shim's
  // relative signed URLs against this request's origin.
  const target = new URL(signedData.signedUrl, req.url);
  target.searchParams.set("download", filename);
  return NextResponse.redirect(target);
}
