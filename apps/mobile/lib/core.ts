export interface FormatTzsOptions {
  compact?: boolean;
  showSign?: boolean;
}

export function formatTzs(
  amount: number | null | undefined,
  options: FormatTzsOptions = {}
): string {
  const numeric = typeof amount === "number" && Number.isFinite(amount) ? Math.round(amount) : 0;
  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? "-" : options.showSign && numeric > 0 ? "+" : "";

  if (options.compact) {
    if (abs >= 1_000_000) {
      const m = (abs / 1_000_000).toFixed(1).replace(/\.0$/, "");
      return `${sign}TZS ${m}M`;
    }
    if (abs >= 10_000) {
      const k = (abs / 1_000).toFixed(1).replace(/\.0$/, "");
      return `${sign}TZS ${k}k`;
    }
  }

  return `${sign}TZS ${abs.toLocaleString("en-US")}`;
}

export interface ParsedGs1Barcode {
  raw: string;
  format: "gs1" | "sku";
  gtin: string | null;
  expiryDate: string | null;
  batchNumber: string | null;
  serialNumber: string | null;
}

function gs1DateToIso(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number.parseInt(yymmdd.slice(0, 2), 10);
  const mm = Number.parseInt(yymmdd.slice(2, 4), 10);
  const dd = Number.parseInt(yymmdd.slice(4, 6), 10);
  if (mm < 1 || mm > 12) return null;
  const year = 2000 + yy;
  const safeDay = dd === 0 ? 28 : Math.min(dd, 31);
  const mmStr = String(mm).padStart(2, "0");
  const ddStr = String(safeDay).padStart(2, "0");
  return `${year}-${mmStr}-${ddStr}`;
}

export function parseGs1Barcode(raw: string): ParsedGs1Barcode {
  const clean = (raw || "").trim();
  if (!clean) {
    return {
      raw: "",
      format: "sku",
      gtin: null,
      expiryDate: null,
      batchNumber: null,
      serialNumber: null,
    };
  }

  let gtin: string | null = null;
  let expiryDate: string | null = null;
  let batchNumber: string | null = null;
  let serialNumber: string | null = null;

  const ai01 = clean.match(/\(01\)(\d{14})/);
  if (ai01) gtin = ai01[1];

  const ai17 = clean.match(/\(17\)(\d{6})/);
  if (ai17) expiryDate = gs1DateToIso(ai17[1]);

  const ai10 = clean.match(/\(10\)([^\(\s]+)/);
  if (ai10) batchNumber = ai10[1];

  const ai21 = clean.match(/\(21\)([^\(\s]+)/);
  if (ai21) serialNumber = ai21[1];

  const isGs1 = Boolean(ai01 || ai17 || ai10 || ai21);

  return {
    raw: clean,
    format: isGs1 ? "gs1" : "sku",
    gtin,
    expiryDate,
    batchNumber,
    serialNumber,
  };
}
