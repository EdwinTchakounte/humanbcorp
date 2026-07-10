import type { Metadata } from "next";
import { getNav } from "@/lib/api";
import { buildMetadata } from "@/lib/meta";
import SiteView, { guardSlug } from "@/components/SiteView";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const nav = await getNav("en");
  return nav.filter((n) => n.slug !== "accueil" && n.slug !== "blog").map((n) => ({ slug: n.slug }));
}

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildMetadata(params.slug, "en", `/en/${params.slug}`);
}

export default async function EnDynamicPage({ params }: Props) {
  guardSlug(params.slug, "en");
  return <SiteView slug={params.slug} lang="en" />;
}
