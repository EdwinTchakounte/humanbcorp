"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import type { NavItem, SiteSettings } from "@/lib/types";

// Routes « espace » (app, pas vitrine) où le footer marketing ne doit pas s'afficher.
const ESPACE_PREFIXES = ["/mon-espace"];

/**
 * Affiche le pied de page vitrine, SAUF dans les espaces (ex. espace apprenant)
 * qui adoptent un rendu « application » (barre de navigation basse, pas de footer).
 */
export default function ConditionalFooter(props: {
  nav: NavItem[];
  settings: SiteSettings | null;
  lang?: "fr" | "en";
}) {
  const pathname = usePathname() || "";
  const dansEspace = ESPACE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith("/en" + p)
  );
  if (dansEspace) return null;
  return <Footer {...props} />;
}
