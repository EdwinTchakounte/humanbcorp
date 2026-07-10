import type { Metadata } from "next";
import { getFormation } from "@/lib/api";
import FormationDetail from "@/components/formations/FormationDetail";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await getFormation(params.id);
  if (!f) return { title: "Training not found — HBC-RH" };
  return { title: `${f.title} — HBC-RH`, description: f.description?.slice(0, 160) };
}

export default function EnFormationDetailPage({ params }: Props) {
  return <FormationDetail id={params.id} lang="en" />;
}
