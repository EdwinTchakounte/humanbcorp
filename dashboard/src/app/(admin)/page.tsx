"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, listAll } from "@/lib/api";
import { Toggle } from "@/components/ui";
import type { Page } from "@/lib/types";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function PagesList() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function load() {
    setLoading(true);
    setPages(await listAll<Page>("/cms/pages/"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(p: Page) {
    await api(`/cms/pages/${p.id}/`, { method: "PATCH", body: { is_active: !p.is_active } });
    setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
  }

  async function create() {
    const title = prompt("Titre de la nouvelle page ?");
    if (!title) return;
    const p = await api<Page>("/cms/pages/", {
      method: "POST",
      body: { title, slug: slugify(title) || `page-${pages.length + 1}`, order: pages.length, is_active: false },
    });
    router.push(`/pages/${p.id}`);
  }

  async function del(p: Page) {
    if (!confirm(`Supprimer la page « ${p.title} » et tout son contenu ?`)) return;
    await api(`/cms/pages/${p.id}/`, { method: "DELETE" });
    setPages((ps) => ps.filter((x) => x.id !== p.id));
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Pages du site</h1>
          <p className="text-sm text-muted">Gère le contenu, l&apos;ordre et la visibilité de chaque page.</p>
        </div>
        <button onClick={create} className="btn-accent">
          <i className="bx bx-plus" /> Nouvelle page
        </button>
      </header>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : (
        <div className="card divide-y divide-line">
          {pages.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4">
              <span className="w-8 text-center text-sm text-muted">{p.order}</span>
              <div className="flex-1">
                <Link href={`/pages/${p.id}`} className="font-heading font-semibold text-brand-deep hover:text-brand">
                  {p.title}
                </Link>
                <div className="text-xs text-muted">/{p.slug === "accueil" ? "" : p.slug}</div>
              </div>
              <span className="hidden text-xs text-muted sm:block">
                {p.show_in_nav ? "Dans le menu" : "Hors menu"}
              </span>
              <Toggle checked={p.is_active} onChange={() => toggle(p)} label={p.is_active ? "Visible" : "Masquée"} />
              <Link href={`/pages/${p.id}`} className="btn-ghost">
                <i className="bx bx-edit" /> Éditer
              </Link>
              <button onClick={() => del(p)} className="btn-danger" title="Supprimer">
                <i className="bx bx-trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
