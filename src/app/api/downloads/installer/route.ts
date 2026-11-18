import type { NextRequest } from "next/server";

export const runtime = "edge";

const RELEASE_ASSETS: Record<
  string,
  { url: string; contentType: string; filename: string }
> = {
  "Cervos-Pharma.apk": {
    url: "https://github.com/Cervos-Pharma/cervos/releases/download/installers/Cervos-Pharma.apk",
    contentType: "application/vnd.android.package-archive",
    filename: "Cervos-Pharma.apk",
  },
  "Cervos-POS-Setup.exe": {
    url: "https://github.com/Cervos-Pharma/cervos/releases/download/installers/Cervos-POS-Setup.exe",
    contentType: "application/vnd.microsoft.portable-executable",
    filename: "Cervos-POS-Setup.exe",
  },
  "Cervos-Supplier-Portal-Setup.exe": {
    url: "https://github.com/Cervos-Pharma/cervos/releases/download/installers/Cervos-Supplier-Portal-Setup.exe",
    contentType: "application/vnd.microsoft.portable-executable",
    filename: "Cervos-Supplier-Portal-Setup.exe",
  },
};

const TARGET_ALIAS: Record<string, string> = {
  android: "Cervos-Pharma.apk",
  apk: "Cervos-Pharma.apk",
  windows: "Cervos-POS-Setup.exe",
  pos: "Cervos-POS-Setup.exe",
  supplier: "Cervos-Supplier-Portal-Setup.exe",
};

/**
 * Same-origin Edge streaming proxy for desktop & Android installers.
 * Eliminates cross-origin GitHub page navigation / blank redirect screens
 * so browsers start saving the installer immediately in the background.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawFile = searchParams.get("file") || "";
  const rawTarget = (searchParams.get("target") || "").toLowerCase();
  const key = RELEASE_ASSETS[rawFile]
    ? rawFile
    : TARGET_ALIAS[rawTarget] || "";

  const asset = RELEASE_ASSETS[key];
  if (!asset) {
    return new Response(
      JSON.stringify({ error: "Unknown installer file requested." }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const upstream = await fetch(asset.url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Cervos-Downloader/1.0",
        Accept: "application/octet-stream",
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({
          error: `Installer release asset temporarily unavailable (HTTP ${upstream.status}).`,
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", asset.contentType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${asset.filename}"`
    );
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Download-Options", "noopen");
    headers.set("Cache-Control", "no-store");
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);

    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error ? err.message : "Failed to stream installer.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
