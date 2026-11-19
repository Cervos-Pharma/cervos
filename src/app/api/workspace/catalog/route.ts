import { NextRequest } from "next/server";
import {
  matchCatalogByBarcode,
  parseScanIntent,
  searchCloudCatalog,
  type CatalogSegment,
} from "@cervos/core";
import { sanitizeText } from "@/lib/security/harness";
import { noStoreJson } from "@/lib/workspace/cookies";
import {
  parseJsonObject,
  readWorkspaceAccountToken,
} from "@/lib/workspace/request-auth";
import {
  ensureCloudCatalog,
  flushWorkspaceDb,
  getWorkspaceDb,
  recordCloudCatalogProduct,
  saveWorkspaceDb,
  warmDbFromSupabase,
} from "@/lib/workspace/store";

export async function GET(request: NextRequest) {
  await warmDbFromSupabase(false);
  const session = readWorkspaceAccountToken(request);
  if (!session) {
    return noStoreJson({ error: "Not authenticated." }, { status: 401 });
  }
  const db = getWorkspaceDb();
  const catalog = ensureCloudCatalog(db);
  const sp = request.nextUrl.searchParams;
  const code = (sp.get("barcode") || "").trim();
  const q = (sp.get("q") || "").trim();
  const segment = (sp.get("segment") || "all") as CatalogSegment | "all";

  if (code) {
    const intent = parseScanIntent(code);
    const match = matchCatalogByBarcode(catalog, code);
    return noStoreJson({
      ok: true,
      intent,
      match,
      totalCatalog: catalog.length,
    });
  }

  const items = searchCloudCatalog(catalog, q, segment);
  return noStoreJson({
    ok: true,
    items,
    totalCatalog: catalog.length,
  });
}

export async function POST(request: NextRequest) {
  await warmDbFromSupabase(true);
  const session = readWorkspaceAccountToken(request);
  if (!session) {
    return noStoreJson({ error: "Not authenticated." }, { status: 401 });
  }
  const parsed = await parseJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const brandName = sanitizeText(body.brandName, 80);
  const genericName = sanitizeText(body.genericName, 80) || brandName;
  const category = sanitizeText(body.category, 40) || "Essential";
  const barcode = sanitizeText(body.barcode, 64);

  if (brandName.length < 2) {
    return noStoreJson({ error: "Product name is required." }, { status: 400 });
  }

  const db = getWorkspaceDb();
  const item = recordCloudCatalogProduct(db, {
    barcode: barcode || undefined,
    brandName,
    genericName,
    category,
    costPriceTzs: Number(body.costPriceTzs) || undefined,
    salePriceTzs: Number(body.salePriceTzs) || undefined,
    lowStockThreshold: Number(body.lowStockThreshold) || undefined,
    requiresPrescription: Boolean(body.requiresPrescription),
    isControlled: Boolean(body.isControlled),
  });
  saveWorkspaceDb(db);
  await flushWorkspaceDb();
  return noStoreJson({ ok: true, item });
}
