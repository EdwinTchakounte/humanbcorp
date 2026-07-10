import type { Metadata } from "next";
import { getPage } from "@/lib/api";
import { buildMetadata } from "@/lib/meta";
import PageSections from "@/components/PageSections";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("accueil", "en", "/en");
}

export default async function HomeEn() {
  const page = await getPage("accueil", "en");
  if (!page) {
    return (
      <div className="container-hbc py-40 text-center">
        <h1>Site under configuration</h1>
        <p className="mt-4 text-muted">Content will be available soon.</p>
      </div>
    );
  }
  return <PageSections page={page} />;
}
