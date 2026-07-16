import type { Metadata } from "next";
import { getPage, type Lang } from "@/lib/api";
import { ogBase } from "@/lib/og";

/** Construit les métadonnées SEO d'une page à partir du CMS. */
export async function buildMetadata(slug: string, lang: Lang, canonical: string): Promise<Metadata> {
  const page = await getPage(slug, lang);
  if (!page) return {};
  const frCanonical = slug === "accueil" ? "/" : `/${slug}`;
  const enCanonical = slug === "accueil" ? "/en" : `/en/${slug}`;
  const ogImage = page.og_image?.url;
  const titre = page.meta_title || page.title;
  const description = page.meta_description || undefined;
  return {
    title: titre,
    description,
    alternates: {
      canonical,
      languages: { fr: frCanonical, en: enCanonical },
    },
    // Le bloc est reconstruit en entier (cf. lib/og.ts) : `openGraph: undefined`
    // n'était pas neutre — la clé, présente mais vide, effaçait celui du layout
    // racine et la page se partageait sans aucun aperçu.
    openGraph: {
      ...ogBase(lang),
      url: canonical,
      title: titre,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}
