import type { Metadata } from "next";
import { buildFormationMetadata } from "@/lib/formation-meta";
import FormationDetail from "@/components/formations/FormationDetail";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildFormationMetadata(params.id, "fr");
}

export default function FormationDetailPage({ params }: Props) {
  return <FormationDetail id={params.id} lang="fr" />;
}
