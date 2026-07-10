"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import { Toggle, Pagination, PAGE_SIZE } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { ThemeItem, FormationsOverview } from "@/lib/types";

export default function FormationsPage() {
  const { canWrite } = useAuth();
  const writable = canWrite("formations");
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [overview, setOverview] = useState<FormationsOverview | null>(null);
  const [session, setSession] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  async function loadThemes(sess: string) {
    const path = sess ? `/modules/themes/?session=${sess}` : "/modules/themes/";
    setThemes(await listAll<ThemeItem>(path));
  }

  useEffect(() => {
    Promise.all([
      listAll<ThemeItem>("/modules/themes/"),
      api<FormationsOverview>("/modules/formations/overview/"),
    ])
      .then(([t, o]) => {
        setThemes(t);
        setOverview(o);
      })
      .finally(() => setLoading(false));
  }, []);

  async function onFilter(sess: string) {
    setSession(sess);
    setPage(1);
    setLoading(true);
    await loadThemes(sess);
    setLoading(false);
  }

  const pagedThemes = themes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function toggle(t: ThemeItem) {
    await api(`/modules/themes/${t.id}/`, { method: "PATCH", body: { is_visible: !t.is_visible } });
    setThemes((xs) => xs.map((x) => (x.id === t.id ? { ...x, is_visible: !x.is_visible } : x)));
  }

  const tiles = overview
    ? [
        { label: "Formations", value: overview.counts.themes, icon: "bx-book" },
        { label: "Sessions", value: overview.counts.sessions, icon: "bx-calendar" },
        { label: "Séquences", value: overview.counts.sequences, icon: "bx-list-ol" },
        { label: "Catégories", value: overview.counts.categories, icon: "bx-category" },
      ]
    : [];

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl">Formations</h1>
        <p className="text-sm text-muted">Catalogue des thèmes de formation (Cours & Examens).</p>
      </header>

      {/* Stat tiles */}
      {overview && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {tiles.map((s) => (
            <div key={s.label} className="card flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand">
                <i className={`bx ${s.icon}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-brand-deep">{s.value}</div>
                <div className="text-xs text-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtre par session */}
      {overview && overview.sessions.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm text-muted">Session :</label>
          <select className="input max-w-[200px]" value={session} onChange={(e) => onFilter(e.target.value)}>
            <option value="">Toutes</option>
            {overview.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.year}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : themes.length === 0 ? (
        <p className="text-muted">Aucune formation.</p>
      ) : (
        <>
        <div className="card divide-y divide-line">
          {pagedThemes.map((t) => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3.5">
              {t.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.image_url} alt="" className="h-12 w-16 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <i className="bx bx-book-open text-xl" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-brand-deep">{t.title}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      t.t_type === 2 ? "bg-accent/10 text-accent" : "bg-brand-soft text-brand"
                    }`}
                  >
                    {t.t_type_label}
                  </span>
                  {t.categorie_name && <span><i className="bx bx-category" /> {t.categorie_name}</span>}
                  {t.session_year && <span><i className="bx bx-calendar" /> {t.session_year}</span>}
                  <span><i className="bx bx-play-circle" /> {t.seances_count} séance(s)</span>
                  {t.classes_names.length > 0 && <span><i className="bx bx-group" /> {t.classes_names.join(", ")}</span>}
                </div>
              </div>
              {writable ? (
                <Toggle checked={t.is_visible} onChange={() => toggle(t)} label={t.is_visible ? "Visible" : "Masqué"} />
              ) : (
                <span className="text-xs text-muted">{t.is_visible ? "Visible" : "Masqué"}</span>
              )}
            </div>
          ))}
        </div>
        <Pagination page={page} total={themes.length} onPage={setPage} />
        </>
      )}
    </div>
  );
}
