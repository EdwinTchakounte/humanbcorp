"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem, SiteSettings } from "@/lib/types";
import CartButton from "@/components/cart/CartButton";

const T = {
  fr: { login: "Connexion", other: "EN" },
  en: { login: "Login", other: "FR" },
} as const;

// Liens statiques vers des routes applicatives (hors CMS) : catalogue, carrières…
type StaticLink = { fr: string; en: string; href: string };

// Regroupement en 4 points max (déroulants).
const GROUPS: {
  fr: string;
  en: string;
  slug?: string;
  children?: string[];
  extra?: StaticLink[];
}[] = [
  { fr: "Accueil", en: "Home", slug: "accueil" },
  {
    fr: "Expertises",
    en: "Expertise",
    children: ["services", "realisations"],
    extra: [{ fr: "Formations", en: "Trainings", href: "/formations" }],
  },
  {
    fr: "Le cabinet",
    en: "Company",
    children: ["a-propos", "equipe", "blog", "recrutement"],
    extra: [
      { fr: "Carrières", en: "Careers", href: "/carrieres" },
      { fr: "Ressources", en: "Resources", href: "/ressources" },
    ],
  },
  { fr: "Contact", en: "Contact", slug: "contact" },
];

export default function Header({
  nav,
  settings,
  lang = "fr",
}: {
  nav: NavItem[];
  settings: SiteSettings | null;
  lang?: "fr" | "en";
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const t = T[lang];
  const prefix = lang === "en" ? "/en" : "";

  useEffect(() => setOpen(false), [pathname]);

  // Verrouille le défilement de la page tant que le tiroir mobile est ouvert.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // État « défilé » : l'en-tête se resserre et gagne en profondeur dès qu'on
  // quitte le haut de page (finition premium, verre dépoli plus marqué).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const bySlug = (slug: string) => nav.find((n) => n.slug === slug);
  const href = (slug: string) => (slug === "accueil" ? prefix || "/" : `${prefix}/${slug}`);
  // Liens statiques (catalogue, carrières…) : préfixés par la langue, sinon le
  // site anglais renverrait vers les routes françaises.
  const extraHref = (h: string) => `${prefix}${h}`;
  const isActive = (slug: string) =>
    slug === "accueil" ? pathname === (prefix || "/") : pathname === `${prefix}/${slug}`;
  const label = (g: (typeof GROUPS)[number]) => (lang === "en" ? g.en : g.fr);

  const toggleLangHref =
    lang === "en" ? pathname.replace(/^\/en/, "") || "/" : pathname === "/" ? "/en" : `/en${pathname}`;

  return (
    <header
      className={`sticky top-0 z-50 glass transition-all duration-300 ease-hbc ${
        scrolled ? "border-b border-hairline shadow-hbc" : "border-b border-transparent"
      }`}
    >
      <div
        className={`container-hbc flex items-center justify-between transition-all duration-300 ease-hbc ${
          scrolled ? "h-[60px]" : "h-[74px]"
        }`}
      >
        <Link href={prefix || "/"} className="group flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-mark.png"
            alt={settings?.brand_name || "HBC-RH"}
            className="h-11 w-auto transition-transform duration-300 group-hover:scale-105 md:h-12"
          />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-heading text-base font-bold text-brand-deep md:text-lg">HBC-RH</span>
            <span className="text-[11px] font-medium tracking-wide text-muted">
              {settings?.slogan || "Libérer le potentiel humain"}
            </span>
          </span>
        </Link>

        {/* Desktop nav groupée */}
        <nav className="hidden items-center gap-1 lg:flex">
          {GROUPS.map((g) => {
            const children = (g.children || []).map(bySlug).filter(Boolean) as NavItem[];
            if (g.slug) {
              return (
                <Link
                  key={g.fr}
                  href={href(g.slug)}
                  data-active={isActive(g.slug)}
                  className="nav-link"
                >
                  {label(g)}
                </Link>
              );
            }
            if (children.length === 0 && !g.extra?.length) return null;
            return (
              <div key={g.fr} className="group relative">
                <button className="nav-link flex items-center gap-1 group-hover:text-accent">
                  {label(g)}
                  <i className="bx bx-chevron-down text-base transition-transform group-hover:rotate-180" />
                </button>
                <div className="invisible absolute left-0 top-full min-w-[210px] translate-y-1 rounded-xl border border-line bg-white p-2 opacity-0 shadow-hbc transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  {children.map((c) => (
                    <Link
                      key={c.slug}
                      href={href(c.slug)}
                      className={`block rounded-lg px-3 py-2 text-sm ${
                        isActive(c.slug) ? "bg-brand-soft text-accent" : "text-brand-deep hover:bg-brand-soft"
                      }`}
                    >
                      {c.nav_label}
                    </Link>
                  ))}
                  {(g.extra || []).map((x) => (
                    <Link
                      key={x.href}
                      href={extraHref(x.href)}
                      className={`block rounded-lg px-3 py-2 text-sm ${
                        pathname === extraHref(x.href) ? "bg-brand-soft text-accent" : "text-brand-deep hover:bg-brand-soft"
                      }`}
                    >
                      {lang === "en" ? x.en : x.fr}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          <Link
            href={toggleLangHref}
            className="ml-1 rounded-md border border-line px-3 py-1 font-heading text-xs font-semibold text-brand-deep transition-colors hover:border-brand hover:text-brand"
          >
            {t.other}
          </Link>
          <CartButton label={lang === "en" ? "Cart" : "Panier"} />
          <Link href="/connexion" className="btn-brand ml-1 !px-5 !py-2 text-xs">
            <i className="bx bx-user" aria-hidden /> {t.login}
          </Link>
        </nav>

        {/* Actions mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href={toggleLangHref}
            className="rounded-md border border-line px-2.5 py-1 font-heading text-xs font-semibold text-brand-deep"
          >
            {t.other}
          </Link>
          <CartButton label={lang === "en" ? "Cart" : "Panier"} />
          <button onClick={() => setOpen((v) => !v)} aria-label="Menu" className="text-brand-deep">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Voile mobile — ferme au tap hors du panneau, flou léger (premium). */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[60] bg-brand-deep/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      />

      {/* Drawer mobile — panneau glissant depuis la droite */}
      <aside
        className={`fixed inset-y-0 right-0 z-[70] flex h-[100dvh] w-[86%] max-w-sm flex-col bg-white shadow-hbc-lg transition-transform duration-300 ease-hbc lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-[70px] shrink-0 items-center justify-between border-b border-hairline px-5">
          <span className="font-heading text-base font-bold text-brand-deep">Menu</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="rounded-lg p-2 text-brand-deep transition-colors hover:bg-brand-soft"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {GROUPS.map((g) => {
            const children = (g.children || []).map(bySlug).filter(Boolean) as NavItem[];
            if (g.slug) {
              return (
                <Link
                  key={g.fr}
                  href={href(g.slug)}
                  onClick={() => setOpen(false)}
                  className={`flex items-center rounded-xl px-4 py-3 font-heading font-semibold transition-colors ${
                    isActive(g.slug) ? "bg-brand-soft text-accent" : "text-brand-deep hover:bg-brand-soft/60"
                  }`}
                >
                  {label(g)}
                </Link>
              );
            }
            return (
              <div key={g.fr} className="mt-1">
                <div className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  {label(g)}
                </div>
                {children.map((c) => (
                  <Link
                    key={c.slug}
                    href={href(c.slug)}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive(c.slug) ? "bg-brand-soft/70 text-accent" : "text-ink hover:bg-brand-soft/60"
                    }`}
                  >
                    <i className="bx bx-chevron-right text-base text-muted" />
                    {c.nav_label}
                  </Link>
                ))}
                {(g.extra || []).map((x) => (
                  <Link
                    key={x.href}
                    href={extraHref(x.href)}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                      pathname === extraHref(x.href) ? "bg-brand-soft/70 text-accent" : "text-ink hover:bg-brand-soft/60"
                    }`}
                  >
                    <i className="bx bx-chevron-right text-base text-muted" />
                    {lang === "en" ? x.en : x.fr}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-hairline px-4 py-4 pb-safe">
          <Link href="/connexion" onClick={() => setOpen(false)} className="btn-brand w-full justify-center">
            <i className="bx bx-user" aria-hidden /> {t.login}
          </Link>
        </div>
      </aside>
    </header>
  );
}
