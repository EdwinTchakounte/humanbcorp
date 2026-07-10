import type { Metadata } from "next";
import { getNav } from "@/lib/api";
import { buildMetadata } from "@/lib/meta";
import SiteView, { guardSlug } from "@/components/SiteView";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const nav = await getNav("fr");
  return nav
    .filter((n) => n.slug !== "accueil" && n.slug !== "en" && n.slug !== "blog")
    .map((n) => ({ slug: n.slug }));
}

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildMetadata(params.slug, "fr", `/${params.slug}`);
}

export default async function FrDynamicPage({ params }: Props) {
  guardSlug(params.slug, "fr");
  return <SiteView slug={params.slug} lang="fr" />;
}
