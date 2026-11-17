import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://cervos.online";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { path: "", changeFrequency: "weekly" as const, priority: 1.0 },
    { path: "/design-lab", changeFrequency: "weekly" as const, priority: 0.9 },
    { path: "/ecosystem", changeFrequency: "monthly" as const, priority: 0.9 },
    { path: "/download", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/supplier/quote", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/news", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/support", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/terms", changeFrequency: "yearly" as const, priority: 0.4 },
    { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.4 },
    { path: "/auth", changeFrequency: "monthly" as const, priority: 0.5 },
  ];

  const now = new Date();

  return staticPages.map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
