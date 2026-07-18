import type { Metadata } from "next";
import DocumentsList from "@/components/documents/DocumentsList";

export const metadata: Metadata = {
  title: "Ressources",
  description: "Téléchargez nos brochures, catalogues et fiches pratiques.",
};

export default function RessourcesPage() {
  return <DocumentsList lang="fr" />;
}
