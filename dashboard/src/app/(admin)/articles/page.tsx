"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, listAll } from "@/lib/api";
import { Toggle } from "@/components/ui";
import type { Article } from "@/lib/types";

export default function ArticlesList() {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function load() {
    setLoading(true);
    setItems(await listAll<Article>("/cms/articles/"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    try {
      const a = await api<Article>("/cms/articles/", {
        method: "POST",
        body: { title: "Nouvel article", excerpt: "", is_active: false },
      });
      router.push(`/articles/${a.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function toggle(a: Article) {
    await api(`/cms/articles/${a.id}/`, { method: "PATCH", body: { is_active: !a.is_active } });
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, is_active: !x.is_active } : x)));
  }

  async function del(a: Article) {
    if (!confirm(`Supprimer « ${a.title} » ?`)) return;
    await api(`/cms/articles/${a.id}/`, { method: "DELETE" });
    setItems((xs) => xs.filter((x) => x.id !== a.id));
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Articles du blog</h1>
          <p className="text-sm text-muted">{items.length} article(s)</p>
        </div>
        <button onClick={create} disabled={creating} className="btn-accent">
          <i className="bx bx-plus" /> {creating ? "Création…" : "Nouvel article"}
        </button>
      </header>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-muted">Aucun article. Créez-en un.</p>
      ) : (
        <div className="card divide-y divide-line">
          {items.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-4">
              {a.cover_detail?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.cover_detail.url} alt="" className="h-12 w-16 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-brand-soft text-muted">
                  <i className="bx bx-image" />
                </div>
              )}
              <div className="flex-1">
                <Link href={`/articles/${a.id}`} className="font-heading font-semibold text-brand-deep hover:text-brand">
                  {a.title}
                </Link>
                <div className="text-xs text-muted">
                  {a.category || "—"} · {a.published_at || "sans date"}
                </div>
              </div>
              <Toggle checked={a.is_active} onChange={() => toggle(a)} label={a.is_active ? "Publié" : "Brouillon"} />
              <Link href={`/articles/${a.id}`} className="btn-ghost">
                <i className="bx bx-edit" /> Éditer
              </Link>
              <button onClick={() => del(a)} className="btn-danger">
                <i className="bx bx-trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
