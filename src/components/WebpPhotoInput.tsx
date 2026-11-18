"use client";

import { useRef, useState } from "react";
import { compressImageToWebp } from "@/lib/workspace/image-compress";

interface WebpPhotoInputProps {
  value: string;
  onChange: (nextUrl: string) => void;
  label?: string;
  maxEdge?: number;
  isDark?: boolean;
  accent?: string;
  compact?: boolean;
}

/**
 * Mobile camera & desktop file photo capture with automatic 360-480p WebP
 * compression, live thumbnail preview, and optional fallback URL entry.
 */
export default function WebpPhotoInput({
  value,
  onChange,
  label = "Product Photo (480p WebP)",
  maxEdge = 480,
  isDark = false,
  accent = "#1039B9",
  compact = false,
}: WebpPhotoInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const [metaNote, setMetaNote] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [showUrlField, setShowUrlField] = useState(false);

  const chipCls = isDark
    ? "bg-[#171D28] border-slate-700 text-slate-200"
    : "bg-white border-[#CBD5E1] text-[#111317]";
  const mutedCls = isDark ? "text-slate-400" : "text-[#64748B]";

  const handleFilePick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrMsg("Select a photo or image file.");
      return;
    }
    setCompressing(true);
    setErrMsg(null);
    setMetaNote(null);
    try {
      const res = await compressImageToWebp(file, { maxEdge });
      onChange(res.dataUrl);
      setMetaNote(`${res.width}x${res.height} WebP (${res.kb} KB)`);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Could not process image.");
    } finally {
      setCompressing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlField((v) => !v)}
          className="text-[10px] font-semibold hover:underline cursor-pointer"
          style={{ color: accent }}
        >
          {showUrlField ? "Hide URL" : "or paste link"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleFilePick(e.target.files?.[0])}
        className="sr-only"
      />

      <div
        className={`rounded-xl border flex items-center gap-3 ${compact ? "p-2" : "p-2.5"} ${chipCls}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Product preview"
            className="w-11 h-11 rounded-lg object-cover border border-slate-500/20 shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={compressing}
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {compressing && (
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              <span>{compressing ? "Compressing WebP..." : value ? "Retake / Replace" : "Take Photo / Upload"}</span>
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setMetaNote(null);
                }}
                className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
          {metaNote && <div className="text-[10px] font-mono text-emerald-500">{metaNote}</div>}
          {!metaNote && (
            <div className={`text-[10px] truncate ${mutedCls}`}>
              Auto-resized to 480p WebP for fast offline sync
            </div>
          )}
        </div>
      </div>

      {errMsg && <div className="text-[10px] font-medium text-rose-500">{errMsg}</div>}

      {showUrlField && (
        <input
          type="text"
          value={value.startsWith("data:") ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... or /images/..."
          className={`w-full px-3 py-2 rounded-xl border text-xs ${chipCls}`}
        />
      )}
    </div>
  );
}
