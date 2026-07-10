import type { PageContent } from "@/lib/types";
import SectionRenderer from "@/components/SectionRenderer";
import SectionReveal from "@/components/ui/SectionReveal";

// Sections qui gèrent elles-mêmes leur positionnement (chevauchement, plein écran).
const NO_WRAP = new Set(["hero", "stats"]);

/** Rend, dans l'ordre, toutes les sections visibles avec une transition douce. */
export default function PageSections({ page }: { page: PageContent }) {
  return (
    <>
      {page.sections.map((s) =>
        NO_WRAP.has(s.type) ? (
          <SectionRenderer key={s.id} section={s} />
        ) : (
          <SectionReveal key={s.id}>
            <SectionRenderer section={s} />
          </SectionReveal>
        )
      )}
    </>
  );
}
