import type { Section } from "@/lib/types";
import Reveal from "@/components/ui/Reveal";

/** En-tête de section centré : sur-titre + titre + filet + sous-titre. */
export default function SectionIntro({ section, light = false }: { section: Section; light?: boolean }) {
  if (!section.eyebrow && !section.title && !section.subtitle) return null;
  return (
    <div className="mx-auto max-w-2xl text-center">
      {section.eyebrow && (
        <Reveal>
          <p className="eyebrow">{section.eyebrow}</p>
        </Reveal>
      )}
      {section.title && (
        <Reveal delay={0.05}>
          <h2 className={`mt-3 text-3xl md:text-4xl ${light ? "text-white" : ""}`}>{section.title}</h2>
        </Reveal>
      )}
      <div className="section-rule" />
      {section.subtitle && (
        <Reveal delay={0.1}>
          <p className={`mt-5 text-lg ${light ? "text-white/80" : "text-muted"}`}>{section.subtitle}</p>
        </Reveal>
      )}
    </div>
  );
}
