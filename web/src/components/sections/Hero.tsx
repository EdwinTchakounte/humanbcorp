import type { Cta, Section } from "@/lib/types";
import HeroCarousel from "@/components/sections/HeroCarousel";

/** Hero image en carrousel soft. Les cartes avec image = slides ; avec icône = badges. */
export default function Hero({ section }: { section: Section }) {
  const accent = (section.options?.accent_word as string) || "";
  const ctas = (section.options?.cta as Cta[]) || [];

  const slides = section.cards
    .filter((c) => c.image?.url)
    .map((c) => ({ url: c.image!.url as string, alt: c.image!.alt || c.title }));

  // Fallback : image de fond de la section si aucune carte-slide.
  if (slides.length === 0 && section.bg_image?.url) {
    slides.push({ url: section.bg_image.url, alt: section.bg_image.alt || section.title });
  }

  const badges = section.cards
    .filter((c) => !c.image?.url && c.icon)
    .map((c) => ({ id: c.id, title: c.title, icon: c.icon }));

  return (
    <HeroCarousel
      slides={slides}
      eyebrow={section.eyebrow}
      title={section.title}
      accentWord={accent}
      subtitle={section.subtitle}
      ctas={ctas}
      badges={badges}
    />
  );
}
