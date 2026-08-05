"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";

const T = {
  fr: {
    title: "Mon panier",
    empty: "Votre panier est vide.",
    emptyHint: "Ajoutez des formations depuis le catalogue.",
    forMe: "Pour moi",
    remove: "Retirer",
    total: "Total",
    checkout: "Passer au paiement",
    browse: "Voir les formations",
    free: "Gratuit",
  },
  en: {
    title: "My cart",
    empty: "Your cart is empty.",
    emptyHint: "Add trainings from the catalogue.",
    forMe: "For myself",
    remove: "Remove",
    total: "Total",
    checkout: "Proceed to payment",
    browse: "Browse trainings",
    free: "Free",
  },
} as const;

function fmt(n: number, free: string) {
  if (!n) return free;
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

/** Tiroir latéral du panier — monté une fois, disponible sur toutes les pages. */
export default function CartDrawer() {
  const { lines, total, isOpen, closeDrawer, removeLine } = useCart();
  const pathname = usePathname();
  const lang = pathname.startsWith("/en") ? "en" : "fr";
  const prefix = lang === "en" ? "/en" : "";
  const t = T[lang];

  return (
    <>
      {/* Voile */}
      <div
        onClick={closeDrawer}
        className={`fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isOpen}
      />
      {/* Panneau */}
      <aside
        className={`fixed right-0 top-0 z-[61] flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-hbc ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label={t.title}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-brand-deep">
            <i className="bx bx-cart text-accent" /> {t.title}
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-brand-soft hover:text-ink"
          >
            <i className="bx bx-x text-2xl" />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-4xl text-brand">
              <i className="bx bx-cart" />
            </div>
            <p className="font-medium text-ink">{t.empty}</p>
            <p className="text-sm text-muted">{t.emptyHint}</p>
            <Link
              href={`${prefix}/formations`}
              onClick={closeDrawer}
              className="btn-brand mt-2 !px-5 !py-2 text-sm"
            >
              {t.browse}
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {lines.map((l) => (
                <li key={l.id} className="flex items-start gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-sm font-semibold text-ink">{l.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      <i className="bx bx-user text-accent" />
                      {l.forMe ? t.forMe : `${l.first_name} ${l.last_name}`.trim() || l.email}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-brand">{fmt(Number(l.price), t.free)}</p>
                  </div>
                  <button
                    onClick={() => removeLine(l.id)}
                    aria-label={t.remove}
                    className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <i className="bx bx-trash text-lg" />
                  </button>
                </li>
              ))}
            </ul>

            <footer className="border-t border-line px-5 py-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm font-medium text-muted">{t.total}</span>
                <span className="font-heading text-xl font-bold text-brand-deep">
                  {fmt(total, t.free)}
                </span>
              </div>
              <Link
                href={`${prefix}/panier`}
                onClick={closeDrawer}
                className="btn-accent w-full justify-center"
              >
                {t.checkout} <i className="bx bx-right-arrow-alt" />
              </Link>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
