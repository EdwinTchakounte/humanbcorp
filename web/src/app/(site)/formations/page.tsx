import type { Metadata } from "next";
import FormationsList from "@/components/formations/FormationsList";

export const metadata: Metadata = {
  title: "Formations — HBC-RH",
  description: "Catalogue des formations HBC-RH : inscrivez-vous et réglez en ligne.",
};

export default function FormationsPage() {
  return <FormationsList lang="fr" />;
}
