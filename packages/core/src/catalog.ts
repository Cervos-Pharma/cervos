import { parseGs1Barcode } from "./gs1";

/**
 * Universal Cloud Barcode, QR & Product Segment Architecture.
 *
 * Powers cross-branch / cross-station medicine identification, automatic
 * field fill during merch intake, POS barcode dispense, and receipt QR
 * verification across Web, Desktop, and Mobile.
 */

export type CatalogSegment =
  | "Antimalarial"
  | "Antibiotic"
  | "Analgesic"
  | "Gastro"
  | "Chronic"
  | "Hydration"
  | "Respiratory"
  | "Controlled"
  | "Essential";

export interface CloudCatalogProduct {
  id: string;
  masterId?: string;
  segment: CatalogSegment;
  inn: string;
  brandName: string;
  category: string;
  strength?: string;
  form?: string;
  formulation?: string;
  barcodes: string[];
  defaultCostTzs: number;
  defaultSaleTzs: number;
  defaultThreshold: number;
  requiresPrescription: boolean;
  isControlled?: boolean;
  source: "seed" | "network" | "branch";
  scanCount: number;
  updatedAt: string;
}

const SEED_TS = "2026-01-01T00:00:00.000Z";

export const DEFAULT_CLOUD_CATALOG: CloudCatalogProduct[] = [
  {
    id: "cat_0101",
    masterId: "01950000-0000-7000-8000-000000000101",
    segment: "Antimalarial",
    inn: "Artemether / Lumefantrine 20/120mg",
    brandName: "Coartem 20/120mg",
    category: "Antimalarial",
    strength: "20/120mg",
    form: "Tablet",
    barcodes: ["629100100101", "ALU20120"],
    defaultCostTzs: 2800,
    defaultSaleTzs: 4200,
    defaultThreshold: 25,
    requiresPrescription: true,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0102",
    masterId: "01950000-0000-7000-8000-000000000102",
    segment: "Antibiotic",
    inn: "Amoxicillin 500mg",
    brandName: "Amoxil 500mg Capsules",
    category: "Antibiotic",
    strength: "500mg",
    form: "Capsule",
    barcodes: ["629100100102", "AMOX500"],
    defaultCostTzs: 3200,
    defaultSaleTzs: 4800,
    defaultThreshold: 30,
    requiresPrescription: true,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0103",
    masterId: "01950000-0000-7000-8000-000000000103",
    segment: "Analgesic",
    inn: "Paracetamol 500mg",
    brandName: "Panadol Advance 500mg",
    category: "Analgesic",
    strength: "500mg",
    form: "Tablet",
    barcodes: ["629100100103", "PCM500"],
    defaultCostTzs: 1200,
    defaultSaleTzs: 2000,
    defaultThreshold: 40,
    requiresPrescription: false,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0104",
    masterId: "01950000-0000-7000-8000-000000000104",
    segment: "Antibiotic",
    inn: "Ciprofloxacin 500mg",
    brandName: "Ciplox 500mg",
    category: "Antibiotic",
    strength: "500mg",
    form: "Tablet",
    barcodes: ["629100100104", "CIP500"],
    defaultCostTzs: 2900,
    defaultSaleTzs: 4500,
    defaultThreshold: 20,
    requiresPrescription: true,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0105",
    masterId: "01950000-0000-7000-8000-000000000105",
    segment: "Antibiotic",
    inn: "Ceftriaxone 1g",
    brandName: "Rocephin 1g Injection",
    category: "Antibiotic",
    strength: "1g",
    form: "Injection",
    barcodes: ["629100100105", "CEF1G"],
    defaultCostTzs: 5400,
    defaultSaleTzs: 8000,
    defaultThreshold: 12,
    requiresPrescription: true,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0106",
    masterId: "01950000-0000-7000-8000-000000000106",
    segment: "Hydration",
    inn: "ORS + Zinc Sulfate 20mg Co-Pack",
    brandName: "ORS + Zinc Pediatric Pack",
    category: "Hydration",
    strength: "20mg Co-Pack",
    form: "Sachet/Tablet",
    barcodes: ["629100100106", "ORSZINC"],
    defaultCostTzs: 1400,
    defaultSaleTzs: 2500,
    defaultThreshold: 30,
    requiresPrescription: false,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0107",
    masterId: "01950000-0000-7000-8000-000000000107",
    segment: "Chronic",
    inn: "Metformin 500mg",
    brandName: "Glucophage 500mg",
    category: "Chronic",
    strength: "500mg",
    form: "Tablet",
    barcodes: ["629100100107", "MET500"],
    defaultCostTzs: 3600,
    defaultSaleTzs: 5500,
    defaultThreshold: 20,
    requiresPrescription: true,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0108",
    masterId: "01950000-0000-7000-8000-000000000108",
    segment: "Chronic",
    inn: "Amlodipine 5mg",
    brandName: "Norvasc 5mg",
    category: "Chronic",
    strength: "5mg",
    form: "Tablet",
    barcodes: ["629100100108", "AML5"],
    defaultCostTzs: 3400,
    defaultSaleTzs: 5000,
    defaultThreshold: 20,
    requiresPrescription: true,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0109",
    masterId: "01950000-0000-7000-8000-000000000109",
    segment: "Gastro",
    inn: "Omeprazole 20mg",
    brandName: "Losec 20mg Capsules",
    category: "Gastro",
    strength: "20mg",
    form: "Capsule",
    barcodes: ["629100100109", "OME20"],
    defaultCostTzs: 2400,
    defaultSaleTzs: 3800,
    defaultThreshold: 25,
    requiresPrescription: false,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0110",
    masterId: "01950000-0000-7000-8000-000000000110",
    segment: "Antibiotic",
    inn: "Azithromycin 500mg",
    brandName: "Zithromax 500mg",
    category: "Antibiotic",
    strength: "500mg",
    form: "Tablet",
    barcodes: ["629100100110", "AZI500"],
    defaultCostTzs: 4800,
    defaultSaleTzs: 7500,
    defaultThreshold: 15,
    requiresPrescription: true,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0111",
    masterId: "01950000-0000-7000-8000-000000000111",
    segment: "Respiratory",
    inn: "Salbutamol 100mcg",
    brandName: "Ventolin Inhaler 100mcg",
    category: "Respiratory",
    strength: "100mcg",
    form: "Inhaler",
    barcodes: ["629100100111", "SAL100"],
    defaultCostTzs: 6800,
    defaultSaleTzs: 9800,
    defaultThreshold: 10,
    requiresPrescription: true,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
  {
    id: "cat_0112",
    masterId: "01950000-0000-7000-8000-000000000112",
    segment: "Controlled",
    inn: "Morphine Sulfate 10mg",
    brandName: "MST 10mg Tablets",
    category: "Controlled",
    strength: "10mg",
    form: "Tablet",
    barcodes: ["629100100112", "MOR10"],
    defaultCostTzs: 8500,
    defaultSaleTzs: 12500,
    defaultThreshold: 8,
    requiresPrescription: true,
    isControlled: true,
    source: "seed",
    scanCount: 0,
    updatedAt: SEED_TS,
  },
];

export type ScanIntent =
  | { kind: "receipt"; raw: string; receiptNumber: string; saleId?: string }
  | { kind: "lot"; raw: string; batchNumber: string }
  | {
      kind: "gs1";
      raw: string;
      gtin: string | null;
      batchNumber: string | null;
      expiryDate: string | null;
      serialNumber: string | null;
    }
  | { kind: "barcode"; raw: string; code: string };

/** Canonical receipt verification QR payload printed & rendered on receipts. */
export function buildReceiptQrPayload(receiptNumber: string, saleId?: string): string {
  const cleanRcp = receiptNumber.trim();
  return saleId ? `CERVOS:RCP:${cleanRcp}|${saleId.trim()}` : `CERVOS:RCP:${cleanRcp}`;
}

/** Canonical branch batch QR payload for instant shelf / lot scanning. */
export function buildLotQrPayload(batchNumber: string): string {
  return `CERVOS:LOT:${batchNumber.trim()}`;
}

/** Normalizes retail EAN/UPC/GTIN strings so 12/13/14 digit padded codes match cleanly. */
export function normalizeBarcode(raw: string): string {
  return raw.trim().toUpperCase();
}

function barcodeVariants(code: string): string[] {
  const norm = normalizeBarcode(code);
  if (!norm) return [];
  const out = new Set<string>([norm]);
  if (/^\d{14}$/.test(norm) && norm.startsWith("0")) {
    out.add(norm.slice(1));
    if (norm.startsWith("00")) out.add(norm.slice(2));
  } else if (/^\d{13}$/.test(norm)) {
    out.add(`0${norm}`);
  } else if (/^\d{12}$/.test(norm)) {
    out.add(`0${norm}`);
    out.add(`00${norm}`);
  }
  return Array.from(out);
}

/**
 * Classifies any scanned camera QR / USB barcode / manual code into a typed flow intent:
 * receipt verification QR, branch lot QR, GS1 DataMatrix/FNC1, or standard retail barcode.
 */
export function parseScanIntent(rawInput: string): ScanIntent {
  const raw = rawInput.trim();
  if (!raw) {
    return { kind: "barcode", raw: "", code: "" };
  }

  // Receipt QR (`CERVOS:RCP:RCP-XXXXXX|saleId` or bare `RCP-XXXXXX`)
  if (/^CERVOS:RCP:/i.test(raw)) {
    const rest = raw.slice("CERVOS:RCP:".length).trim();
    const [receiptNumber, saleId] = rest.split("|").map((s) => s.trim());
    return {
      kind: "receipt",
      raw,
      receiptNumber: receiptNumber || rest,
      ...(saleId ? { saleId } : {}),
    };
  }
  if (/^RCP-[A-Z0-9]{4,16}$/i.test(raw)) {
    return { kind: "receipt", raw, receiptNumber: raw.toUpperCase() };
  }

  // Lot QR (`CERVOS:LOT:BATCH-01`)
  if (/^CERVOS:LOT:/i.test(raw)) {
    return { kind: "lot", raw, batchNumber: raw.slice("CERVOS:LOT:".length).trim() };
  }

  const parsed = parseGs1Barcode(raw);
  if (parsed.format === "gs1") {
    return {
      kind: "gs1",
      raw,
      gtin: parsed.gtin,
      batchNumber: parsed.batchNumber,
      expiryDate: parsed.expiryDate,
      serialNumber: parsed.serialNumber,
    };
  }

  return { kind: "barcode", raw, code: parsed.gtin || raw };
}

/** Matches a scanned code or GTIN against the universal cloud catalog. */
export function matchCatalogByBarcode(
  catalog: readonly CloudCatalogProduct[],
  rawCode: string
): CloudCatalogProduct | null {
  const intent = parseScanIntent(rawCode);
  const candidate =
    intent.kind === "gs1"
      ? intent.gtin || ""
      : intent.kind === "barcode"
        ? intent.code
        : "";
  if (!candidate) return null;
  const variants = new Set(barcodeVariants(candidate));
  for (const item of catalog) {
    for (const bc of item.barcodes) {
      for (const v of barcodeVariants(bc)) {
        if (variants.has(v)) return item;
      }
    }
  }
  return null;
}

export function inferCatalogSegment(category: string): CatalogSegment {
  const c = category.trim().toLowerCase();
  if (/malaria|coartem|alu/.test(c)) return "Antimalarial";
  if (/antibiotic|amox|cipro|azith|ceft/.test(c)) return "Antibiotic";
  if (/pain|analges|paracet|ibu/.test(c)) return "Analgesic";
  if (/gastro|omep|ulcer|antacid/.test(c)) return "Gastro";
  if (/chronic|cardio|diabet|metform|amlod|bp/.test(c)) return "Chronic";
  if (/ors|zinc|hydrat|diarr/.test(c)) return "Hydration";
  if (/resp|asthma|salbut|inhal/.test(c)) return "Respiratory";
  if (/control|narc|morph/.test(c)) return "Controlled";
  return "Essential";
}

export function searchCloudCatalog(
  catalog: readonly CloudCatalogProduct[],
  query: string,
  segment?: CatalogSegment | "all"
): CloudCatalogProduct[] {
  const q = query.trim().toLowerCase();
  return catalog.filter((item) => {
    if (segment && segment !== "all" && item.segment !== segment) return false;
    if (!q) return true;
    return (
      item.brandName.toLowerCase().includes(q) ||
      item.inn.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.barcodes.some((b) => b.toLowerCase().includes(q))
    );
  });
}
