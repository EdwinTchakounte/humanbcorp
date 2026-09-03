import Link from "next/link";
import type { Section } from "@/lib/types";
import { getFormations } from "@/lib/api";
import Reveal from "@/components/ui/Reveal";
import Blobs from "@/components/ui/Blobs";
import Pattern from "@/components/ui/Pattern";
import FloatingIcons from "@/components/ui/FloatingIcons";
import Wave from "@/components/ui/Wave";
import SectionIntro from "@/components/ui/SectionIntro";

/**
 * Bloc « boxes par CATÉGORIE », alimenté par le CATALOGUE en direct.
 *
 * Là où un bloc `services` liste des cartes saisies à la main (qui dérivent dès
 * qu'une offre change), ce bloc dérive les tuiles des catégories réellement
 * présentes dans `/site/formations/` : publier une formation dans une nouvelle
 * catégorie ajoute une box automatiquement, retirer la dernière formation d'une
 * catégorie la fait disparaître. Chaque box mène au catalogue déjà filtré
 * (`/formations?cat=<nom>`).
 */

// Icône par catégorie (repli `bx-folder` pour toute catégorie non listée : le
// bloc reste correct même pour une catégorie inventée par l'admin).
const ICONES: Record<string, string> = {};

export default async function Categories({ section }: { section: Section }) {
  const toutes = await getFormations();

  // Regrouper par catégorie, dans l'ordre d'apparition au catalogue, en comptant
  // les offres. Les formations sans catégorie sont ignorées (rien à cibler).
  const parCat = new Map<string, number>();
  for (const f of toutes) {
    const c = f.categorie_name;
    if (!c) continue;
    parCat.set(c, (parCat.get(c) ?? 0) + 1);
  }

  // Sans catégorie au catalogue, pas de bloc (comme un bloc formations en direct).
  if (parCat.size === 0) return null;

  const soft = section.bg_color === "soft";
  const boxes = Array.from(parCat.entries()).map(([cat, count]) => ({
    cat,
    count,
    href: `/formations?cat=${encodeURIComponent(cat)}`,
    icon: ICONES[cat] ?? "bx-folder-open",
  }));

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
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {boxes.map((b, i) => (
            <Reveal key={b.cat} delay={0.06 * (i % 3)}>
              <Link
                href={b.href}
                className="group flex h-full flex-col rounded-2xl border border-hairline bg-white p-6 shadow-hbc-card transition-all duration-300 ease-hbc hover:-translate-y-1.5 hover:border-line hover:shadow-hbc-hover"
              >
                <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand">
                  <i className={`bx ${b.icon}`} />
                </span>
                <h3 className="font-heading text-lg text-brand-deep">{b.cat}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">
                  {b.count} formation{b.count > 1 ? "s" : ""}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-accent">
                  Voir les formations
                  <i className="bx bx-right-arrow-alt transition-transform duration-300 ease-hbc group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
