import type { Section } from "@/lib/types";
import Reveal from "@/components/ui/Reveal";
import Blobs from "@/components/ui/Blobs";
import Pattern from "@/components/ui/Pattern";

/** Bandeau clair de chiffres-clés (soft). */
export default function Milestone({ section }: { section: Section }) {
  return (
    <section id={section.anchor || undefined} className="relative overflow-hidden bg-brand-soft py-20">
      <Pattern variant="grid" opacity={0.09} />
      <Blobs variant="mix" />
      <div className="container-hbc grid grid-cols-2 gap-8 md:grid-cols-4">
        {(section.cards ?? []).map((c, i) => (
          <Reveal key={c.id} delay={0.06 * i}>
            <div className="rounded-2xl bg-white/70 px-4 py-8 text-center shadow-hbc-sm backdrop-blur">
              <div className="font-heading text-4xl font-extrabold text-brand md:text-5xl">
                <span className="text-accent">{String((c.extra?.value as string) ?? "")}</span>
              </div>
              <div className="mt-2 text-sm text-muted">{c.title}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
