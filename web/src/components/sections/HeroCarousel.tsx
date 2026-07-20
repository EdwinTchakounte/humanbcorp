"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Cta } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import Wave from "@/components/ui/Wave";
import CtaButton from "@/components/ui/CtaButton";

interface Slide {
  url: string;
  alt: string;
}
interface Badge {
  id: number;
  title: string;
  icon: string;
}

function AccentTitle({ title, accent }: { title: string; accent?: string }) {
  if (!accent || !title.includes(accent)) return <>{title}</>;
  const [before, after] = title.split(accent);
  return (
    <>
      {before}
      <span className="text-accent">{accent}</span>
      {after}
    </>
  );
}

export default function HeroCarousel({
  slides,
  eyebrow,
  title,
  accentWord,
  subtitle,
  ctas,
  badges,
}: {
  slides: Slide[];
  eyebrow?: string;
  title: string;
  accentWord?: string;
  subtitle?: string;
  ctas: Cta[];
  badges: Badge[];
}) {
  const [i, setI] = useState(0);
  const count = slides.length;
  const go = useCallback((n: number) => setI(((n % count) + count) % count), [count]);

  // Pages secondaires (sans CTA ni badge) → bannière compacte ; accueil → hero moyen.
  const compact = ctas.length === 0 && badges.length === 0;
  const heightClass = compact
    ? "h-[34vh] max-h-[320px] min-h-[240px]"
    : "h-[72vh] max-h-[680px] min-h-[500px]";

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setI((prev) => (prev + 1) % count), 6000);
    return () => clearInterval(id);
  }, [count]);

  return (
    <section className={`relative ${heightClass} w-full overflow-hidden bg-brand-deep`}>
      {/* Slides plein écran en fondu */}
      <AnimatePresence>
        <motion.div
          key={i}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slides[i]?.url} alt={slides[i]?.alt || ""} className="h-full w-full object-cover" />
        </motion.div>
      </AnimatePresence>

      {/* Voile doux et homogène (texte centré lisible, pas de noir plat) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,33,64,.38) 0%, rgba(20,33,64,.44) 45%, rgba(20,33,64,.60) 100%)",
        }}
      />

      {/* Contenu centré au milieu de l'image */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="container-hbc w-full">
          <div className="relative mx-auto max-w-3xl pb-6 text-center">
            {/* Halo flou derrière le texte pour le faire ressortir */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -inset-y-6 -z-10 rounded-[2.5rem] bg-brand-deep/25 backdrop-blur-md ring-1 ring-white/10"
              style={{
                maskImage:
                  "radial-gradient(120% 100% at 50% 50%, #000 55%, transparent 100%)",
                WebkitMaskImage:
                  "radial-gradient(120% 100% at 50% 50%, #000 55%, transparent 100%)",
              }}
            />
            {eyebrow && (
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-sm bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {eyebrow}
              </motion.p>
            )}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 text-balance text-4xl leading-[1.08] text-white drop-shadow-sm md:text-6xl"
            >
              <AccentTitle title={title} accent={accentWord} />
            </motion.h1>
            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="mt-5 max-w-xl text-lg text-white/90"
              >
                {subtitle}
              </motion.p>
            )}
            {ctas.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.18 }}
                className="mt-8 flex flex-wrap justify-center gap-3"
              >
                {ctas.map((c, k) => (
                  <CtaButton key={k} cta={c} />
                ))}
              </motion.div>
            )}
            {badges.length > 0 && (
              <ul className="mt-9 hidden flex-wrap justify-center gap-x-6 gap-y-2 sm:flex">
                {badges.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 text-sm text-white/90">
                    <Icon name={b.icon || "bx-check-circle"} className="text-xl text-accent" />
                    {b.title}
                  </li>
                ))}
              </ul>
            )}

            {/* Points (sous le contenu) */}
            {count > 1 && (
              <div className="mt-10 flex justify-center gap-2">
                {slides.map((_, k) => (
                  <button
                    key={k}
                    onClick={() => go(k)}
                    aria-label={`Slide ${k + 1}`}
                    className={`h-2 rounded-full transition-all ${k === i ? "w-8 bg-accent" : "w-2 bg-white/50 hover:bg-white"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Flèches */}
      {count > 1 && (
        <>
          <button
            onClick={() => go(i - 1)}
            aria-label="Précédent"
            className="absolute left-6 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 md:flex"
          >
            <i className="bx bx-chevron-left text-2xl" />
          </button>
          <button
            onClick={() => go(i + 1)}
            aria-label="Suivant"
            className="absolute right-6 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 md:flex"
          >
            <i className="bx bx-chevron-right text-2xl" />
          </button>
        </>
      )}

      {/* Transition douce vers la section suivante */}
      <Wave fill="#ffffff" />
    </section>
  );
}
