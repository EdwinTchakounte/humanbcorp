import type { Metadata } from "next";

import { getOffer, type Lang } from "@/lib/api";
import { socleSansImage } from "@/lib/og";

/** Accroche localisée : « UCB recrute » / « A company is hiring ». */
export function accrocheOffre(
  company: { name: string } | null,
  lang: Lang
): string {
  if (company?.name) {
    return lang === "en" ? `${company.name} is hiring` : `${company.name} recrute`;
  }
  return lang === "en" ? "A company is hiring" : "Une entreprise recrute";
}

/**
 * Métadonnées d'une offre — le partage social en dépend.
 *
 * L'accroche est reprise dans le titre Open Graph : c'est elle qu'on lit dans
 * l'aperçu WhatsApp/Facebook avant même d'ouvrir le lien.
 */
export async function buildOfferMetadata(slug: string, lang: Lang): Promise<Metadata> {
  const o = await getOffer(slug);
  if (!o) return { title: lang === "en" ? "Offer not found" : "Offre introuvable" };

  const chemin = lang === "en" ? `/en/carrieres/${o.slug}` : `/carrieres/${o.slug}`;
  const accroche = accrocheOffre(o.company, lang);
  // Seules les informations réellement affichables entrent dans le résumé.
  const infos = [o.contract_label, o.location, o.salary].filter(Boolean).join(" · ");
  const resume = (o.description || "").replace(/\s+/g, " ").trim();
  const description = `${accroche}. ${infos ? `${infos}. ` : ""}${resume}`.slice(0, 200).trim();

  return {
    title: `${o.title} — ${lang === "en" ? "Careers" : "Carrières"}`,
    description,
    alternates: {
      canonical: chemin,
      languages: { fr: `/carrieres/${o.slug}`, en: `/en/carrieres/${o.slug}` },
    },
    openGraph: {
      // Socle complet : une clé openGraph partielle écraserait celle du layout
      // racine (og:site_name, og:locale). Cf. lib/og.ts.
      ...socleSansImage(lang),
      url: chemin,
      title: `${accroche} — ${o.title}`,
      description,
      // Aucune image ici, volontairement : `openGraph.images` défini à la main
      // l'emporte sur la convention de fichier et neutraliserait le flyer
      // généré par opengraph-image.tsx.
    },
  };
}
