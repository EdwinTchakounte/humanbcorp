import type { Metadata } from "next";
import { buildFormationMetadata } from "@/lib/formation-meta";
import FormationDetail from "@/components/formations/FormationDetail";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildFormationMetadata(params.id, "en");
}

export default function EnFormationDetailPage({ params }: Props) {
  return <FormationDetail id={params.id} lang="en" />;
}
