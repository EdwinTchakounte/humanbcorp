import Link from "next/link";
import type { Card, Section } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import Blobs from "@/components/ui/Blobs";
import Pattern from "@/components/ui/Pattern";
import FloatingIcons from "@/components/ui/FloatingIcons";
import Wave from "@/components/ui/Wave";
import SectionIntro from "@/components/ui/SectionIntro";

/** Carte avec image en haut (blog, équipe, offres). */
function ImageCard({ c }: { c: Card }) {
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line/70 bg-white shadow-hbc-sm transition-all duration-300 ease-hbc hover:-translate-y-1.5 hover:shadow-hbc">
      <div className="aspect-[16/10] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.image!.url!}
          alt={c.image!.alt || c.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-hbc group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-6">
        {c.title && <h3 className="text-lg text-brand-deep">{c.title}</h3>}
        {c.text && <p className="mt-2 flex-1 text-sm text-muted">{c.text}</p>}
        {c.link && (
          <Link href={c.link} className="mt-4 inline-flex items-center gap-1 font-heading text-sm font-semibold text-accent">
            {c.link_label || "En savoir plus"} <i className="bx bx-right-arrow-alt" />
          </Link>
        )}
      </div>
    </div>
  );
}

/** Carte avec cercle d'icône en débord (services / atouts). */
function IconCard({ c }: { c: Card }) {
  return (
    <div className="group relative h-full rounded-2xl border border-line/70 bg-white px-6 pb-8 pt-14 text-center shadow-hbc-sm transition-all duration-300 ease-hbc hover:-translate-y-2 hover:shadow-hbc">
      <span className="absolute -top-9 left-1/2 flex h-[72px] w-[72px] -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-brand to-brand-dark text-3xl text-white shadow-hbc transition-all duration-300 ease-hbc group-hover:from-accent group-hover:to-accent-dark">
        <Icon name={c.icon || "bx-check"} />
      </span>
      <h3 className="text-lg text-brand-deep">{c.title}</h3>
      {c.text && <p className="mt-3 text-sm text-muted">{c.text}</p>}
    </div>
  );
}

/** Grille de cartes — icônes (services) ou images (blog / équipe / offres). */
export default function Services({ section }: { section: Section }) {
  const soft = section.bg_color === "soft";
  const hasImages = section.cards.some((c) => c.image?.url);
  const cols =
    section.cards.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      id={section.anchor || undefined}
      className={`relative overflow-hidden ${
        soft ? "bg-brand-soft pb-14 pt-16 md:pb-20 md:pt-24" : "py-14 md:py-20"
      }`}
    >
      {soft && <Wave position="top" fill="#ffffff" />}
      {soft ? <Pattern variant="dots" opacity={0.1} /> : <Blobs variant="mix" />}
      <FloatingIcons opacity={soft ? 0.05 : 0.04} />
      <div className="container-hbc">
        <SectionIntro section={section} />
        <div className={`grid gap-x-6 ${hasImages ? "mt-14 gap-y-8" : "mt-20 gap-y-16"} ${cols}`}>
          {section.cards.map((c, i) => (
            <Reveal key={c.id} delay={0.06 * (i % 4)}>
              {c.image?.url ? <ImageCard c={c} /> : <IconCard c={c} />}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
