import type { Cta as CtaType, Section } from "@/lib/types";
import Reveal from "@/components/ui/Reveal";
import CtaButton from "@/components/ui/CtaButton";
import Pattern from "@/components/ui/Pattern";

/** Bandeau d'appel à l'action. */
export default function Cta({ section }: { section: Section }) {
  const buttons = (section.options?.cta as CtaType[]) || (section.options?.buttons as CtaType[]) || [];
  return (
    <section className="relative overflow-hidden py-12 md:py-16">
      <Pattern variant="dots" opacity={0.08} />
      <div className="container-hbc">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-2xl px-8 py-16 text-center text-white shadow-hbc-lg ring-1 ring-white/10"
            style={{ background: "linear-gradient(120deg, #1C2F57, #2D467B)" }}
          >
            <Pattern variant="grid" color="#ffffff" opacity={0.08} fade="none" />
            {/* Halos colorés : chaleur (accent) et profondeur (bleu clair) en coins. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(236,113,35,.55), transparent 70%)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full opacity-50 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(96,140,220,.5), transparent 70%)" }}
            />
            <div className="relative">
            {section.eyebrow && <p className="eyebrow justify-center">{section.eyebrow}</p>}
            <h2 className="mt-3 text-3xl text-white md:text-[2.75rem] md:leading-[1.08]">{section.title}</h2>
            {section.subtitle && <p className="mx-auto mt-4 max-w-2xl text-white/80">{section.subtitle}</p>}
            {buttons.length > 0 && (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {buttons.map((b, i) => (
                  <CtaButton key={i} cta={b} />
                ))}
              </div>
            )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
