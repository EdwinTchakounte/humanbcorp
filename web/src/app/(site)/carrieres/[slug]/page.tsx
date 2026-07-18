import type { Metadata } from "next";
import { getOffer } from "@/lib/api";
import OfferDetail from "@/components/recruitment/OfferDetail";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = await getOffer(params.slug);
  if (!o) return { title: "Offre introuvable" };
  return { title: `${o.title} — Carrières`, description: o.description?.slice(0, 160) };
}

export default function OffreDetailPage({ params }: Props) {
  return <OfferDetail slug={params.slug} lang="fr" />;
}
