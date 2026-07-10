"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { TextField, TextArea, Toggle } from "@/components/ui";
import MediaPicker from "@/components/MediaPicker";
import type { Article, Media } from "@/lib/types";

export default function ArticleEditor({ params }: { params: { id: string } }) {
  const [a, setA] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api<Article>(`/cms/articles/${params.id}/`).then(setA);
  }, [params.id]);

  const set = <K extends keyof Article>(k: K, v: Article[K]) => {
    setA((p) => (p ? { ...p, [k]: v } : p));
    setDirty(true);
    setSaved(false);
  };

  async function save() {
    if (!a) return;
    setSaving(true);
    try {
      await api(`/cms/articles/${a.id}/`, {
        method: "PATCH",
        body: {
          title: a.title, title_en: a.title_en, excerpt: a.excerpt, excerpt_en: a.excerpt_en,
          body: a.body, body_en: a.body_en, cover: a.cover, author: a.author,
          category: a.category, published_at: a.published_at || null, is_active: a.is_active,
        },
      });
      setDirty(false);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!a || !confirm("Supprimer cet article ?")) return;
    await api(`/cms/articles/${a.id}/`, { method: "DELETE" });
    router.push("/articles");
  }

  if (!a) return <div className="p-8 text-muted">Chargement…</div>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/articles" className="btn-ghost">
          <i className="bx bx-arrow-back" />
        </Link>
        <h1 className="flex-1 truncate text-2xl">{a.title}</h1>
        <Toggle
          checked={a.is_active}
          onChange={(v) => {
            set("is_active", v);
            api(`/cms/articles/${a.id}/`, { method: "PATCH", body: { is_active: v } });
          }}
          label={a.is_active ? "Publié" : "Brouillon"}
        />
        <button onClick={del} className="btn-danger">
          <i className="bx bx-trash" /> Supprimer
        </button>
      </div>

      <div className="card max-w-4xl space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Titre (FR)" value={a.title} onChange={(v) => set("title", v)} />
          <TextField label="Titre (EN)" value={a.title_en} onChange={(v) => set("title_en", v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Catégorie" value={a.category} onChange={(v) => set("category", v)} />
          <TextField label="Auteur" value={a.author} onChange={(v) => set("author", v)} />
          <div>
            <label className="label">Date de publication</label>
            <input
              type="date"
              className="input"
              value={a.published_at || ""}
              onChange={(e) => set("published_at", e.target.value)}
            />
          </div>
        </div>
        <MediaPicker
          label="Image de couverture"
          value={a.cover_detail}
          onSelect={(m: Media | null) => {
            set("cover", m ? m.id : null);
            set("cover_detail", m);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea label="Résumé (FR)" value={a.excerpt} onChange={(v) => set("excerpt", v)} rows={2} />
          <TextArea label="Résumé (EN)" value={a.excerpt_en} onChange={(v) => set("excerpt_en", v)} rows={2} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea label="Contenu (FR)" value={a.body} onChange={(v) => set("body", v)} rows={10} />
          <TextArea label="Contenu (EN)" value={a.body_en} onChange={(v) => set("body_en", v)} rows={10} />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
          {saved && <span className="text-sm text-green-600">Enregistré ✓</span>}
          <button className="btn-brand" onClick={save} disabled={saving || !dirty}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
