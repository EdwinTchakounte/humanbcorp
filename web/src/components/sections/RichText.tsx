import type { Section } from "@/lib/types";
import SectionIntro from "@/components/ui/SectionIntro";
import Reveal from "@/components/ui/Reveal";

/** Section texte générique (fallback + pages éditoriales). */
export default function RichText({ section }: { section: Section }) {
  return (
    <section id={section.anchor || undefined} className="py-12 md:py-16">
      <div className="container-hbc">
        <SectionIntro section={section} />
        {section.body && (
          <Reveal>
            <div className="prose mx-auto mt-8 max-w-3xl whitespace-pre-line text-lg text-muted">
              {section.body}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
