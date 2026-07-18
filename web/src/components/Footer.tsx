import Link from "next/link";
import type { NavItem, SiteSettings } from "@/lib/types";
import Pattern from "@/components/ui/Pattern";

export default function Footer({
  nav,
  settings,
  lang = "fr",
}: {
  nav: NavItem[];
  settings: SiteSettings | null;
  lang?: "fr" | "en";
}) {
  const year = 2026;
  // Sur le site anglais, tous les liens internes doivent être préfixés par /en.
  const prefix = lang === "en" ? "/en" : "";
  const to = (slug: string) => (slug === "accueil" ? prefix || "/" : `${prefix}/${slug}`);
  const phones = settings?.phones_list ?? [];
  const socials: Array<[string, string]> = [
    ["bxl-facebook", settings?.facebook || ""],
    ["bxl-linkedin", settings?.linkedin || ""],
    ["bxl-instagram", settings?.instagram || ""],
    ["bxl-whatsapp", settings?.whatsapp ? `https://wa.me/${settings.whatsapp}` : ""],
  ];
  const activeSocials = socials.filter(([, url]) => url);

  return (
    <footer className="relative overflow-hidden bg-brand-deep text-white">
      {/* Filet d'accent en haut */}
      <div className="h-1 w-full bg-gradient-to-r from-accent via-accent/60 to-brand" />
      {/* Décor : motif + halos flous */}
      <Pattern variant="grid" color="#ffffff" opacity={0.05} fade="top" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-brand/30 blur-3xl"
      />

      <div className="container-hbc relative grid gap-10 py-16 md:grid-cols-12">
        {/* Marque */}
        <div className="md:col-span-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark-white.png" alt={settings?.brand_name} className="h-14 w-auto" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">
            Pionnier dans l&apos;accompagnement RH, HBC-RH est votre partenaire stratégique pour
            recruter, former et fidéliser vos talents.
          </p>
          <p className="mt-4 font-heading italic text-accent">« {settings?.slogan || "Libérer le potentiel humain"} »</p>
          {activeSocials.length > 0 && (
            <div className="mt-6 flex gap-3">
              {activeSocials.map(([icon, url]) => (
                <a
                  key={icon}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={icon.replace("bxl-", "")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:bg-accent hover:ring-accent"
                >
                  <i className={`bx ${icon}`} aria-hidden />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="md:col-span-3">
          <h4 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wide text-white/90">
            Navigation
          </h4>
          <ul className="space-y-2.5 text-sm">
            {nav.map((n) => (
              <li key={n.slug}>
                <Link
                  href={to(n.slug)}
                  className="inline-flex items-center gap-1.5 text-white/70 transition-all hover:text-accent"
                >
                  <i className="bx bx-chevron-right text-accent/70" aria-hidden /> {n.nav_label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="md:col-span-5">
          <h4 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wide text-white/90">
            Nous contacter
          </h4>
          <ul className="space-y-3 text-sm text-white/70">
            {settings?.address && (
              <li className="flex items-start gap-3">
                <i className="bx bx-map text-lg text-accent" aria-hidden />
                <span>
                  {settings.address}
                  {settings?.city ? `, ${settings.city}` : ""}
                </span>
              </li>
            )}
            {phones.length > 0 && (
              <li className="flex items-start gap-3">
                <i className="bx bx-phone text-lg text-accent" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  {phones.map((p) => (
                    <a key={p} href={`tel:${p.replace(/\s/g, "")}`} className="hover:text-accent">
                      {p}
                    </a>
                  ))}
                </span>
              </li>
            )}
            {settings?.email && (
              <li className="flex items-start gap-3">
                <i className="bx bx-envelope text-lg text-accent" aria-hidden />
                <a href={`mailto:${settings.email}`} className="hover:text-accent">
                  {settings.email}
                </a>
              </li>
            )}
          </ul>
          <Link
            href={to("contact")}
            className="btn-accent mt-6 inline-flex !px-5 !py-2.5 text-sm"
          >
            <i className="bx bx-calendar-check" aria-hidden /> Demander un rendez-vous
          </Link>
        </div>
      </div>

      {/* Bas de page */}
      <div className="relative border-t border-white/10">
        <div className="container-hbc flex flex-col items-center justify-between gap-3 py-5 text-center text-xs text-white/60 sm:flex-row sm:text-left">
          <span>© {year} {settings?.brand_name || "Human Brain Corporation-RH"} — Tous droits réservés.</span>
          <span className="flex items-center gap-2">
            <i className="bx bx-shield-quarter text-accent" aria-hidden />
            Recrutement · Formation · Management · Externalisation
          </span>
        </div>
      </div>
    </footer>
  );
}
