"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, listAll } from "@/lib/api";
import { Toggle, Loading, ErrorState, EmptyState, PageHeader, Modal, TextField } from "@/components/ui";
import { useToast } from "@/components/Toast";
import type { Page } from "@/lib/types";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function PagesList() {
  const toast = useToast();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function load() {
    setLoading(true);
    setErr(false);
    try {
      setPages(await listAll<Page>("/cms/pages/"));
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(p: Page) {
    // Optimiste : on bascule tout de suite, puis on rétablit si le serveur refuse.
    const next = !p.is_active;
    setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, is_active: next } : x)));
    try {
      await api(`/cms/pages/${p.id}/`, { method: "PATCH", body: { is_active: next } });
    } catch {
      setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, is_active: !next } : x)));
      toast.error("Impossible de changer la visibilité de la page.");
    }
  }

  async function submitNew() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const p = await api<Page>("/cms/pages/", {
        method: "POST",
        body: { title, slug: slugify(title) || `page-${pages.length + 1}`, order: pages.length, is_active: false },
      });
      router.push(`/pages/${p.id}`);
    } catch {
      toast.error("Impossible de créer la page.");
      setCreating(false);
    }
  }

  function openCreate() {
    setNewTitle("");
    setNewOpen(true);
  }

  async function del(p: Page) {
    if (!confirm(`Supprimer la page « ${p.title} » et tout son contenu ?`)) return;
    try {
      await api(`/cms/pages/${p.id}/`, { method: "DELETE" });
      setPages((ps) => ps.filter((x) => x.id !== p.id));
    } catch {
      toast.error("Impossible de supprimer la page.");
    }
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Pages du site"
        subtitle="Gère le contenu, l'ordre et la visibilité de chaque page."
        actions={
          <button onClick={openCreate} className="btn-accent">
            <i className="bx bx-plus" /> Nouvelle page
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : err ? (
        <ErrorState message="Impossible de charger les pages." onRetry={load} />
      ) : pages.length === 0 ? (
        <EmptyState
          icon="bx-file"
          title="Aucune page"
          hint="Créez votre première page pour commencer à structurer le site."
          action={
            <button onClick={openCreate} className="btn-accent">
              <i className="bx bx-plus" /> Nouvelle page
            </button>
          }
        />
      ) : (
        <div className="card divide-y divide-line">
          {pages.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:gap-4 sm:px-5">
              <span className="w-6 shrink-0 text-center text-sm text-muted sm:w-8">{p.order}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/pages/${p.id}`} className="font-heading font-semibold text-brand-deep hover:text-brand">
                  {p.title}
                </Link>
                <div className="text-xs text-muted">/{p.slug === "accueil" ? "" : p.slug}</div>
              </div>
              <span className="hidden text-xs text-muted sm:block">
                {p.show_in_nav ? "Dans le menu" : "Hors menu"}
              </span>
              {/* Actions : inline en desktop, repliées sur une 2e ligne alignée à droite en mobile. */}
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <Toggle checked={p.is_active} onChange={() => toggle(p)} label={p.is_active ? "Visible" : "Masquée"} />
                <Link href={`/pages/${p.id}`} className="btn-ghost">
                  <i className="bx bx-edit" /> Éditer
                </Link>
                <button onClick={() => del(p)} className="btn-danger" title="Supprimer" aria-label={`Supprimer la page ${p.title}`}>
                  <i className="bx bx-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={newOpen}
        title="Nouvelle page"
        onClose={() => setNewOpen(false)}
        footer={
          <>
            <button onClick={() => setNewOpen(false)} className="btn-ghost">Annuler</button>
            <button onClick={submitNew} disabled={creating || !newTitle.trim()} className="btn-accent">
              {creating ? "Création…" : "Créer"}
            </button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); submitNew(); }}>
          <TextField label="Titre de la page" value={newTitle} onChange={setNewTitle} placeholder="Ex. À propos" />
        </form>
      </Modal>
    </div>
  );
}
