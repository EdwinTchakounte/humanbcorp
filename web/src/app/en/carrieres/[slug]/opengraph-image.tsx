import { offerOgCard, OG_ALT, OG_SIZE } from "@/lib/og-offer";

export const alt = OG_ALT.en;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image({ params }: { params: { slug: string } }) {
  return offerOgCard(params.slug, "en");
}
