"use client";

import { useRef, useState } from "react";
import { IconCheck } from "@/components/LandingIcons";

interface CertificateDropzoneProps {
  fileName: string;
  onFileSelect: (fileName: string) => void;
  isDark?: boolean;
  isSw?: boolean;
  accept?: string;
}

/**
 * Refined drag-and-drop upload zone for pharmacy/supplier regulatory certificates.
 * Replaces generic native file inputs across Onboarding and Workspace Settings.
 */
export default function CertificateDropzone({
  fileName,
  onFileSelect,
  isDark = false,
  isSw = false,
  accept = ".pdf,.jpg,.jpeg,.png",
}: CertificateDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileSizeLabel, setFileSizeLabel] = useState<string>("");

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    onFileSelect(file.name);
    const kb = file.size / 1024;
    setFileSizeLabel(kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="sr-only"
      />

      {fileName ? (
        <div
          className={`rounded-md border px-4 py-3.5 flex items-center justify-between gap-3 transition-all ${
            isDark
              ? "border-emerald-500/40 bg-emerald-950/25 text-emerald-100"
              : "border-emerald-300 bg-emerald-50/70 text-[#0F172A]"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-md bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
              <IconCheck className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{fileName}</div>
              <div className={`text-[11px] ${isDark ? "text-emerald-300/80" : "text-emerald-700"}`}>
                {fileSizeLabel ? `${fileSizeLabel} · ` : ""}
                {isSw ? "Tayari kuthibitishwa" : "Ready for compliance check"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`px-2.5 py-1.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  : "border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-slate-50"
              }`}
            >
              {isSw ? "Badili" : "Replace"}
            </button>
            <button
              type="button"
              onClick={() => {
                onFileSelect("");
                setFileSizeLabel("");
                if (inputRef.current) inputRef.current.value = "";
              }}
              aria-label="Clear file"
              className={`px-2 py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                isDark ? "text-slate-400 hover:text-rose-400" : "text-slate-500 hover:text-rose-600"
              }`}
            >
              &times;
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`rounded-md border border-dashed px-4 py-5 flex items-center gap-4 transition-all cursor-pointer select-none ${
            dragging
              ? "border-[#1039B9] bg-blue-50/70 ring-1 ring-[#1039B9]"
              : isDark
                ? "border-slate-700 bg-slate-900/50 hover:border-[#38BDF8] hover:bg-slate-900/80"
                : "border-slate-300 bg-white hover:border-[#1039B9] hover:bg-blue-50/30"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 transition-colors ${
              isDark ? "bg-slate-800 text-[#38BDF8]" : "bg-[#EFF6FF] text-[#1039B9]"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-xs font-semibold ${isDark ? "text-slate-100" : "text-[#0F172A]"}`}>
              {isSw ? "Bonyeza au buruta cheti hapa" : "Click to attach permit or drop file here"}
            </div>
            <div className={`text-[11px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {isSw ? "PDF, JPG, au PNG (hadi 10 MB)" : "PDF, JPG, or PNG · Official TMDA / BRELA / Clinic scan"}
            </div>
          </div>
          <span
            className={`hidden sm:inline-flex px-3 py-1.5 rounded text-[11px] font-semibold border shrink-0 ${
              isDark
                ? "border-slate-700 bg-slate-800 text-slate-200"
                : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A]"
            }`}
          >
            {isSw ? "Chagua Faili" : "Browse"}
          </span>
        </div>
      )}
    </div>
  );
}
