import { requestNativePrint } from "@/lib/native-bridge";

/**
 * Converts an array of objects to a CSV string with proper escaping.
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const header = columns.map((c) => `"${c.header}"`).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        const str = val == null ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...body].join("\n");
}

/**
 * Triggers a browser download of a UTF-8 CSV file (with Excel BOM for accents).
 */
export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Fetches and downloads a CSV from an API route.
 */
export async function fetchAndDownloadCSV(
  url: string,
  filename: string
) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const csv = await res.text();
  downloadCSV(csv, filename);
}

export interface PdfReportMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface PdfReportTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface CleanPdfReportSpec {
  orgName: string;
  logoDataUrl?: string | null;
  branchName: string;
  title: string;
  subtitle: string;
  generatedLabel: string;
  lang: "EN" | "SW";
  narrative?: string;
  metrics: PdfReportMetric[];
  highlights?: string[];
  tables: PdfReportTable[];
}

function safeLogoSrc(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(trimmed)) return trimmed;
  if (/^(\/|https:\/\/)/i.test(trimmed)) return trimmed;
  return null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders a standalone white-paper A4 HTML document into a hidden print frame
 * so Print / Save-as-PDF exports ONLY the crisp formatted report output
 * (never browser sidebars, scrollbars, or dark background chrome).
 */
export function exportCleanPdfReport(spec: CleanPdfReportSpec): void {
  if (typeof document === "undefined") return;

  const isSw = spec.lang === "SW";
  const safeLogo = safeLogoSrc(spec.logoDataUrl);
  const initials = (spec.orgName || "CP")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "CP";
  const logoHtml = safeLogo
    ? `<img src="${escapeHtml(safeLogo)}" alt="${escapeHtml(spec.orgName)}" class="logo-img" />`
    : `<div class="logo-badge">${escapeHtml(initials)}</div>`;

  const narrativeHtml = spec.narrative
    ? `<div class="narrative">
         <div class="sec-title">${isSw ? "Ufafanuzi wa Lugha Rahisi" : "Plain-Language Summary"}</div>
         <p>${escapeHtml(spec.narrative)}</p>
       </div>`
    : "";

  const metricsHtml = spec.metrics
    .map(
      (m) => `
      <div class="kpi">
        <div class="kpi-label">${escapeHtml(m.label)}</div>
        <div class="kpi-val">${escapeHtml(m.value)}</div>
        ${m.hint ? `<div class="kpi-hint">${escapeHtml(m.hint)}</div>` : ""}
      </div>`
    )
    .join("");

  const highlightsHtml =
    spec.highlights && spec.highlights.length > 0
      ? `<div class="box">
           <div class="sec-title">${isSw ? "Mambo Muhimu Yaliyogunduliwa" : "Key Takeaways"}</div>
           <ul>${spec.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>
         </div>`
      : "";

  const tablesHtml = spec.tables
    .map(
      (tb) => `
      <div class="table-wrap">
        <div class="sec-title">${escapeHtml(tb.title)}</div>
        <table>
          <thead>
            <tr>${tb.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${tb.rows
              .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      </div>`
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(spec.title)} - ${escapeHtml(spec.orgName)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1039B9;
      padding-bottom: 12px;
      margin-bottom: 14px;
      gap: 14px;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-img {
      width: 44px;
      height: 44px;
      object-fit: contain;
      border-radius: 10px;
      border: 1px solid #CBD5E1;
      background: #F8FAFC;
      padding: 3px;
    }
    .logo-badge {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #1039B9;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      letter-spacing: 0.04em;
    }
    .narrative {
      border: 1px solid #CBD5E1;
      background: #F8FAFC;
      border-left: 4px solid #1039B9;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .narrative p { margin: 4px 0 0; color: #334155; font-size: 11px; line-height: 1.5; }
    .eyebrow {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #1039B9;
    }
    h1 { font-size: 20px; margin: 3px 0 2px; }
    .sub { color: #475569; font-size: 11px; }
    .meta { text-align: right; color: #475569; font-size: 10px; }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi {
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 9px 10px;
      background: #F8FAFC;
    }
    .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748B; font-weight: 700; }
    .kpi-val { font-size: 15px; font-weight: 700; margin-top: 2px; color: #0F172A; }
    .kpi-hint { font-size: 9.5px; color: #475569; margin-top: 2px; }
    .box {
      border: 1px solid #DBEAFE;
      background: #EFF6FF;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .box ul { margin: 6px 0 0 16px; padding: 0; }
    .box li { margin-bottom: 3px; }
    .sec-title { font-size: 12px; font-weight: 700; color: #0F172A; margin-bottom: 6px; }
    .table-wrap { margin-bottom: 14px; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th {
      text-align: left;
      background: #F1F5F9;
      color: #334155;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 6px 8px;
      border-bottom: 1px solid #CBD5E1;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #E2E8F0;
      vertical-align: top;
    }
    .footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand-row">
      ${logoHtml}
      <div>
        <div class="eyebrow">${escapeHtml(spec.orgName)} &middot; CERVOS PHARMA</div>
        <h1>${escapeHtml(spec.title)}</h1>
        <div class="sub">${escapeHtml(spec.subtitle)}</div>
      </div>
    </div>
    <div class="meta">
      <div><strong>${isSw ? "Tawi" : "Branch"}:</strong> ${escapeHtml(spec.branchName)}</div>
      <div>${escapeHtml(spec.generatedLabel)}</div>
    </div>
  </div>
  <div class="kpis">${metricsHtml}</div>
  ${narrativeHtml}
  ${highlightsHtml}
  ${tablesHtml}
  <div class="footer">
    <span>Cervos Pharma Business Statement</span>
    <span>${isSw ? "Ripoti Safi ya Kuchapisha / PDF" : "Clean Printable PDF Statement"}</span>
  </div>
</body>
</html>`;

  if (requestNativePrint(html, 80)) {
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1500);
  }, 150);
}
