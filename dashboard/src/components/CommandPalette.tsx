"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { listAll } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ThemeItem, PublicationItem } from "@/lib/types";

/**
 * Recherche rapide (⌘K / Ctrl-K).
 *
 * Le point noir de l'UX : pour atteindre une ressource profonde (éditer un quiz,
 * par ex.), il fallait ouvrir un module, chercher dans une liste paginée, puis
 * descendre l'arbre. Cette palette saute DIRECTEMENT à la bonne page — une
 * formation mène à son contenu, une session à sa fiche.
 */
type Cible = {
  id: string;
  label: string;
  sous: string;
  icone: string;
  href: string;
  cat: string;
};

export default function CommandPalette() {
  const router = useRouter();
  const { authed, profile } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [pubs, setPubs] = useState<PublicationItem[]>([]);
  const [charge, setCharge] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const peutFormations = !!profile?.modules.find((m) => m.key === "formations");
  const peutPublications = !!profile?.modules.find((m) => m.key === "publications");

  // Raccourci clavier global.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOuvert((o) => !o);
      } else if (e.key === "Escape") {
        setOuvert(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Chargement paresseux, à la première ouverture seulement.
  useEffect(() => {
    if (!ouvert || charge || !authed) return;
    setCharge(true);
    Promise.all([
      peutFormations ? listAll<ThemeItem>("/modules/themes/").catch(() => []) : Promise.resolve([]),
      peutPublications ? listAll<PublicationItem>("/modules/publications/").catch(() => []) : Promise.resolve([]),
    ]).then(([t, p]) => {
      setThemes(t);
      setPubs(p);
    });
  }, [ouvert, charge, authed, peutFormations, peutPublications]);

  // Focus + reset à l'ouverture.
  useEffect(() => {
    if (ouvert) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [ouvert]);

  const resultats = useMemo<Cible[]>(() => {
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const needle = norm(q.trim());

    const items: Cible[] = [
      ...themes.map((t) => ({
        id: `t-${t.id}`,
        label: t.title,
        sous: "Formation — ouvrir le contenu",
        icone: "bx-book",
        href: `/formations/${t.id}/contenu`,
        cat: "Formations",
      })),
      ...pubs.map((p) => ({
        id: `p-${p.id}`,
        label: p.title,
        sous: "Session vendue",
        icone: "bx-news",
        href: `/publications`,
        cat: "Sessions",
      })),
    ];
    const filtres = needle
      ? items.filter((i) => norm(i.label).includes(needle))
      : items;
    return filtres.slice(0, 20);
  }, [q, themes, pubs]);

  function aller(c: Cible) {
    setOuvert(false);
    router.push(c.href);
  }

  function onKeyList(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, resultats.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && resultats[sel]) {
      e.preventDefault();
      aller(resultats[sel]);
    }
  }

  if (!authed) return null;

  return (
    <>
      {/* Déclencheur dans le header. */}
      <button
        onClick={() => setOuvert(true)}
        className="flex items-center gap-2 rounded-lg border border-line bg-brand-soft/40 px-3 py-1.5 text-sm text-muted transition hover:border-brand/40 hover:text-brand-deep"
        title="Recherche rapide (Ctrl+K)"
      >
        <i className="bx bx-search" />
        <span className="hidden md:inline">Rechercher…</span>
        <kbd className="hidden rounded border border-line bg-white px-1.5 text-[10px] font-semibold text-muted md:inline">
          Ctrl K
        </kbd>
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-brand-deep/30 p-4 pt-[12vh]"
          onClick={() => setOuvert(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <i className="bx bx-search text-xl text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={onKeyList}
                placeholder="Rechercher une formation, une session…"
                className="w-full bg-transparent py-4 text-ink outline-none"
                aria-label="Recherche rapide"
              />
              <kbd className="rounded border border-line px-1.5 text-[10px] text-muted">Échap</kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {resultats.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  {charge && (themes.length || pubs.length)
                    ? "Aucun résultat."
                    : "Chargement…"}
                </p>
              ) : (
                resultats.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => aller(c)}
                    onMouseEnter={() => setSel(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                      i === sel ? "bg-brand-soft" : "hover:bg-brand-soft/50"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
                      <i className={`bx ${c.icone}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{c.label}</span>
                      <span className="block truncate text-xs text-muted">{c.sous}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-muted">
                      {c.cat}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
