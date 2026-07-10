"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import { Toggle, Pagination, PAGE_SIZE } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { PublicationItem, PublicationsOverview } from "@/lib/types";

function fmtPrice(p: string) {
  const n = Number(p);
  if (!n) return "Gratuit";
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

export default function PublicationsPage() {
  const { canWrite } = useAuth();
  const writable = canWrite("publications");
  const [items, setItems] = useState<PublicationItem[]>([]);
  const [overview, setOverview] = useState<PublicationsOverview | null>(null);
  const [categorie, setCategorie] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  async function load(cat: string) {
    const path = cat ? `/modules/publications/?categorie=${cat}` : "/modules/publications/";
    setItems(await listAll<PublicationItem>(path));
  }

  useEffect(() => {
    Promise.all([
      listAll<PublicationItem>("/modules/publications/"),
      api<PublicationsOverview>("/modules/publications/overview/"),
    ])
      .then(([p, o]) => {
        setItems(p);
        setOverview(o);
      })
      .finally(() => setLoading(false));
  }, []);

  async function onFilter(cat: string) {
    setCategorie(cat);
    setPage(1);
    setLoading(true);
    await load(cat);
    setLoading(false);
  }

  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function togglePrivacy(p: PublicationItem) {
    await api(`/modules/publications/${p.id}/`, { method: "PATCH", body: { is_private: !p.is_private } });
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, is_private: !x.is_private } : x)));
  }

  const tiles = overview
    ? [
        { label: "Publications", value: overview.counts.publications, icon: "bx-news" },
        { label: "Publiques", value: overview.counts.public, icon: "bx-globe" },
        { label: "Catégories", value: overview.counts.categories, icon: "bx-category" },
        { label: "Tags", value: overview.counts.tags, icon: "bx-purchase-tag" },
      ]
    : [];

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl">Publications</h1>
        <p className="text-sm text-muted">Contenus et publications (privé / public).</p>
      </header>

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

      {overview && overview.categories.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm text-muted">Catégorie :</label>
          <select className="input max-w-[240px]" value={categorie} onChange={(e) => onFilter(e.target.value)}>
            <option value="">Toutes</option>
            {overview.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-muted">Aucune publication.</p>
      ) : (
        <>
        <div className="card divide-y divide-line">
          {pagedItems.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="h-12 w-16 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <i className="bx bx-file text-xl" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-brand-deep">{p.title}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  {p.categorie_name && <span><i className="bx bx-category" /> {p.categorie_name}</span>}
                  <span><i className="bx bx-money" /> {fmtPrice(p.price)}</span>
                  {p.children_count > 0 && <span><i className="bx bx-sitemap" /> {p.children_count} sous-publi.</span>}
                  {p.tags_names.length > 0 && <span><i className="bx bx-purchase-tag" /> {p.tags_names.join(", ")}</span>}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  p.is_private ? "bg-gray-100 text-gray-500" : "bg-green-50 text-green-700"
                }`}
              >
                {p.is_private ? "Privé" : "Public"}
              </span>
              {writable && (
                <Toggle
                  checked={!p.is_private}
                  onChange={() => togglePrivacy(p)}
                  label={p.is_private ? "Rendre public" : "Rendre privé"}
                />
              )}
            </div>
          ))}
        </div>
        <Pagination page={page} total={items.length} onPage={setPage} />
        </>
      )}
    </div>
  );
}
