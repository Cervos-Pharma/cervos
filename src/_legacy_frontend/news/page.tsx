import PublicNav from "@/components/PublicNav";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

const CATEGORIES = ["All", "Product Updates", "Industry News", "Regulatory", "Company"] as const;

function estimateReadTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const categoryColors: Record<string, string> = {
  "Product Updates": "bg-blue-100 text-blue-800",
  "Industry News": "bg-purple-100 text-purple-800",
  "Regulatory": "bg-amber-100 text-amber-800",
  "Company": "bg-green-100 text-green-800",
};

interface NewsPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  author_name: string;
  category: string;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
}

export default async function NewsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("news_posts")
    .select("id, slug, title, excerpt, content, cover_image_url, author_name, category, tags, published, published_at, created_at")
    .eq("published", true)
    .order("published_at", { ascending: false });

  const allPosts: NewsPost[] = posts ?? [];

  return (
    <div className="min-h-screen bg-surface">
      <PublicNav activePath="/news" />

      <main className="flex-1 pt-16">
        <div className="max-w-container-max mx-auto px-4 md:px-8 py-12">
          <div className="mb-10">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-2">
              {t("news.label")}
            </p>
            <h1 className="font-headline-xl text-headline-xl text-ink-deep mb-4">
              {t("news.title")}
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
              {t("news.subtitle")}
            </p>
          </div>

          {allPosts.length === 0 ? (
            <div className="bg-surface-base border border-outline-variant p-16 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4">newspaper</span>
              <p className="font-body-lg text-on-surface-variant">{t("news.no_articles")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allPosts.map((post) => {
                const readTime = estimateReadTime(post.content);
                const displayDate = post.published_at ?? post.created_at;
                const badgeColor = categoryColors[post.category] ?? "bg-gray-100 text-gray-800";

                return (
                  <Link
                    key={post.id}
                    href={`/news/${post.slug}`}
                    className="group bg-surface-base border border-outline-variant overflow-hidden hover:border-primary/40 transition-all duration-200 hover:shadow-md flex flex-col"
                  >
                    {post.cover_image_url && (
                      <div className="aspect-video w-full overflow-hidden bg-surface-container">
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`font-label-md text-label-md px-2.5 py-1 rounded ${badgeColor}`}>
                          {post.category}
                        </span>
                      </div>
                      <h2 className="font-headline-md text-headline-md text-ink-deep mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </h2>
                      <p className="font-body-md text-body-md text-on-surface-variant mb-4 flex-1 line-clamp-3">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center gap-3 text-body-sm text-on-surface-variant pt-4 border-t border-outline-variant/50">
                        <span>{post.author_name}</span>
                        <span className="text-outline">·</span>
                        <span>{formatDate(displayDate)}</span>
                        <span className="text-outline">·</span>
                        <span>{readTime} {t("news.min_read")}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="py-8 px-8 border-t border-outline-variant">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-body-sm text-on-surface-variant">
            © {new Date().getFullYear()} Cervos. {t("news.all_rights")}
          </p>
          <div className="flex items-center gap-6">
            <Link href="/support" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">
              {t("footer.signin")}
            </Link>
            <Link href="/privacy" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">
              {t("footer.privacy")}
            </Link>
            <Link href="/terms" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">
              {t("footer.terms")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
