import type { Metadata } from "next";

import { getFormation, type Lang, type PublicFormation } from "@/lib/api";
import { ogBase } from "@/lib/og";

/** « du 12 mars au 20 mars 2026 » — la période, pour l'aperçu de partage. */
function periode(f: PublicFormation, lang: Lang): string {
  if (f.mode !== 1 || !f.date_debut) return "";
  const loc = lang === "en" ? "en-GB" : "fr-FR";
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const d = new Date(f.date_debut).toLocaleDateString(loc, o);
  if (!f.date_fin) return lang === "en" ? `From ${d}. ` : `À partir du ${d}. `;
  const fin = new Date(f.date_fin).toLocaleDateString(loc, o);
  return lang === "en" ? `${d} → ${fin}. ` : `Du ${d} au ${fin}. `;
}

/**
 * Métadonnées de partage d'une formation (WhatsApp, LinkedIn, Facebook…).
 *
 * L'aperçu se joue sur trois éléments, et chacun manquait :
 *  - l'IMAGE : c'est celle de la formation, pas le logo générique. `image_url`
 *    est déjà absolue côté API (build_absolute_uri) ;
 *  - la DESCRIPTION : on met devant ce qui décide à l'achat — les dates et les
 *    places restantes — parce que WhatsApp tronque vite ;
 *  - l'URL : `og:url` n'est jamais déduite du canonical par Next, il faut la poser.
 *
 * Le titre ne porte plus « — HBC-RH » : le template du layout racine ajoute déjà
 * « | HBC-RH », ce qui donnait « … — HBC-RH | HBC-RH » dans l'aperçu.
 */
export async function buildFormationMetadata(id: string, lang: Lang): Promise<Metadata> {
  const f = await getFormation(id);
  if (!f) {
    return { title: lang === "en" ? "Training not found" : "Formation introuvable" };
  }

  const chemin = lang === "en" ? `/en/formations/${f.id}` : `/formations/${f.id}`;
  const restantes =
    f.places_restantes != null && !f.complete
      ? lang === "en"
        ? `${f.places_restantes} seat(s) left. `
        : `${f.places_restantes} place(s) restante(s). `
      : "";
  const complet = f.complete ? (lang === "en" ? "Session full. " : "Session complète. ") : "";
  const resume = (f.description || "").replace(/\s+/g, " ").trim();
  const description = `${periode(f, lang)}${complet}${restantes}${resume}`.slice(0, 200).trim();

  return {
    title: f.title,
    description,
    alternates: {
      canonical: chemin,
      languages: { fr: `/formations/${f.id}`, en: `/en/formations/${f.id}` },
    },
    openGraph: {
      // Socle complet : une clé openGraph partielle écraserait celle du layout
      // racine (og:site_name, og:locale, image par défaut). Cf. lib/og.ts.
      ...ogBase(lang),
      url: chemin,
      title: f.title,
      description,
      // Sans image propre, le logo du socle prend le relais plutôt qu'une URL
      // vide qui casserait l'aperçu.
      ...(f.image_url ? { images: [{ url: f.image_url, alt: f.title }] } : {}),
    },
  };
}
