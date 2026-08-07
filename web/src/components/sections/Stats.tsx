import type { Section } from "@/lib/types";
import Reveal from "@/components/ui/Reveal";

/** Bande de statistiques — carte flottante qui chevauche le hero. */
export default function Stats({ section }: { section: Section }) {
  return (
    <section className="relative z-20 -mt-20 md:-mt-24">
      <div className="container-hbc">
        <Reveal>
          <div className="grid grid-cols-2 gap-y-8 rounded-2xl border border-hairline bg-white px-6 py-10 shadow-hbc-lg md:grid-cols-4 md:divide-x md:divide-hairline md:px-4">
            {(section.cards ?? []).map((c) => (
              <div key={c.id} className="px-2 text-center md:px-6">
                <div className="text-gradient font-heading text-4xl font-extrabold tabular-nums md:text-5xl">
                  {String((c.extra?.value as string) ?? "")}
                </div>
                <div className="mt-2 text-sm font-medium text-muted">{c.title}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
