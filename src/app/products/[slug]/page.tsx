import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MarketingDetailShell from "@/components/MarketingDetailShell";
import { PRODUCT_CATALOG } from "@/lib/marketing-catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = PRODUCT_CATALOG[slug];
  if (!page) return {};
  return {
    title: page.titleEn,
    description: page.summaryEn,
    alternates: { canonical: `/products/${page.slug}` },
    openGraph: {
      title: page.titleEn,
      description: page.summaryEn,
      images: [{ url: page.image, alt: page.titleEn }],
    },
  };
}

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
