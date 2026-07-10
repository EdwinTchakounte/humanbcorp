import type { Section } from "@/lib/types";
import Reveal from "@/components/ui/Reveal";

/** Bande de statistiques — carte flottante qui chevauche le hero. */
export default function Stats({ section }: { section: Section }) {
  return (
    <section className="relative z-20 -mt-20 md:-mt-24">
      <div className="container-hbc">
        <Reveal>
          <div className="grid grid-cols-2 gap-6 rounded-2xl border border-line/70 bg-white px-6 py-9 shadow-hbc-lg md:grid-cols-4 md:px-10">
            {section.cards.map((c) => (
              <div key={c.id} className="text-center">
                <div className="font-heading text-3xl font-extrabold text-brand md:text-4xl">
                  {String((c.extra?.value as string) ?? "")}
                </div>
                <div className="mt-1 text-sm text-muted">{c.title}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
