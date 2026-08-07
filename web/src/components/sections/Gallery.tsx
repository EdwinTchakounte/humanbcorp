import CmsLink from "@/components/ui/CmsLink";
import type { Section } from "@/lib/types";
import Reveal from "@/components/ui/Reveal";
import Pattern from "@/components/ui/Pattern";
import SectionIntro from "@/components/ui/SectionIntro";

/** Galerie alignée (grille uniforme) + bouton « Voir plus » optionnel. */
export default function Gallery({ section }: { section: Section }) {
  const all = (section.cards ?? []).filter((c) => c.image?.url);
  const limit = Number(section.options?.limit) || 0;
  const cards = limit > 0 ? all.slice(0, limit) : all;
  const more = section.options?.more as string | undefined;

  return (
    <section id={section.anchor || undefined} className="relative overflow-hidden bg-white py-14 md:py-20">
      <Pattern variant="grid" opacity={0.07} />
      <div className="container-hbc">
        <SectionIntro section={section} />
        <div className="mt-14 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal
              key={c.id}
              delay={0.04 * (i % 8)}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-soft shadow-hbc-card ring-1 ring-hairline transition-all duration-300 ease-hbc hover:-translate-y-1 hover:shadow-hbc-hover"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image!.url!}
                alt={c.image!.alt || c.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-hbc group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/60 via-brand-deep/0 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              {c.title && (
                <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="inline-block rounded-sm bg-white/90 px-3 py-1 text-xs font-medium text-brand-deep shadow-hbc-sm backdrop-blur">
                    {c.title}
                  </span>
                </div>
              )}
            </Reveal>
          ))}
        </div>

        {more && (
          <div className="mt-12 text-center">
            <CmsLink href={more} className="btn-outline-brand">
              Voir plus <i className="bx bx-right-arrow-alt text-lg" />
            </CmsLink>
          </div>
        )}
      </div>
    </section>
  );
}
