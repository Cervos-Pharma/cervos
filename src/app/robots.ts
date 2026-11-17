import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cervos.online";

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
