import type { HqProductAliasRecord } from "@/components/hq/types";
import type { ProductMasterRecord } from "./types";

export const PRODUCT_MASTER_SEED: ProductMasterRecord[] = [
  {
    id: "01950000-0000-7000-8000-000000000101",
    inn: "Artemether / Lumefantrine",
    strength: "20/120mg",
    form: "Tablet",
    route: "Oral",
    atcCode: "P01BF01",
    controlledClass: "none",
    barcodes: ["629100100101", "ALU20120"],
  },
  {
    id: "01950000-0000-7000-8000-000000000102",
    inn: "Amoxicillin",
    strength: "500mg",
    form: "Capsule",
    route: "Oral",
    atcCode: "J01CA04",
    controlledClass: "none",
    barcodes: ["629100100102", "AMOX500"],
  },
  {
    id: "01950000-0000-7000-8000-000000000103",
    inn: "Paracetamol",
    strength: "500mg",
    form: "Tablet",
    route: "Oral",
    atcCode: "N02BE01",
    controlledClass: "none",
    barcodes: ["629100100103", "PCM500"],
  },
  {
    id: "01950000-0000-7000-8000-000000000104",
    inn: "Ciprofloxacin",
    strength: "500mg",
    form: "Tablet",
    route: "Oral",
    atcCode: "J01MA02",
    controlledClass: "none",
    barcodes: ["629100100104", "CIP500"],
  },
  {
    id: "01950000-0000-7000-8000-000000000105",
    inn: "Ceftriaxone",
    strength: "1g",
    form: "Injection",
    route: "IV/IM",
    atcCode: "J01DD04",
    controlledClass: "none",
    barcodes: ["629100100105", "CEF1G"],
  },
  {
    id: "01950000-0000-7000-8000-000000000106",
    inn: "ORS + Zinc Sulfate",
    strength: "20mg Co-Pack",
    form: "Sachet/Tablet",
    route: "Oral",
    atcCode: "A07CA",
    controlledClass: "none",
    barcodes: ["629100100106", "ORSZINC"],
  },
  {
    id: "01950000-0000-7000-8000-000000000107",
    inn: "Metformin",
    strength: "500mg",
    form: "Tablet",
    route: "Oral",
    atcCode: "A10BA02",
    controlledClass: "none",
    barcodes: ["629100100107", "MET500"],
  },
  {
    id: "01950000-0000-7000-8000-000000000108",
    inn: "Amlodipine",
    strength: "5mg",
    form: "Tablet",
    route: "Oral",
    atcCode: "C08CA01",
    controlledClass: "none",
    barcodes: ["629100100108", "AML5"],
  },
  {
    id: "01950000-0000-7000-8000-000000000109",
    inn: "Omeprazole",
    strength: "20mg",
    form: "Capsule",
    route: "Oral",
    atcCode: "A02BC01",
    controlledClass: "none",
    barcodes: ["629100100109", "OME20"],
  },
  {
    id: "01950000-0000-7000-8000-000000000110",
    inn: "Azithromycin",
    strength: "500mg",
    form: "Tablet",
    route: "Oral",
    atcCode: "J01FA10",
    controlledClass: "none",
    barcodes: ["629100100110", "AZI500"],
  },
  {
    id: "01950000-0000-7000-8000-000000000111",
    inn: "Salbutamol",
    strength: "100mcg",
    form: "Inhaler",
    route: "Inhalation",
    atcCode: "R03AC02",
    controlledClass: "none",
    barcodes: ["629100100111", "SAL100"],
  },
  {
    id: "01950000-0000-7000-8000-000000000112",
    inn: "Morphine Sulfate",
    strength: "10mg",
    form: "Tablet",
    route: "Oral",
    atcCode: "N02AA01",
    controlledClass: "controlled",
    barcodes: ["629100100112", "MOR10"],
  },
];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/0\.5\s*g\b/g, "500mg")
    .replace(/(\d+)\s+(mg|mcg|g|ml)\b/g, "$1$2")
    .replace(/[^a-z0-9\s/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BRAND_ALIAS_HINTS: Array<{ tokens: string[]; masterIndex: number }> = [
  { tokens: ["coartem", "alu", "lonart", "artemether", "lumefantrine"], masterIndex: 0 },
  { tokens: ["amoxil", "amoxicillin", "amox", "amoxy"], masterIndex: 1 },
  { tokens: ["panadol", "paracetamol", "acetaminophen", "cetamol"], masterIndex: 2 },
  { tokens: ["cipro", "ciprofloxacin", "ciplox"], masterIndex: 3 },
  { tokens: ["rocephin", "ceftriaxone", "ceftri"], masterIndex: 4 },
  { tokens: ["ors", "zinc", "oral rehydration"], masterIndex: 5 },
  { tokens: ["glucophage", "metformin"], masterIndex: 6 },
  { tokens: ["norvasc", "amlodipine", "amlo"], masterIndex: 7 },
  { tokens: ["losec", "omeprazole", "omez"], masterIndex: 8 },
  { tokens: ["zithromax", "azithromycin", "azithro"], masterIndex: 9 },
  { tokens: ["ventolin", "salbutamol", "albuterol"], masterIndex: 10 },
  { tokens: ["morphine", "mst", "sevredol"], masterIndex: 11 },
];

export interface AliasResolutionResult {
  masterId: string;
  masterLabel: string;
  confidence: number;
  status: HqProductAliasRecord["status"];
}

/**
 * Deterministic + token-overlap resolver mapping free-text batch/sale names to ProductMaster.
 * Confidence >= 0.85 auto-links; 0.60..0.84 enters review_queue; < 0.60 stays unresolved.
 */
export function resolveProductAlias(
  rawBrand: string,
  rawGeneric: string,
  barcode?: string
): AliasResolutionResult {
  if (barcode) {
    const cleanCode = barcode.trim().toUpperCase();
    const byBarcode = PRODUCT_MASTER_SEED.find((m) => m.barcodes.includes(cleanCode));
    if (byBarcode) {
      return {
        masterId: byBarcode.id,
        masterLabel: `${byBarcode.inn} ${byBarcode.strength}`,
        confidence: 1.0,
        status: "auto",
      };
    }
  }

  const combined = normalizeText(`${rawBrand} ${rawGeneric}`);

  // 1. Exact INN + strength match
  for (const m of PRODUCT_MASTER_SEED) {
    const targetInn = normalizeText(m.inn);
    const targetStr = normalizeText(m.strength);
    if (combined.includes(targetInn) && combined.includes(targetStr)) {
      return {
        masterId: m.id,
        masterLabel: `${m.inn} ${m.strength}`,
        confidence: 0.96,
        status: "auto",
      };
    }
  }

  // 2. Known East Africa brand & stem matches
  for (const hint of BRAND_ALIAS_HINTS) {
    const matchedToken = hint.tokens.find((tok) => combined.includes(tok));
    if (matchedToken) {
      const m = PRODUCT_MASTER_SEED[hint.masterIndex];
      const hasStrength = combined.includes(normalizeText(m.strength));
      const conf = hasStrength ? 0.91 : 0.78;
      return {
        masterId: m.id,
        masterLabel: `${m.inn} ${m.strength}`,
        confidence: conf,
        status: conf >= 0.85 ? "auto" : "review_queue",
      };
    }
  }

  // 3. Fallback token Jaccard similarity against seeded ProductMaster
  const inputTokens = new Set(combined.split(" ").filter((t) => t.length >= 3));
  let bestScore = 0;
  let bestMaster = PRODUCT_MASTER_SEED[0];
  for (const m of PRODUCT_MASTER_SEED) {
    const mTokens = new Set(normalizeText(`${m.inn} ${m.strength} ${m.form}`).split(" "));
    let inter = 0;
    for (const tok of inputTokens) {
      if (mTokens.has(tok)) inter += 1;
    }
    const union = inputTokens.size + mTokens.size - inter;
    const score = union > 0 ? inter / union : 0;
    if (score > bestScore) {
      bestScore = score;
      bestMaster = m;
    }
  }

  const clamped = Number(Math.max(0.25, Math.min(0.82, bestScore + 0.35)).toFixed(2));
  return {
    masterId: bestMaster.id,
    masterLabel: `${bestMaster.inn} ${bestMaster.strength}`,
    confidence: clamped,
    status: clamped >= 0.6 ? "review_queue" : "unresolved",
  };
}
