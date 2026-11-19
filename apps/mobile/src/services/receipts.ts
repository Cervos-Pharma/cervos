import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { buildReceiptQrPayload, formatTzs } from "@cervos/core";
import type { WorkspaceSale } from "@/types/workspace";
import { buildQrSvgMarkup } from "@/utils/qr-matrix";

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildReceiptHtml(params: {
  orgName: string;
  branchName: string;
  sale: WorkspaceSale;
  paperWidthMm?: 58 | 80;
}): string {
  const { orgName, branchName, sale, paperWidthMm = 80 } = params;
  const maxPx = paperWidthMm === 58 ? 220 : 300;
  const receiptNumber = sale.receiptNumber || `RCP-${sale.id.slice(-6).toUpperCase()}`;
  const qrPayload = buildReceiptQrPayload(receiptNumber, sale.id);
  const qrSvg = buildQrSvgMarkup(qrPayload, paperWidthMm === 58 ? 88 : 108);
  const lines = sale.lines ?? [];
  const rowsHtml =
    lines.length > 0
      ? lines
          .map(
            (l) => `
          <tr>
            <td style="padding:4px 0;">
              <strong>${escapeHtml(l.brandName)}</strong><br/>
              <span style="color:#64748B;font-size:10px;">Batch ${escapeHtml(l.batchNumber || "Auto")} · ${l.qty} x ${formatTzs(l.unitPriceTzs)}</span>
            </td>
            <td style="text-align:right;font-weight:700;vertical-align:top;padding:4px 0;">
              ${formatTzs(l.qty * l.unitPriceTzs)}
            </td>
          </tr>
        `
          )
          .join("")
      : `<tr><td>Counter Basket (${sale.itemCount} packs)</td><td style="text-align:right;font-weight:700;">${formatTzs(sale.totalTzs)}</td></tr>`;

  return `
    <!doctype html>
    <html>
      <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:${maxPx}px;margin:0 auto;padding:12px;color:#111317;">
        <div style="text-align:center;border-bottom:1px dashed #CBD5E1;padding-bottom:8px;margin-bottom:8px;">
          <div style="font-size:15px;font-weight:800;">${escapeHtml(orgName)}</div>
          <div style="font-size:11px;color:#475569;">${escapeHtml(branchName)}</div>
          <div style="font-size:10px;color:#64748B;margin-top:4px;">
            ${escapeHtml(sale.receiptNumber || sale.id.slice(-8).toUpperCase())} · ${escapeHtml(sale.createdAt.slice(0, 16).replace("T", " "))}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          ${rowsHtml}
        </table>
        <div style="border-top:1px dashed #CBD5E1;margin-top:8px;padding-top:8px;font-size:12px;">
          <div style="display:flex;justify-content:space-between;font-weight:800;font-size:14px;">
            <span>TOTAL</span>
            <span>${formatTzs(sale.totalTzs)}</span>
          </div>
          <div style="font-size:11px;color:#475569;margin-top:4px;">
            Channel: ${escapeHtml(sale.paymentMethod.toUpperCase())}<br/>
            Customer: ${escapeHtml(sale.customerName || "Walk-in Patient")}<br/>
            Cashier: ${escapeHtml(sale.actorName)}
            ${sale.prescriptionRef ? `<br/>Rx Ref: ${escapeHtml(sale.prescriptionRef)}` : ""}
          </div>
        </div>
        <div style="text-align:center;margin-top:12px;padding-top:10px;border-top:1px dashed #CBD5E1;">
          <div style="display:inline-block;padding:4px;border:1px solid #E2E8F0;border-radius:8px;background:#FFFFFF;">
            ${qrSvg}
          </div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;color:#334155;margin-top:6px;word-break:break-all;">
            ${escapeHtml(qrPayload)}
          </div>
          <div style="font-size:10px;color:#64748B;margin-top:4px;">
            Verified Official Receipt · Cervos Pharma
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function printReceiptNative(params: {
  orgName: string;
  branchName: string;
  sale: WorkspaceSale;
  paperWidthMm?: 58 | 80;
}) {
  const html = buildReceiptHtml(params);
  await Print.printAsync({ html });
}

export async function shareReceiptPdf(params: {
  orgName: string;
  branchName: string;
  sale: WorkspaceSale;
  paperWidthMm?: 58 | 80;
}) {
  const html = buildReceiptHtml(params);
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: params.sale.receiptNumber || "Pharmacy Receipt",
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
}

export async function shareIntelligenceReportPdf(params: {
  orgName: string;
  branchName: string;
  windowDays: number;
  metrics: Array<{ label: string; value: string }>;
  rows: Array<{ col1: string; col2: string; col3: string }>;
  tableHeaders: [string, string, string];
  narrative: string;
}) {
  const html = `
    <!doctype html>
    <html>
      <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:28px;color:#111317;">
        <div style="border-bottom:2px solid #1039B9;padding-bottom:12px;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:#1039B9;text-transform:uppercase;">CERVOS INTELLIGENCE REPORT</div>
          <h1 style="margin:4px 0 2px;font-size:20px;">${escapeHtml(params.orgName)} · ${escapeHtml(params.branchName)}</h1>
          <div style="font-size:12px;color:#64748B;">Last ${params.windowDays} days · Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}</div>
        </div>
        <p style="font-size:13px;line-height:1.5;color:#334155;background:#F8FAFC;padding:12px;border-radius:8px;border:1px solid #E2E8F0;">${escapeHtml(params.narrative)}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0;">
          ${params.metrics
            .map(
              (m) => `
            <div style="flex:1;min-width:130px;padding:10px;border:1px solid #E2E8F0;border-radius:8px;">
              <div style="font-size:10px;color:#64748B;text-transform:uppercase;font-weight:700;">${escapeHtml(m.label)}</div>
              <div style="font-size:15px;font-weight:800;margin-top:3px;">${escapeHtml(m.value)}</div>
            </div>
          `
            )
            .join("")}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px;">
          <thead>
            <tr style="background:#F1F5F9;text-align:left;">
              <th style="padding:8px;border-bottom:1px solid #CBD5E1;">${escapeHtml(params.tableHeaders[0])}</th>
              <th style="padding:8px;border-bottom:1px solid #CBD5E1;">${escapeHtml(params.tableHeaders[1])}</th>
              <th style="padding:8px;border-bottom:1px solid #CBD5E1;text-align:right;">${escapeHtml(params.tableHeaders[2])}</th>
            </tr>
          </thead>
          <tbody>
            ${params.rows
              .map(
                (r) => `
              <tr>
                <td style="padding:7px 8px;border-bottom:1px solid #E2E8F0;">${escapeHtml(r.col1)}</td>
                <td style="padding:7px 8px;border-bottom:1px solid #E2E8F0;color:#475569;">${escapeHtml(r.col2)}</td>
                <td style="padding:7px 8px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:700;">${escapeHtml(r.col3)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `${params.orgName} Report`,
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
}
