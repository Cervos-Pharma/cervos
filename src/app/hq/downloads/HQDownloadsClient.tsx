/**
 * @file hq/downloads/HQDownloadsClient.tsx
 * @description Client component for the HQ Downloads management page.
 *
 * Features:
 *  - Upload form: platform dropdown, version input, release notes textarea, file picker
 *  - Release table grouped by platform with "Set as current" and "Delete" actions
 *  - Optimistic updates with Toast feedback
 *
 * Note: Uses useState for loading state (not useTransition — React 18 doesn't
 * support async functions inside startTransition).
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { getSignedUploadUrl, confirmUpload, setCurrentRelease, deleteRelease, checkStorageBucket } from "@/lib/actions/hq";
import { AppRelease } from "@/lib/actions/hq";
import Toast from "@/components/Toast";

interface HQDownloadsClientProps {
  releases: AppRelease[];
}

const PLATFORMS = [
  { value: "windows", label: "Windows", icon: "window", ext: [".exe"] },
  { value: "mac", label: "macOS", icon: "laptop_mac", ext: [".dmg"] },
  { value: "linux", label: "Linux", icon: "terminal", ext: [".deb", ".AppImage"] },
  { value: "android", label: "Android", icon: "smartphone", ext: [".apk"] },
] as const;

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function PlatformIcon({ platform }: { platform: string }) {
  const config = PLATFORMS.find((p) => p.value === platform);
  return (
    <span className="material-symbols-outlined text-[18px] text-primary">
      {config?.icon ?? "install_desktop"}
    </span>
  );
}

export default function HQDownloadsClient({ releases: initialReleases }: HQDownloadsClientProps) {
  const [releases, setReleases] = useState<AppRelease[]>(initialReleases);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [bucketWarning, setBucketWarning] = useState<string | null>(null);

  // Upload form state
  const [uploading, setUploading] = useState(false);
  const [platform, setPlatform] = useState<string>("windows");
  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-row action state
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Check storage bucket on mount
  useEffect(() => {
    checkStorageBucket().then((result) => {
      if (result.error && !result.configured) {
        setBucketWarning(
          "Storage bucket 'app-releases' is not configured. Upload will fail. " +
          "Go to Supabase Storage > New bucket > Name: 'app-releases' > Set as Private."
        );
      }
    });
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setToast({ message: "Please select a file to upload.", type: "error" });
      return;
    }

    // Validate file extension matches selected platform
    const platformConfig = PLATFORMS.find((p) => p.value === platform);
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    const isValidExt = platformConfig?.ext.some((e) => fileExt === e);
    if (!isValidExt) {
      setToast({
        message: `Invalid file type for ${platformConfig?.label}. Expected ${platformConfig?.ext.join(", ")}, got ${fileExt}.`,
        type: "error",
      });
      return;
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setToast({
        message: `File too large. Maximum size is ${formatBytes(MAX_FILE_SIZE_BYTES)}, got ${formatBytes(selectedFile.size)}.`,
        type: "error",
      });
      return;
    }

    setUploading(true);
    try {
      // Phase 1 — obtain a signed upload URL from the server (HQ-auth validated).
      // The file never passes through the Next.js server, so there is no body-size limit.
      const { signedUrl, path, error: urlError } = await getSignedUploadUrl(
        platform,
        version,
        selectedFile.name
      );
      if (urlError || !signedUrl || !path) {
        setToast({ message: urlError ?? "Failed to get upload URL.", type: "error" });
        return;
      }

      // Phase 2 — PUT the binary directly to Supabase Storage.
      // Note: Supabase signed URLs expect application/octet-stream for binary uploads.
      // The actual Content-Type is stored in metadata by Supabase automatically.
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: selectedFile,
      });
      if (!putRes.ok) {
        let errorDetail = `Storage upload failed (HTTP ${putRes.status}).`;
        if (putRes.status === 403) {
          errorDetail += " This may indicate a CORS configuration issue or expired signed URL.";
        } else if (putRes.status === 404) {
          errorDetail = "Storage bucket 'app-releases' not found. Please ensure it exists in Supabase Storage.";
        }
        setToast({ message: errorDetail, type: "error" });
        return;
      }

      // Phase 3 — tell the server to record the release in the database.
      // If this fails, the server action will clean up the orphaned file from storage.
      const { error: confirmError } = await confirmUpload(
        platform,
        version,
        path,
        selectedFile.size,
        releaseNotes || null
      );
      if (confirmError) {
        setToast({ message: confirmError, type: "error" });
        return;
      }

      setToast({ message: "Release uploaded successfully.", type: "success" });
      // Reset form
      setVersion("");
      setReleaseNotes("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Reload so the server component re-fetches the updated release list
      window.location.reload();
    } catch (err) {
      // Catch network errors from the PUT phase
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during upload.";
      setToast({ message: `Upload failed: ${msg}`, type: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSetCurrent(release: AppRelease) {
    setSettingCurrentId(release.id);
    try {
      const result = await setCurrentRelease(release.id);
      if (result.error) {
        setToast({ message: result.error, type: "error" });
      } else {
        // Optimistic update: demote others in same platform, promote this one
        setReleases((prev) =>
          prev.map((r) =>
            r.platform === release.platform
              ? { ...r, is_current: r.id === release.id }
              : r
          )
        );
        setToast({ message: `Set as current ${release.platform} release.`, type: "success" });
      }
    } finally {
      setSettingCurrentId(null);
    }
  }

  async function handleDelete(release: AppRelease) {
    setDeletingId(release.id);
    setConfirmDeleteId(null);
    try {
      const result = await deleteRelease(release.id, release.file_path || release.file_url);
      if (result.error) {
        setToast({ message: result.error, type: "error" });
      } else {
        setReleases((prev) => prev.filter((r) => r.id !== release.id));
        setToast({ message: "Release deleted.", type: "info" });
      }
    } finally {
      setDeletingId(null);
    }
  }

  const grouped: Record<string, AppRelease[]> = { windows: [], mac: [], linux: [], android: [] };
  for (const r of releases) {
    if (grouped[r.platform]) grouped[r.platform].push(r);
  }

  return (
    <>
      {/* ── Storage Bucket Warning ────────────────────────────────────────── */}
      {bucketWarning && (
        <div className="bg-error/10 border border-error/30 rounded p-4 mb-6 flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-[20px] mt-0.5">warning</span>
          <div>
            <p className="font-label-md text-label-md text-error">Storage bucket not configured</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{bucketWarning}</p>
          </div>
        </div>
      )}

      {/* ── Upload Form ─────────────────────────────────────────────────── */}
      <div className="bg-surface-base border border-outline-variant rounded overflow-hidden mb-10">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm text-ink-deep flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">upload_file</span>
            Upload New Release
          </h2>
        </div>

        <form onSubmit={handleUpload} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Platform */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface-variant text-sm uppercase tracking-wider">
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="bg-surface border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-ink-deep focus:outline-none focus:border-primary transition-colors"
              disabled={uploading}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} ({p.ext.join(", ")})
                </option>
              ))}
            </select>
          </div>

          {/* Version */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface-variant text-sm uppercase tracking-wider">
              Version Label
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 2.5.0"
              required
              disabled={uploading}
              className="bg-surface border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-ink-deep placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Release Notes */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="font-label-md text-label-md text-on-surface-variant text-sm uppercase tracking-wider">
              Release Notes <span className="text-on-surface-variant/50 normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="Describe what changed in this release…"
              rows={3}
              disabled={uploading}
              className="bg-surface border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-ink-deep placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* File picker */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="font-label-md text-label-md text-on-surface-variant text-sm uppercase tracking-wider">
              Installer File
            </label>
            <div
              className="border-2 border-dashed border-outline-variant hover:border-primary/50 transition-colors p-6 flex flex-col items-center gap-3 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="material-symbols-outlined text-[36px] text-primary/40">
                cloud_upload
              </span>
              {selectedFile ? (
                <div className="text-center">
                  <p className="font-label-md text-label-md text-ink-deep">{selectedFile.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Click to select installer file
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant/60 mt-0.5">
                    .exe, .dmg, .deb, .AppImage, .apk accepted
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".exe,.dmg,.deb,.AppImage,.apk"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
              />
              <p className="font-body-sm text-body-sm text-on-surface-variant/60 mt-0.5">
                Max file size: 500 MB
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={uploading || !selectedFile || !version.trim()}
              className="bg-primary text-on-primary px-6 py-2.5 font-label-md text-label-md flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">upload</span>
                  Upload Release
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Release Table ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-8">
        {PLATFORMS.map(({ value: plt, label, icon }) => {
          const rows = grouped[plt] ?? [];
          return (
            <div key={plt} className="bg-surface-base border border-outline-variant rounded overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
                <h2 className="font-headline-sm text-headline-sm text-ink-deep">{label}</h2>
                <span className="ml-auto font-label-md text-label-md text-on-surface-variant text-xs">
                  {rows.length} release{rows.length !== 1 ? "s" : ""}
                </span>
              </div>

              {rows.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant/30 block mb-2">
                    inbox
                  </span>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    No releases uploaded yet for {label}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-container-low/50">
                      <tr>
                        {["Version", "Size", "Release Notes", "Status", "Uploaded", "Actions"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-6 py-3 font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {rows.map((r) => {
                        const isSettingCurrent = settingCurrentId === r.id;
                        const isDeleting = deletingId === r.id;
                        const isConfirmingDelete = confirmDeleteId === r.id;

                        return (
                          <tr
                            key={r.id}
                            className={`hover:bg-surface-container-low/30 transition-colors ${
                              r.is_current ? "bg-primary/[0.03]" : ""
                            }`}
                          >
                            {/* Version */}
                            <td className="px-6 py-4 font-body-md text-body-md text-ink-deep font-medium">
                              <div className="flex items-center gap-2">
                                <PlatformIcon platform={r.platform} />
                                {r.version}
                              </div>
                            </td>

                            {/* Size */}
                            <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                              {formatBytes(r.file_size_bytes)}
                            </td>

                            {/* Release Notes */}
                            <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant max-w-[200px]">
                              {r.release_notes ? (
                                <span className="line-clamp-2" title={r.release_notes}>
                                  {r.release_notes}
                                </span>
                              ) : (
                                <span className="text-on-surface-variant/40 italic">None</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4">
                              {r.is_current ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-label-md">
                                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                                  Current
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-label-md">
                                  Archived
                                </span>
                              )}
                            </td>

                            {/* Uploaded */}
                            <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                              {new Date(r.uploaded_at).toLocaleDateString()}
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {/* Set as current */}
                                {!r.is_current && (
                                  <button
                                    onClick={() => handleSetCurrent(r)}
                                    disabled={isSettingCurrent || isDeleting}
                                    className="text-primary font-label-md text-label-md text-sm hover:underline disabled:opacity-60 flex items-center gap-1 whitespace-nowrap"
                                  >
                                    {isSettingCurrent ? (
                                      <div className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
                                    ) : (
                                      <span className="material-symbols-outlined text-[14px]">star</span>
                                    )}
                                    Set Current
                                  </button>
                                )}

                                {/* Delete */}
                                {isConfirmingDelete ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-body-sm text-body-sm text-error text-xs">Confirm?</span>
                                    <button
                                      onClick={() => handleDelete(r)}
                                      disabled={isDeleting}
                                      className="text-error font-label-md text-label-md text-xs hover:underline"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-on-surface-variant font-label-md text-label-md text-xs hover:underline"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(r.id)}
                                    disabled={isDeleting || isSettingCurrent}
                                    className="text-on-surface-variant hover:text-error font-label-md text-label-md text-sm transition-colors disabled:opacity-60 flex items-center gap-1"
                                  >
                                    {isDeleting ? (
                                      <div className="w-3 h-3 border border-error/40 border-t-error rounded-full animate-spin" />
                                    ) : (
                                      <span className="material-symbols-outlined text-[14px]">delete</span>
                                    )}
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
