import type { Metadata } from "next";
import DocumentsList from "@/components/documents/DocumentsList";

export const metadata: Metadata = {
  title: "Resources — HBC-RH",
  description: "Download our brochures, catalogues and fact sheets.",
};

export default function EnRessourcesPage() {
  return <DocumentsList lang="en" />;
}
