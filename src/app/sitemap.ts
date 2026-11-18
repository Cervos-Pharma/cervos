import type { MetadataRoute } from "next";
import { PRODUCT_CATALOG, MARKET_CATALOG } from "@/lib/marketing-catalog";
import { DISPATCH_ESSAYS } from "@/lib/dispatch-catalog";

function resolveCanonicalSitemapOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  // Never emit preview *.vercel.app URLs inside sitemap.xml; Google Search Console
  // rejects sitemaps whose <loc> host differs from the property domain (cervos.online).
  if (configured && !/\.vercel\.app$/i.test(configured) && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  return "https://cervos.online";
}

const BASE_URL = resolveCanonicalSitemapOrigin();

type ChangeFrequency = "daily" | "weekly" | "monthly" | "yearly";

function entry(path: string, changeFrequency: ChangeFrequency, priority: number) {
  return {
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  } satisfies MetadataRoute.Sitemap[number];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    entry("", "weekly", 1.0),
    entry("/products", "weekly", 0.9),
    entry("/markets", "weekly", 0.9),
    entry("/downloads", "weekly", 0.8),
    entry("/dispatch", "weekly", 0.7),
    entry("/partners", "monthly", 0.7),
    entry("/about", "monthly", 0.6),
    entry("/about/company", "monthly", 0.6),
    entry("/help", "monthly", 0.6),
    entry("/contact", "monthly", 0.5),
  ];

  const productPages = Object.values(PRODUCT_CATALOG).map((page) =>
    entry(`/products/${page.slug}`, "weekly", 0.8)
  );

  const marketPages = Object.values(MARKET_CATALOG).map((page) =>
    entry(`/markets/${page.slug}`, "weekly", 0.8)
  );

  const dispatchPages = DISPATCH_ESSAYS.map((essay) =>
    entry(`/dispatch/${essay.slug}`, "monthly", 0.6)
  );

  return [...staticPages, ...productPages, ...marketPages, ...dispatchPages];
}
