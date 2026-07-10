import type { Metadata } from "next";
import { getPage } from "@/lib/api";
import { buildMetadata } from "@/lib/meta";
import PageSections from "@/components/PageSections";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("accueil", "fr", "/");
}

export default async function Home() {
  const page = await getPage("accueil", "fr");
  if (!page) {
    return (
      <div className="container-hbc py-40 text-center">
        <h1>Site en cours de configuration</h1>
        <p className="mt-4 text-muted">Le contenu sera bientôt disponible.</p>
      </div>
    );
  }
  return <PageSections page={page} />;
}
