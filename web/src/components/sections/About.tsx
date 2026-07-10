import type { Cta, Section } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import Pattern from "@/components/ui/Pattern";
import FloatingIcons from "@/components/ui/FloatingIcons";
import CtaButton from "@/components/ui/CtaButton";
import ImageSlideshow from "@/components/ui/ImageSlideshow";

interface Badge {
  line1?: string;
  line2?: string;
  line3?: string;
}

/** À propos : diapo d'images + badge à gauche, texte justifié + progression à droite. */
export default function About({ section }: { section: Section }) {
  const badge = (section.options?.badge as Badge) || null;
  const buttons = (section.options?.buttons as Cta[]) || [];

  const slides = section.cards
    .filter((c) => c.image?.url)
    .map((c) => ({ url: c.image!.url as string, alt: c.image!.alt || c.title }));
  if (slides.length === 0 && section.bg_image?.url) {
    slides.push({ url: section.bg_image.url, alt: section.bg_image.alt || section.title });
  }
  const steps = section.cards.filter((c) => !c.image?.url && c.icon);

  return (
    <section id={section.anchor || undefined} className="relative overflow-hidden py-14 md:py-20">
      <Pattern variant="grid" opacity={0.06} />
      <FloatingIcons opacity={0.05} />
      {/* Logo en filigrane */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-10 top-1/2 -z-10 hidden w-[380px] -translate-y-1/2 opacity-[0.05] md:block"
      />

      <div className="container-hbc grid items-center gap-12 md:grid-cols-2">
        {/* Visuel : diapo d'images */}
        <Reveal className="order-2 md:order-1">
          <div className="relative">
            <ImageSlideshow slides={slides} className="aspect-[4/3] w-full rounded-2xl shadow-hbc" />
            {badge && (
              <div className="absolute -bottom-6 left-6 z-10 rounded-xl bg-accent px-6 py-4 text-white shadow-hbc-lg">
                <div className="text-xs opacity-90">{badge.line1}</div>
                <div className="font-heading text-2xl font-extrabold leading-none">{badge.line2}</div>
                <div className="text-xs opacity-90">{badge.line3}</div>
              </div>
            )}
          </div>
        </Reveal>

        {/* Contenu */}
        <div className="order-1 md:order-2">
          {section.eyebrow && (
            <Reveal>
              <p className="eyebrow">{section.eyebrow}</p>
            </Reveal>
          )}
          <Reveal delay={0.05}>
            <h2 className="mt-3 text-3xl md:text-4xl">{section.title}</h2>
          </Reveal>
          {section.body && (
            <Reveal delay={0.1}>
              <p className="mt-5 text-justify text-lg leading-relaxed text-muted">{section.body}</p>
            </Reveal>
          )}

          {/* Progression soft : timeline des atouts */}
          {steps.length > 0 && (
            <ol className="relative mt-8 space-y-6 before:absolute before:left-6 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-gradient-to-b before:from-accent before:via-brand before:to-transparent">
              {steps.map((c, i) => (
                <Reveal key={c.id} delay={0.12 * i}>
                  <li className="relative flex gap-4">
                    <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-brand-soft bg-white text-2xl text-brand shadow-hbc-sm">
                      <Icon name={c.icon || "bx-check"} />
                    </span>
                    <div className="pt-1">
                      <div className="font-heading font-semibold text-brand-deep">{c.title}</div>
                      {c.text && <p className="text-sm text-muted">{c.text}</p>}
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          )}

          {buttons.length > 0 && (
            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-wrap gap-3">
                {buttons.map((b, i) => (
                  <CtaButton key={i} cta={b} />
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
