import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { formatTzs } from "@cervos/core";
import type { WorkspaceSale } from "@/types/workspace";

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
        <div style="text-align:center;font-size:10px;color:#64748B;margin-top:12px;">
          Verified Official Receipt · Cervos Pharma
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
