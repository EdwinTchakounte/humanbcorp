"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8011";

// Sous-liens du module CMS (réservé aux profils admin).
const CMS_LINKS = [
  { href: "/", label: "Pages", icon: "bx-been-here" },
  { href: "/articles", label: "Articles", icon: "bx-news" },
  { href: "/media", label: "Médiathèque", icon: "bx-images" },
  { href: "/settings", label: "Réglages", icon: "bx-cog" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, profile } = useAuth();
  const modules = profile?.modules ?? [];
  const hasCms = modules.some((m) => m.key === "cms");
  const nativeModules = modules.filter((m) => m.native && m.key !== "cms");
  const externalModules = modules.filter((m) => !m.native);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col overflow-hidden border-r border-line bg-white">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="HBC-RH" className="h-8 w-auto" />
        <span className="font-heading text-sm font-semibold text-brand-deep">Dashboard</span>
      </div>

      <nav className="flex-1 space-y-3 p-3">
        {/* Module CMS (admin) */}
        {hasCms && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Contenu du site</p>
            {CMS_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active(l.href) ? "bg-brand-soft text-brand" : "text-ink hover:bg-brand-soft/60"
                }`}
              >
                <i className={`bx ${l.icon} text-lg`} /> {l.label}
              </Link>
            ))}
          </div>
        )}

        {/* Modules natifs rapatriés (agenda…) */}
        {nativeModules.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Modules</p>
            {nativeModules.map((m) => (
              <Link
                key={m.key}
                href={m.path || "/"}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active(m.path || "") ? "bg-brand-soft text-brand" : "text-ink hover:bg-brand-soft/60"
                }`}
              >
                <i className={`bx ${m.icon} text-lg`} /> {m.label}
              </Link>
            ))}
          </div>
        )}

        {/* Modules gérés dans le Django admin (selon le profil) */}
        {externalModules.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Administration</p>
            {externalModules.map((m) => (
              <a
                key={m.key}
                href={`${API_URL}${m.admin_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-brand-soft/60"
              >
                <i className={`bx ${m.icon} text-lg`} /> {m.label}
                <i className="bx bx-link-external ml-auto text-xs text-muted" />
              </a>
            ))}
          </div>
        )}
      </nav>

      <div className="space-y-1 border-t border-line p-3">
        {profile && (
          <div className="mb-1 px-3 py-1.5 text-xs text-muted">
            <span className="block font-semibold text-brand-deep">{profile.full_name}</span>
            {profile.is_admin ? "Administrateur" : profile.groups[0] || "Utilisateur"}
          </div>
        )}
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-brand-soft/60"
        >
          <i className="bx bx-link-external text-lg" /> Voir le site
        </a>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
        >
          <i className="bx bx-log-out text-lg" /> Déconnexion
        </button>
      </div>
    </aside>
  );
}
