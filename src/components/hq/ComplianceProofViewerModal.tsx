"use client";

import { useEffect, useState } from "react";
import { hqSurfaceTokens } from "./hqSurface";
import type { HqFleetAccount } from "./types";

type ProofCertificate = HqFleetAccount["certificates"][number];

interface ComplianceProofViewerModalProps {
  org: HqFleetAccount;
  certificate?: ProofCertificate | null;
  isDark: boolean;
  busy: boolean;
  onClose: () => void;
  onVerifyDecision: (
    verified: boolean,
    note: string,
    certificateId?: string
  ) => Promise<void>;
}

export default function ComplianceProofViewerModal({
  org,
  certificate,
  isDark,
  busy,
  onClose,
  onVerifyDecision,
}: ComplianceProofViewerModalProps) {
  const t = hqSurfaceTokens(isDark);
  const [note, setNote] = useState(certificate?.reviewNote ?? "");

  useEffect(() => {
    setNote(certificate?.reviewNote ?? "");
  }, [certificate?.id, certificate?.reviewNote, org.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const certStatus =
    certificate?.status ??
    (org.verificationStatus === "verified" ? "verified" : "pending");

  const hasImagePreview = Boolean(certificate?.fileDataUrl?.startsWith("data:image/"));
  const hasPdfPreview = Boolean(
    certificate?.fileDataUrl?.startsWith("data:application/pdf")
  );

  const downloadInspectionRecord = () => {
    const lines = [
      "CERVOS PHARMA HQ - REGULATORY PERMIT INSPECTION RECORD",
      `Organization: ${org.orgName} (${org.roleType})`,
      `Account ID: ${org.id}`,
      `Owner / Admin: ${org.fullName} <${org.email}>`,
      `Region: ${org.region}`,
      `Account Verification Status: ${org.verificationStatus}`,
      `Network Unlocked: ${org.networkUnlocked ? "YES" : "NO"}`,
      "------------------------------------------------------",
      certificate
        ? [
            `Certificate ID: ${certificate.id}`,
            `Document Type: ${certificate.docType}`,
            `License / Permit Number: ${certificate.licenseNumber}`,
            `Uploaded File Name: ${certificate.fileName}`,
            `Uploaded At: ${certificate.uploadedAt}`,
            `Certificate Review Status: ${certStatus}`,
            certificate.reviewedBy ? `Reviewed By: ${certificate.reviewedBy}` : "",
            certificate.reviewedAt ? `Reviewed At: ${certificate.reviewedAt}` : "",
            certificate.reviewNote ? `Compliance Note: ${certificate.reviewNote}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "No individual certificate attached on this organization yet.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${org.orgName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-compliance-proof.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px] border p-6 space-y-4 shadow-2xl ${t.panelCls}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-sky-400">
              Compliance Proof Inspection
            </div>
            <h3
              className="text-lg font-bold mt-0.5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              {org.orgName} &middot; {certificate ? certificate.docType : "Compliance Record"}
            </h3>
            <div className={`text-xs mt-0.5 ${t.mutedCls}`}>
              {org.fullName} &middot; {org.email} &middot; {org.region}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                org.verificationStatus === "verified" && certStatus !== "rejected"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : certStatus === "rejected"
                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              }`}
            >
              {org.verificationStatus === "verified"
                ? "Verified"
                : certStatus === "rejected"
                  ? "Rejected / Unverified"
                  : "Unverified / Pending"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${t.pillCls}`}
            >
              Close
            </button>
          </div>
        </div>

        {/* Structured Regulatory Metadata Sheet */}
        <div className={`rounded-2xl p-4 space-y-2 text-xs ${t.wellCls}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className={`text-[10px] uppercase font-bold ${t.mutedCls}`}>Document Type</div>
              <div className="font-semibold mt-0.5">
                {certificate?.docType || "No permit document attached"}
              </div>
            </div>
            <div>
              <div className={`text-[10px] uppercase font-bold ${t.mutedCls}`}>
                Permit / License Number
              </div>
              <div className="font-mono font-bold mt-0.5">
                {certificate?.licenseNumber || "Not provided"}
              </div>
            </div>
            <div>
              <div className={`text-[10px] uppercase font-bold ${t.mutedCls}`}>Attachment File</div>
              <div className="font-mono mt-0.5 break-all">
                {certificate?.fileName || "None uploaded"}
              </div>
            </div>
            <div>
              <div className={`text-[10px] uppercase font-bold ${t.mutedCls}`}>Submitted At</div>
              <div className="font-mono mt-0.5">
                {certificate?.uploadedAt ? certificate.uploadedAt.slice(0, 19).replace("T", " ") : "-"}
              </div>
            </div>
          </div>

          {certificate?.reviewedBy && (
            <div className={`pt-2 border-t text-[11px] ${t.subtleBorderCls} ${t.mutedCls}`}>
              Last reviewed by <strong>{certificate.reviewedBy}</strong>
              {certificate.reviewedAt ? ` on ${certificate.reviewedAt.slice(0, 16).replace("T", " ")}` : ""}
              {certificate.reviewNote ? ` - Note: "${certificate.reviewNote}"` : ""}
            </div>
          )}
        </div>

        {/* Visual Document Preview */}
        {certificate && (
          <div className={`rounded-2xl border p-3 space-y-3 ${t.cardBorderCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">
                Submitted Proof Preview
              </span>
              <div className="flex items-center gap-2">
                {certificate.fileDataUrl && (
                  <a
                    href={certificate.fileDataUrl}
                    download={certificate.fileName || "compliance-proof"}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold ${t.pillCls}`}
                  >
                    Download Attachment
                  </a>
                )}
                <button
                  type="button"
                  onClick={downloadInspectionRecord}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${t.pillCls}`}
                >
                  Download Inspection Sheet
                </button>
              </div>
            </div>

            {hasImagePreview && certificate.fileDataUrl ? (
              <div className="rounded-xl overflow-hidden bg-slate-900/5 flex items-center justify-center max-h-[380px]">
                <img
                  src={certificate.fileDataUrl}
                  alt={certificate.fileName}
                  className="max-h-[380px] w-auto object-contain"
                />
              </div>
            ) : hasPdfPreview && certificate.fileDataUrl ? (
              <iframe
                src={certificate.fileDataUrl}
                title={certificate.fileName}
                className="w-full h-80 rounded-xl border border-slate-300 dark:border-slate-700 bg-white"
              />
            ) : (
              <div className={`p-4 rounded-xl text-xs space-y-1.5 ${t.wellCls}`}>
                <div className="font-semibold">
                  Metadata-only permit submission ({certificate.fileName})
                </div>
                <p className={t.mutedCls}>
                  This record was submitted before inline binary proof capture or exceeded inline preview size. Verify license reference{" "}
                  <span className="font-mono font-bold">{certificate.licenseNumber}</span> against the TMDA / Pharmacy Council register or request a fresh scan in Org Settings.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Compliance Decision Box */}
        <div className={`rounded-2xl border p-4 space-y-3 ${t.cardBorderCls}`}>
          <div className="text-xs font-bold uppercase tracking-wider">
            Compliance Decision &amp; Network Access
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={240}
            placeholder="Optional compliance audit note / rejection reason sent to organization..."
            className={`w-full h-9 px-3 rounded-xl text-xs ${t.inputCls}`}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onVerifyDecision(false, note.trim(), certificate?.id)}
              className="h-9 px-4 rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Mark Unverified / Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onVerifyDecision(true, note.trim(), certificate?.id)}
              className="h-9 px-5 rounded-full bg-emerald-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Mark Verified &amp; Unlock Network
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
