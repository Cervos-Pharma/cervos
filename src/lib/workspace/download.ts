"use client";

const KNOWN_INSTALLER_FILES = [
  "Cervos-Pharma.apk",
  "Cervos-POS-Setup.exe",
  "Cervos-Supplier-Portal-Setup.exe",
];

/**
 * Convert external GitHub release download links into our same-origin
 * streaming endpoint (`/api/downloads/installer?file=...`) so the active page
 * never navigates to GitHub or shows an unloaded interstitial page.
 */
export function resolveBackgroundDownloadUrl(rawHref: string): {
  url: string;
  filename: string | null;
} {
  for (const file of KNOWN_INSTALLER_FILES) {
    if (rawHref.includes(file)) {
      return {
        url: `/api/downloads/installer?file=${encodeURIComponent(file)}`,
        filename: file,
      };
    }
  }
  return { url: rawHref, filename: null };
}

/**
 * Start an installer download quietly in the background without navigating
 * or opening an extra tab. Uses a same-origin `<a download>` anchor backed
 * by `Content-Disposition: attachment` so every desktop and mobile browser
 * stays on the current screen while the file downloads in the tray.
 */
export function triggerBackgroundDownload(rawHref: string): string {
  const { url, filename } = resolveBackgroundDownloadUrl(rawHref);
  if (typeof document === "undefined") return filename || "installer";

  const link = document.createElement("a");
  link.href = url;
  if (filename) link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    try {
      link.remove();
    } catch {
      /* ignore cleanup race */
    }
  }, 5000);

  return filename || "installer";
}
