"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, listAll } from "@/lib/api";
import { Toggle, Loading, ErrorState, EmptyState, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/lib/format";
import type { Article } from "@/lib/types";

export default function ArticlesList() {
  const toast = useToast();
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function load() {
    setLoading(true);
    setErr(false);
    try {
      setItems(await listAll<Article>("/cms/articles/"));
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
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
    const next = !a.is_active;
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, is_active: next } : x)));
    try {
      await api(`/cms/articles/${a.id}/`, { method: "PATCH", body: { is_active: next } });
    } catch {
      setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, is_active: !next } : x)));
      toast.error("Impossible de changer la publication de l'article.");
    }
  }

  async function del(a: Article) {
    if (!confirm(`Supprimer « ${a.title} » ?`)) return;
    await api(`/cms/articles/${a.id}/`, { method: "DELETE" });
    setItems((xs) => xs.filter((x) => x.id !== a.id));
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Articles du blog"
        subtitle={`${items.length} article(s)`}
        actions={
          <button onClick={create} disabled={creating} className="btn-accent">
            <i className="bx bx-plus" /> {creating ? "Création…" : "Nouvel article"}
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : err ? (
        <ErrorState message="Impossible de charger les articles." onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bx-news"
          title="Aucun article"
          hint="Publiez votre premier article pour alimenter le blog."
          action={
            <button onClick={create} disabled={creating} className="btn-accent">
              <i className="bx bx-plus" /> Nouvel article
            </button>
          }
        />
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
                  {a.category || "—"} · {a.published_at ? formatDate(a.published_at) : "sans date"}
                </div>
              </div>
              <Toggle checked={a.is_active} onChange={() => toggle(a)} label={a.is_active ? "Publié" : "Brouillon"} />
              <Link href={`/articles/${a.id}`} className="btn-ghost">
                <i className="bx bx-edit" /> Éditer
              </Link>
              <button onClick={() => del(a)} className="btn-danger" title="Supprimer" aria-label={`Supprimer l'article ${a.title}`}>
                <i className="bx bx-trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
