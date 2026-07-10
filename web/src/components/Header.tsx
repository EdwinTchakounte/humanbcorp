"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem, SiteSettings } from "@/lib/types";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

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
  const pathname = usePathname();
  const t = T[lang];
  const prefix = lang === "en" ? "/en" : "";

  useEffect(() => setOpen(false), [pathname]);

  const bySlug = (slug: string) => nav.find((n) => n.slug === slug);
  const href = (slug: string) => (slug === "accueil" ? prefix || "/" : `${prefix}/${slug}`);
  const isActive = (slug: string) =>
    slug === "accueil" ? pathname === (prefix || "/") : pathname === `${prefix}/${slug}`;
  const label = (g: (typeof GROUPS)[number]) => (lang === "en" ? g.en : g.fr);

  const toggleLangHref =
    lang === "en" ? pathname.replace(/^\/en/, "") || "/" : pathname === "/" ? "/en" : `/en${pathname}`;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 shadow-hbc-sm backdrop-blur-md">
      <div className="container-hbc flex h-[70px] items-center justify-between">
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
                  className={`rounded-lg px-3 py-2 font-heading text-sm font-medium transition-colors ${
                    isActive(g.slug) ? "text-accent" : "text-brand-deep hover:text-accent"
                  }`}
                >
                  {label(g)}
                </Link>
              );
            }
            if (children.length === 0 && !g.extra?.length) return null;
            return (
              <div key={g.fr} className="group relative">
                <button className="flex items-center gap-1 rounded-lg px-3 py-2 font-heading text-sm font-medium text-brand-deep transition-colors group-hover:text-accent">
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
                      href={x.href}
                      className={`block rounded-lg px-3 py-2 text-sm ${
                        pathname === x.href ? "bg-brand-soft text-accent" : "text-brand-deep hover:bg-brand-soft"
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
            className="ml-1 rounded-full border border-line px-3 py-1 font-heading text-xs font-semibold text-brand-deep transition-colors hover:border-brand hover:text-brand"
          >
            {t.other}
          </Link>
          <a href={DASHBOARD_URL} className="btn-brand ml-1 !px-5 !py-2 text-xs">
            <i className="bx bx-user" aria-hidden /> {t.login}
          </a>
        </nav>

        {/* Actions mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href={toggleLangHref}
            className="rounded-full border border-line px-2.5 py-1 font-heading text-xs font-semibold text-brand-deep"
          >
            {t.other}
          </Link>
          <button onClick={() => setOpen((v) => !v)} aria-label="Menu" className="text-brand-deep">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Drawer mobile */}
      <div
        className={`overflow-hidden bg-white shadow-hbc transition-[max-height] duration-300 ease-hbc lg:hidden ${
          open ? "max-h-[90vh]" : "max-h-0"
        }`}
      >
        <nav className="container-hbc flex flex-col gap-1 py-4">
          {GROUPS.map((g) => {
            const children = (g.children || []).map(bySlug).filter(Boolean) as NavItem[];
            if (g.slug) {
              return (
                <Link
                  key={g.fr}
                  href={href(g.slug)}
                  className={`rounded-lg px-3 py-3 font-heading font-medium ${
                    isActive(g.slug) ? "bg-brand-soft text-accent" : "text-brand-deep hover:bg-brand-soft"
                  }`}
                >
                  {label(g)}
                </Link>
              );
            }
            return (
              <div key={g.fr} className="py-1">
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">{label(g)}</div>
                {children.map((c) => (
                  <Link
                    key={c.slug}
                    href={href(c.slug)}
                    className={`block rounded-lg px-5 py-2.5 font-heading text-sm ${
                      isActive(c.slug) ? "text-accent" : "text-brand-deep hover:bg-brand-soft"
                    }`}
                  >
                    {c.nav_label}
                  </Link>
                ))}
                {(g.extra || []).map((x) => (
                  <Link
                    key={x.href}
                    href={x.href}
                    className={`block rounded-lg px-5 py-2.5 font-heading text-sm ${
                      pathname === x.href ? "text-accent" : "text-brand-deep hover:bg-brand-soft"
                    }`}
                  >
                    {lang === "en" ? x.en : x.fr}
                  </Link>
                ))}
              </div>
            );
          })}
          <a href={DASHBOARD_URL} className="btn-brand mt-2">
            <i className="bx bx-user" aria-hidden /> {t.login}
          </a>
        </nav>
      </div>
    </header>
  );
}
