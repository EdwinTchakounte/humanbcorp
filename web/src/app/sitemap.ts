import type { MetadataRoute } from "next";

import { getArticles, getFormations, getNav, getOffers } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://humanbcorp.com";

/**
 * Plan du site.
 *
 * Il ne listait que les pages du menu : ni les formations, ni les articles, ni
 * les offres d'emploi n'y figuraient — donc rien de ce que le site produit
 * réellement, et rien qui change. Ce sont pourtant les seules pages qu'un
 * moteur ne peut pas deviner : elles vivent derrière une liste paginée.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Une source indisponible ne doit pas vider le plan du site entier.
  const [nav, formations, articles, offres] = await Promise.all([
    getNav("fr").catch(() => []),
    getFormations().catch(() => []),
    getArticles("fr").catch(() => []),
    getOffers().catch(() => []),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const n of nav) {
    const fr = n.slug === "accueil" ? SITE_URL : `${SITE_URL}/${n.slug}`;
    const en = n.slug === "accueil" ? `${SITE_URL}/en` : `${SITE_URL}/en/${n.slug}`;
    const priority = n.slug === "accueil" ? 1 : 0.7;
    entries.push({ url: fr, changeFrequency: "weekly", priority });
    entries.push({ url: en, changeFrequency: "weekly", priority: priority * 0.9 });
  }

  // Les listes : elles bougent à chaque publication.
  for (const chemin of ["/formations", "/carrieres", "/ressources", "/blog"]) {
    entries.push({ url: `${SITE_URL}${chemin}`, changeFrequency: "daily", priority: 0.8 });
    entries.push({ url: `${SITE_URL}/en${chemin}`, changeFrequency: "daily", priority: 0.7 });
  }

  // Les formations : ce qu'on vend. Priorité haute, et fréquence quotidienne —
  // les places restantes et le statut « complet » changent tous les jours.
  for (const f of formations) {
    entries.push({
      url: `${SITE_URL}/formations/${f.id}`,
      changeFrequency: "daily",
      priority: 0.9,
    });
    entries.push({
      url: `${SITE_URL}/en/formations/${f.id}`,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  for (const a of articles) {
    entries.push({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: a.published_at ? new Date(a.published_at) : undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // Les offres d'emploi expirent : inutile de les proposer une fois closes.
  const maintenant = Date.now();
  for (const o of offres) {
    if (o.closing_date && new Date(o.closing_date).getTime() < maintenant) continue;
    entries.push({
      url: `${SITE_URL}/carrieres/${o.slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}
