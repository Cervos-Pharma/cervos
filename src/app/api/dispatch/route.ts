import type { NextRequest } from "next/server";
import { DISPATCH_ESSAYS, type DispatchEssay } from "@/lib/dispatch-catalog";
import { noStoreJson } from "@/lib/workspace/cookies";
import {
  getJournalArticles,
  getWorkspaceDb,
  warmDbFromSupabase,
  type JournalArticleRecord,
} from "@/lib/workspace/store";

export const dynamic = "force-dynamic";

function toDispatchEssay(rec: JournalArticleRecord): DispatchEssay {
  const words = rec.paragraphsEn.join(" ").split(/\s+/).filter(Boolean).length;
  const mins = Math.max(2, Math.round(words / 180));
  const topicMeta =
    rec.topic === "craft"
      ? { en: "Craft & Practice", sw: "Utunzaji wa Rafu" }
      : rec.topic === "supply"
        ? { en: "Supply Notes", sw: "Safari ya Ugavi" }
        : { en: "Field Notes", sw: "Simulizi za Mtaa" };
  const d = new Date(rec.publishedAt || rec.updatedAt || Date.now());
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return {
    slug: rec.slug,
    issue: "HQ DISPATCH",
    topic: rec.topic,
    topicLabelEn: topicMeta.en,
    topicLabelSw: topicMeta.sw,
    readTimeEn: `${mins} min read`,
    readTimeSw: `Dakika ${mins}`,
    dateEn: dateLabel,
    dateSw: dateLabel,
    author: rec.author,
    authorRoleEn: rec.authorRoleEn,
    authorRoleSw: rec.authorRoleSw,
    titleEn: rec.titleEn,
    titleSw: rec.titleSw,
    deckEn: rec.deckEn,
    deckSw: rec.deckSw,
    image: rec.image || "/cervos-people-counter.jpg",
    quoteEn: rec.quoteEn || rec.deckEn,
    quoteSw: rec.quoteSw || rec.deckSw,
    paragraphsEn: rec.paragraphsEn.length > 0 ? rec.paragraphsEn : [rec.deckEn],
    paragraphsSw: rec.paragraphsSw.length > 0 ? rec.paragraphsSw : [rec.deckSw],
    baseUpvotes: 12,
  };
}

export async function GET(request: NextRequest) {
  await warmDbFromSupabase(true);
  const db = getWorkspaceDb();
  const published = getJournalArticles(db)
    .filter((a) => a.status === "published")
    .map(toDispatchEssay);

  // Deduplicate by slug (HQ dynamic essays take priority over static catalog seeds)
  const seen = new Set(published.map((e) => e.slug));
  const combined = [...published, ...DISPATCH_ESSAYS.filter((e) => !seen.has(e.slug))];

  const slug = new URL(request.url).searchParams.get("slug");
  if (slug) {
    const found = combined.find((e) => e.slug === slug) ?? null;
    if (!found) {
      return noStoreJson({ error: "Journal article not found." }, { status: 404 });
    }
    return noStoreJson({ article: found, all: combined });
  }

  return noStoreJson({ articles: combined });
}
