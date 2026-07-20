"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import CommandPalette from "@/components/CommandPalette";
import { ToastProvider } from "@/components/Toast";
import { useAuth } from "@/lib/auth";

// Routes réservées aux profils admin (module CMS + module RH, tous deux admin-only).
// Un non-admin qui y arrive en direct est renvoyé vers son premier module.
const CMS_PREFIXES = ["/", "/articles", "/media", "/settings", "/pages", "/rh"];
const isCmsRoute = (path: string) =>
  CMS_PREFIXES.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready, authed, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!authed) {
      router.replace("/login");
      return;
    }
    const hasCms = profile?.modules.some((m) => m.key === "cms");
    if (profile && !hasCms && isCmsRoute(pathname)) {
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
      {/* Sidebar fixe, non scrollable */}
      <Sidebar />

      {/* Colonne principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header fixe */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-white px-8">
          <Breadcrumbs />
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
