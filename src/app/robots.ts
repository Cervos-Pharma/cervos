import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cervos.online";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/design-lab",
          "/ecosystem",
          "/download",
          "/supplier/quote",
          "/news",
          "/support",
          "/terms",
          "/privacy",
        ],
        disallow: ["/hq/", "/dashboard/", "/branch/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
