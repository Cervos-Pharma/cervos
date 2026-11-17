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
  // GS1 allows dd = "00" meaning end of month
  const day = dd === 0 ? new Date(Date.UTC(year, mm, 0)).getUTCDate() : dd;
  const paddedMonth = String(mm).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
}

/**
 * Parses both human-readable parenthesized GS1 strings like
 * `(01)06291041500213(17)271231(10)BATCH09A(21)SN991`
 * and concatenated FNC1/GS (`\u001d`) scanner streams, falling back to plain SKU barcodes.
 */
export function parseGs1Barcode(rawInput: string): ParsedGs1Barcode {
  const raw = rawInput.trim();
  if (!raw) {
    return {
      raw: "",
      format: "sku",
      gtin: null,
      expiryDate: null,
      batchNumber: null,
      serialNumber: null,
    };
  }

  // Case 1: Parenthesized HRI string `(01)...(17)...(10)...(21)...`
  if (raw.includes("(01)")) {
    const tokens = [...raw.matchAll(/\((\d{2})\)([^(]+)/g)];
    if (tokens.length > 0) {
      let gtin: string | null = null;
      let expiryDate: string | null = null;
      let batchNumber: string | null = null;
      let serialNumber: string | null = null;

      for (const [, ai, val] of tokens) {
        const cleanVal = val.trim();
        if (ai === "01") gtin = cleanVal;
        else if (ai === "17") expiryDate = gs1DateToIso(cleanVal);
        else if (ai === "10") batchNumber = cleanVal;
        else if (ai === "21") serialNumber = cleanVal;
      }

      return {
        raw,
        format: "gs1",
        gtin,
        expiryDate,
        batchNumber,
        serialNumber,
      };
    }
  }

  // Case 2: Unparenthesized raw scanner payload starting with AI 01 + 14-digit GTIN
  const stripped = raw.replace(/^\u001d+/, "").replace(/^\]d2/i, "");
  if (/^01\d{14}/.test(stripped)) {
    let cursor = 2;
    const gtin = stripped.slice(cursor, cursor + 14);
    cursor += 14;
    let expiryDate: string | null = null;
    let batchNumber: string | null = null;
    let serialNumber: string | null = null;

    while (cursor < stripped.length) {
      if (stripped[cursor] === "\u001d") {
        cursor += 1;
        continue;
      }
      const ai = stripped.slice(cursor, cursor + 2);
      if (ai === "17" && /^\d{6}/.test(stripped.slice(cursor + 2, cursor + 8))) {
        expiryDate = gs1DateToIso(stripped.slice(cursor + 2, cursor + 8));
        cursor += 8;
      } else if (ai === "10") {
        const nextGs = stripped.indexOf("\u001d", cursor + 2);
        const end = nextGs === -1 ? stripped.length : nextGs;
        batchNumber = stripped.slice(cursor + 2, end).trim() || null;
        cursor = end;
      } else if (ai === "21") {
        const nextGs = stripped.indexOf("\u001d", cursor + 2);
        const end = nextGs === -1 ? stripped.length : nextGs;
        serialNumber = stripped.slice(cursor + 2, end).trim() || null;
        cursor = end;
      } else {
        break;
      }
    }

    return {
      raw,
      format: "gs1",
      gtin,
      expiryDate,
      batchNumber,
      serialNumber,
    };
  }

  return {
    raw,
    format: "sku",
    gtin: raw,
    expiryDate: null,
    batchNumber: null,
    serialNumber: null,
  };
}

