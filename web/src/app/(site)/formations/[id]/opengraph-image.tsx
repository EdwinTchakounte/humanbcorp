import { formationOgCard, OG_ALT, OG_SIZE } from "@/lib/og-card";

export const alt = OG_ALT.fr;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image({ params }: { params: { id: string } }) {
  return formationOgCard(params.id, "fr");
}
