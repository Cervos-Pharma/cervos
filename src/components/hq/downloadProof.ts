"use client";

import type { HqFleetAccount } from "./types";

export type ProofCertificate = HqFleetAccount["certificates"][number];

/**
 * Decodes a base64 `data:<mime>;base64,...` URI into a real `Blob`.
 * Necessary because modern Chromium blocks large `data:` PDFs in iframes and `<a download>`.
 */
export function dataUrlToBlob(dataUrl?: string | null): Blob | null {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return null;
  const header = dataUrl.slice(5, comma);
  const mime = header.split(";")[0] || "application/octet-stream";
  const b64 = dataUrl.slice(comma + 1);
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildInspectionDossierText(
  org: HqFleetAccount,
  certificate?: ProofCertificate | null
): string {
  const certStatus =
    certificate?.status ??
    (org.verificationStatus === "verified" ? "verified" : "pending");
  return [
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
          certificate.fileDataUrl ? "" : "Binary attachment unavailable (uploaded prior to inline proof capture or > 2 MB).",
        ]
          .filter(Boolean)
          .join("\n")
      : "No individual certificate attached on this organization yet.",
  ].join("\n");
}

/** Downloads the real uploaded attachment via Blob URL, falling back to the inspection sheet. */
export function downloadCertificateProof(
  org: HqFleetAccount,
  certificate?: ProofCertificate | null
): "attachment" | "dossier" {
  const blob = dataUrlToBlob(certificate?.fileDataUrl);
  if (blob && certificate) {
    const cleanName = (certificate.fileName || "compliance-proof").replace(/[/\\:*?"<>|]+/g, "_");
    triggerBlobDownload(blob, cleanName);
    return "attachment";
  }
  const textBlob = new Blob([buildInspectionDossierText(org, certificate)], {
    type: "text/plain;charset=utf-8",
  });
  const slug = org.orgName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  triggerBlobDownload(textBlob, `${slug}-compliance-proof.txt`);
  return "dossier";
}
