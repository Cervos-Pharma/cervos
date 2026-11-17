import PublicNav from "@/components/PublicNav";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

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

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("news_posts")
    .select("id, slug, title, excerpt, content, cover_image_url, author_name, category, tags, published, published_at, created_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!post) {
    notFound();
  }

  const typedPost = post as NewsPost;
  const readTime = estimateReadTime(typedPost.content);
  const displayDate = typedPost.published_at ?? typedPost.created_at;
  const badgeColor = categoryColors[typedPost.category] ?? "bg-gray-100 text-gray-800";

  return (
    <div className="min-h-screen bg-surface">
      <PublicNav activePath="/news" />

      <main className="flex-1 pt-16">
        <article className="max-w-3xl mx-auto px-4 md:px-8 py-12">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-8 font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to News
          </Link>

          {typedPost.cover_image_url && (
            <div className="aspect-video w-full rounded-lg overflow-hidden mb-8 bg-surface-container">
              <img
                src={typedPost.cover_image_url}
                alt={typedPost.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <span className={`font-label-md text-label-md px-2.5 py-1 rounded ${badgeColor}`}>
              {typedPost.category}
            </span>
            <span className="text-on-surface-variant text-body-sm">
              {readTime} min read
            </span>
          </div>

          <h1 className="font-headline-xl text-headline-xl text-ink-deep mb-4">
            {typedPost.title}
          </h1>

          <p className="font-body-lg text-body-lg text-on-surface-variant mb-6">
            {typedPost.excerpt}
          </p>

          <div className="flex items-center gap-4 py-4 border-y border-outline-variant mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[20px]">person</span>
              </div>
              <div>
                <p className="font-body-md text-body-md text-ink-deep font-medium">
                  {typedPost.author_name}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {formatDate(displayDate)}
                </p>
              </div>
            </div>
          </div>

          <div
            className="prose prose-lg max-w-none font-body-lg text-on-surface"
            dangerouslySetInnerHTML={{ __html: typedPost.content }}
          />

          {typedPost.tags && typedPost.tags.length > 0 && (
            <div className="mt-8 pt-8 border-t border-outline-variant">
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-3">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {typedPost.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-body-sm text-body-sm px-3 py-1 bg-surface-container text-on-surface rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>

      <footer className="py-8 px-8 border-t border-outline-variant">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-body-sm text-on-surface-variant">
            © {new Date().getFullYear()} Cervos. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/support" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">
              Support
            </Link>
            <Link href="/privacy" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
