import { redirect, notFound } from "next/navigation";
import { getPage, type Lang } from "@/lib/api";
import PageSections from "@/components/PageSections";

/** Rend une page du CMS pour une langue donnée. */
export default async function SiteView({ slug, lang }: { slug: string; lang: Lang }) {
  if (slug === "accueil" && lang === "fr") {
    // le vrai chemin de l'accueil FR est "/", pas "/accueil"
  }
  const page = await getPage(slug, lang);
  if (!page) notFound();
  return <PageSections page={page} />;
}

/** Redirige les slugs réservés. */
export function guardSlug(slug: string, lang: Lang) {
  if (slug === "accueil") redirect(lang === "en" ? "/en" : "/");
}
