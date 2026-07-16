"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { api } from "@/lib/api";

/**
 * Fil d'Ariane contextuel.
 *
 * Le header n'affichait qu'un titre générique (« Formations »), identique quelle
 * que soit la formation ouverte : aucun repère, et le seul retour possible était
 * d'un cran. Ici le chemin montre le VRAI nom de la formation et de l'activité,
 * et chaque segment est cliquable — on remonte à n'importe quel niveau d'un clic.
 */
const SECTIONS: { prefix: string; label: string }[] = [
  { prefix: "/articles", label: "Articles" },
  { prefix: "/media", label: "Médiathèque" },
  { prefix: "/settings", label: "Réglages" },
  { prefix: "/pages", label: "Pages" },
  { prefix: "/agenda", label: "Agenda" },
  { prefix: "/formations", label: "Formations" },
  { prefix: "/suivi", label: "Suivi apprenants" },
  { prefix: "/publications", label: "Publications" },
  { prefix: "/inscriptions", label: "Inscriptions" },
  { prefix: "/paiements", label: "Paiements" },
  { prefix: "/messagerie", label: "Messagerie" },
];

type Crumb = { label: string; href?: string };

export default function Breadcrumbs() {
  const pathname = usePathname();
  const [noms, setNoms] = useState<{ theme?: string; activite?: string }>({});

  // Segments : /formations/<id>/contenu/activite/<aid>
  const seg = pathname.split("/").filter(Boolean);
  const themeId = seg[0] === "formations" ? seg[1] : undefined;
  const activiteId = seg[3] === "activite" ? seg[4] : undefined;

  // Noms réels des entités profondes (formation, activité) — sinon le fil
  // afficherait un identifiant opaque.
  useEffect(() => {
    let vivant = true;
    async function charger() {
      const maj: { theme?: string; activite?: string } = {};
      try {
        if (themeId) {
          const t = await api<{ title: string }>(`/modules/themes/${themeId}/`);
          maj.theme = t.title;
        }
        if (activiteId) {
          const a = await api<{ title: string }>(`/modules/activities/${activiteId}/`);
          maj.activite = a.title;
        }
      } catch {
        /* ressource inaccessible : on retombe sur les libellés génériques */
      }
      if (vivant) setNoms(maj);
    }
    if (themeId || activiteId) charger();
    else setNoms({});
    return () => {
      vivant = false;
    };
  }, [themeId, activiteId]);

  const crumbs: Crumb[] = [];
  if (pathname === "/") {
    crumbs.push({ label: "Pages" });
  } else {
    const section = SECTIONS.find((s) => pathname.startsWith(s.prefix));
    if (section) crumbs.push({ label: section.label, href: section.prefix });

    if (themeId) {
      // Le lien « formation » mène à son arbre de contenu.
      crumbs.push({
        label: noms.theme || "Formation",
        href: activiteId ? `/formations/${themeId}/contenu` : undefined,
      });
      if (activiteId) crumbs.push({ label: noms.activite || "Activité" });
    }
  }

  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm">
      {crumbs.map((c, i) => {
        const dernier = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <i className="bx bx-chevron-right text-base text-muted" />}
            {c.href && !dernier ? (
              <Link href={c.href} className="text-muted transition hover:text-brand-deep">
                {c.label}
              </Link>
            ) : (
              <span className={dernier ? "font-heading font-semibold text-brand-deep" : "text-muted"}>
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
