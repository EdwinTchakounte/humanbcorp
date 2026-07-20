import type { Metadata } from "next";
import { buildOfferMetadata } from "@/lib/offer-meta";
import OfferDetail from "@/components/recruitment/OfferDetail";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildOfferMetadata(params.slug, "en");
}

export default function EnOffreDetailPage({ params }: Props) {
  return <OfferDetail slug={params.slug} lang="en" />;
}
