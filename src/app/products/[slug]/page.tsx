import { notFound } from "next/navigation";
import MarketingDetailShell from "@/components/MarketingDetailShell";
import { PRODUCT_CATALOG } from "@/lib/marketing-catalog";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PRODUCT_CATALOG[slug];
  if (!page) notFound();

  const related = Object.values(PRODUCT_CATALOG).filter((item) => item.slug !== slug);
  return <MarketingDetailShell page={page} related={related} />;
}
