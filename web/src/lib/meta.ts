import type { Metadata } from "next";
import { getPage, type Lang } from "@/lib/api";

/** Construit les métadonnées SEO d'une page à partir du CMS. */
export async function buildMetadata(slug: string, lang: Lang, canonical: string): Promise<Metadata> {
  const page = await getPage(slug, lang);
  if (!page) return {};
  const frCanonical = slug === "accueil" ? "/" : `/${slug}`;
  const enCanonical = slug === "accueil" ? "/en" : `/en/${slug}`;
  return {
    title: page.meta_title || page.title,
    description: page.meta_description || undefined,
    alternates: {
      canonical,
      languages: { fr: frCanonical, en: enCanonical },
    },
    openGraph: page.og_image?.url ? { images: [page.og_image.url] } : undefined,
  };
}
