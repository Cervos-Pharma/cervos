/**
 * @route GET /api/hq/export/news
 * @access HQ session with canPublishEditorial required
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { arrayToCSV } from "@/lib/export";
import { authorizeHqExport } from "@/lib/spine/export-auth";
import { getJournalArticles } from "@/lib/workspace/store";

export async function GET() {
  const auth = await authorizeHqExport("canPublishEditorial");
  if (!auth.ok) return auth.response;

  let rows: Record<string, unknown>[] = [];
  try {
    const supabase = await createServiceClient();
    const { data: posts, error } = await supabase
      .from("news_posts")
      .select("id, slug, title, excerpt, author_name, category, tags, published, published_at, created_at")
      .order("created_at", { ascending: false });
    if (!error && posts && posts.length > 0) {
      rows = posts.map((p: Record<string, unknown>) => ({
        ...p,
        tags: Array.isArray(p.tags) ? p.tags.join("; ") : "",
      }));
    }
  } catch {
    // Fallback cleanly to journal articles projection
  }

  if (rows.length === 0) {
    rows = getJournalArticles(auth.db).map((a) => ({
      id: a.id,
      created_at: a.publishedAt,
      published_at: a.publishedAt,
      title: a.titleEn,
      slug: a.slug,
      author_name: a.author,
      category: a.topic,
      tags: a.topic,
      excerpt: a.deckEn,
      published: a.status === "published",
    }));
  }

  const cols = [
    { key: "id", header: "ID" },
    { key: "created_at", header: "Created" },
    { key: "published_at", header: "Published At" },
    { key: "title", header: "Title" },
    { key: "slug", header: "Slug" },
    { key: "author_name", header: "Author" },
    { key: "category", header: "Category" },
    { key: "tags", header: "Tags" },
    { key: "excerpt", header: "Excerpt" },
    { key: "published", header: "Published" },
  ];

  const csv = arrayToCSV(rows, cols);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="news-posts-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
