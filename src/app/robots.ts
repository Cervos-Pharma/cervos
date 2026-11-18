import type { MetadataRoute } from "next";

function resolveCanonicalOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (configured && !/\.vercel\.app$/i.test(configured) && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  return "https://cervos.online";
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolveCanonicalOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private surfaces: operator console, workspace app, auth, and APIs.
        disallow: ["/hq", "/app", "/auth", "/ops-v9k4m", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
