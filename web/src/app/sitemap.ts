import type { MetadataRoute } from "next";
import { getNav } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://humanbcorp.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const nav = await getNav("fr");
  const entries: MetadataRoute.Sitemap = [];
  for (const n of nav) {
    const fr = n.slug === "accueil" ? SITE_URL : `${SITE_URL}/${n.slug}`;
    const en = n.slug === "accueil" ? `${SITE_URL}/en` : `${SITE_URL}/en/${n.slug}`;
    const priority = n.slug === "accueil" ? 1 : 0.7;
    entries.push({ url: fr, changeFrequency: "weekly", priority });
    entries.push({ url: en, changeFrequency: "weekly", priority: priority * 0.9 });
  }
  return entries;
}
