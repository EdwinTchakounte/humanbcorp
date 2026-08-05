"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import CommandPalette from "@/components/CommandPalette";
import { ToastProvider } from "@/components/Toast";
import { useAuth } from "@/lib/auth";

// Sous-routes rattachées au module « cms » (une seule entrée `modules` côté API,
// mais plusieurs écrans dans le dashboard).
const CMS_SUBROUTES = ["/", "/articles", "/media", "/settings", "/pages"];

// Ensemble des préfixes de routes réellement autorisés pour un profil, dérivé de
// ses modules (`profile.modules`). Sert de garde unique : toute route hors de cet
// ensemble (deep-link vers un module non attribué) renvoie vers le premier module.
function allowedPrefixes(modules: { key: string; path?: string }[]): string[] {
  const set = new Set<string>();
  for (const m of modules) {
    if (m.key === "cms") CMS_SUBROUTES.forEach((r) => set.add(r));
    else if (m.path) set.add(m.path);
  }
  return Array.from(set);
}
const matchesPrefix = (path: string, prefix: string) =>
  prefix === "/" ? path === "/" : path === prefix || path.startsWith(prefix + "/");
const isAllowedRoute = (path: string, prefixes: string[]) =>
  prefixes.some((p) => matchesPrefix(path, p));

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready, authed, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  // Referme le tiroir mobile à chaque changement de page.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    if (!authed) {
      router.replace("/login");
      return;
    }
    if (profile && !isAllowedRoute(pathname, allowedPrefixes(profile.modules))) {
      const firstNative = profile.modules.find((m) => m.native && m.path);
      router.replace(firstNative?.path || "/agenda");
    }
  }, [ready, authed, profile, pathname, router]);

  if (!ready || !authed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <i className="bx bx-loader-alt animate-spin text-2xl" />
      </div>
    );
  }

  return (
    <ToastProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar : statique en desktop, tiroir coulissant en mobile */}
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      {/* Colonne principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header fixe */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-white px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setNavOpen(true)}
              aria-label="Ouvrir le menu"
              className="-ml-1 rounded-lg p-2 text-ink hover:bg-brand-soft/60 lg:hidden"
            >
              <i className="bx bx-menu text-2xl" />
            </button>
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CommandPalette />
            <span className="hidden text-muted sm:inline">{profile?.full_name}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                profile?.is_admin ? "bg-accent/10 text-accent" : "bg-brand-soft text-brand"
              }`}
            >
              {profile?.is_admin ? "Administrateur" : profile?.is_teacher ? "Formateur" : "Apprenant"}
            </span>
          </div>
        </header>

        {/* Contenu scrollable (seule zone qui défile) */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
    </ToastProvider>
  );
}
