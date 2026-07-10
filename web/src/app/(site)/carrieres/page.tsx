import type { Metadata } from "next";
import OffersList from "@/components/recruitment/OffersList";

export const metadata: Metadata = {
  title: "Carrières — HBC-RH",
  description: "Rejoignez HBC-RH : découvrez nos offres d'emploi et postulez en ligne.",
};

export default function CarrieresPage() {
  return <OffersList lang="fr" />;
}
