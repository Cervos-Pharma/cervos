import { notFound } from "next/navigation";
import MarketingDetailShell from "@/components/MarketingDetailShell";
import { MARKET_CATALOG } from "@/lib/marketing-catalog";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = MARKET_CATALOG[slug];
  if (!page) notFound();

  const related = Object.values(MARKET_CATALOG).filter((item) => item.slug !== slug);
  return <MarketingDetailShell page={page} related={related} />;
}
