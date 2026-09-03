"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, listAll } from "@/lib/api";
import { TextField, TextArea, Toggle } from "@/components/ui";
import { useToast } from "@/components/Toast";
import SectionEditor from "@/components/SectionEditor";
import type { Page, Section } from "@/lib/types";

// URL publique de la vitrine : sert le lien « Voir sur le site » pour vérifier
// d'un clic que la page (et ses images) s'affichent bien côté public.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4401";

export default function PageEditor({ params }: { params: { id: string } }) {
  const toast = useToast();
  const id = params.id;
  const [page, setPage] = useState<Page | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaDirty, setMetaDirty] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [p, secs] = await Promise.all([
      api<Page>(`/cms/pages/${id}/`),
      listAll<Section>(`/cms/sections/?page_id=${id}`),
    ]);
    setPage(p);
    setSections(secs.sort((a, b) => a.order - b.order));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [id]);

  const setP = <K extends keyof Page>(k: K, v: Page[K]) => {
    setPage((p) => (p ? { ...p, [k]: v } : p));
    setMetaDirty(true);
  };

  async function saveMeta() {
    if (!page) return;
    setSavingMeta(true);
    try {
      await api(`/cms/pages/${page.id}/`, {
        method: "PATCH",
        body: {
          title: page.title, title_en: page.title_en, nav_label: page.nav_label,
          nav_label_en: page.nav_label_en,
          meta_title: page.meta_title, meta_title_en: page.meta_title_en,
          meta_description: page.meta_description, meta_description_en: page.meta_description_en,
        },
      });
      setMetaDirty(false);
    } catch (e) {
      toast.error("Échec de l'enregistrement : " + String(e instanceof Error ? e.message : e).slice(0, 200));
    } finally {
      setSavingMeta(false);
    }
  }

  // Publication : optimiste puis rétablissement si le serveur refuse ; ne marque
  // pas le bloc SEO « dirty » (is_active n'en fait pas partie).
  async function togglePublish(v: boolean) {
    if (!page) return;
    const prev = page.is_active;
    setPage((p) => (p ? { ...p, is_active: v } : p));
    try {
      await api(`/cms/pages/${page.id}/`, { method: "PATCH", body: { is_active: v } });
    } catch {
      setPage((p) => (p ? { ...p, is_active: prev } : p));
      toast.error("Impossible de changer la publication de la page.");
    }
  }

  // Présence au menu : bascule indépendante de la publication, enregistrée tout
  // de suite. Auparavant cette option était enfouie dans l'accordéon « Réglages &
  // SEO » replié par défaut : on publiait la page sans jamais voir la case, d'où
  // « page visible mais absente du menu ». Elle est désormais à côté de la
  // publication.
  async function toggleNav(v: boolean) {
    if (!page) return;
    const prev = page.show_in_nav;
    setPage((p) => (p ? { ...p, show_in_nav: v } : p));
    try {
      await api(`/cms/pages/${page.id}/`, { method: "PATCH", body: { show_in_nav: v } });
    } catch {
      setPage((p) => (p ? { ...p, show_in_nav: prev } : p));
      toast.error("Impossible de changer la présence au menu.");
    }
  }

  async function addSection() {
    const order = sections.length;
    const sec = await api<Section>("/cms/sections/", {
      method: "POST",
      body: { page: Number(id), type: "richtext", order, title: "Nouvelle section", is_active: true },
    });
    setSections((s) => [...s, { ...sec, cards: [] }]);
  }

  async function move(sid: number, dir: -1 | 1) {
    const idx = sections.findIndex((s) => s.id === sid);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sections.length) return;
    // On échange dans le tableau puis on renumérote 0..n-1. L'ancienne version
    // échangeait les valeurs `order` : dès que deux sections partageaient un même
    // `order` (possible après suppression), le bouton ne faisait rien. Renuméroter
    // par index garantit un ordre strict et persiste un état cohérent.
    const next = [...sections];
    [next[idx], next[j]] = [next[j], next[idx]];
    const renum = next.map((s, i) => ({ ...s, order: i }));
    setSections(renum);
    try {
      await Promise.all(
        renum.map((s) => api(`/cms/sections/${s.id}/`, { method: "PATCH", body: { order: s.order } }))
      );
    } catch {
      toast.error("Impossible de réordonner les sections.");
      load();
    }
  }

  if (loading) return <div className="p-8 text-muted">Chargement…</div>;
  if (!page) return <div className="p-8 text-muted">Page introuvable.</div>;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <Link href="/" className="btn-ghost">
          <i className="bx bx-arrow-back" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl">{page.title}</h1>
          <p className="text-sm text-muted">/{page.slug === "accueil" ? "" : page.slug}</p>
        </div>
        <a
          href={`${SITE_URL}${page.slug === "accueil" ? "" : `/${page.slug}`}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          title="Ouvrir la page sur le site public"
        >
          <i className="bx bx-link-external" /> Voir sur le site
        </a>
        {/* Deux bascules DISTINCTES : « Publiée » rend la page accessible sur le
            site ; « Dans le menu » l'ajoute à la barre de navigation. Une page
            peut être publiée sans figurer au menu, et inversement. */}
        <Toggle
          checked={page.is_active}
          onChange={togglePublish}
          label={page.is_active ? "Publiée" : "Brouillon"}
        />
        <Toggle
          checked={page.show_in_nav}
          onChange={toggleNav}
          label={page.show_in_nav ? "Dans le menu" : "Hors menu"}
        />
      </div>
      <p className="mb-6 text-xs text-muted">
        <strong>Publiée</strong> : la page est accessible sur le site (par son URL et son contenu).{" "}
        <strong>Dans le menu</strong> : elle apparaît en plus dans la barre de navigation.{" "}
        Les changements de contenu ou d&apos;image se reflètent sur le site en une minute environ.
      </p>

      {/* Métadonnées de la page */}
      <div className="card mb-6">
        <button
          onClick={() => setMetaOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-5 py-3 text-left font-heading font-semibold text-brand-deep"
        >
          <i className={`bx ${metaOpen ? "bx-chevron-down" : "bx-chevron-right"} text-xl`} />
          Réglages & SEO de la page
        </button>
        {metaOpen && (
          <div className="space-y-3 border-t border-line p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Titre (FR)" value={page.title} onChange={(v) => setP("title", v)} />
              <TextField label="Titre (EN)" value={page.title_en} onChange={(v) => setP("title_en", v)} />
              <TextField label="Libellé menu (FR)" value={page.nav_label} onChange={(v) => setP("nav_label", v)} />
              <TextField label="Libellé menu (EN)" value={page.nav_label_en} onChange={(v) => setP("nav_label_en", v)} />
              <TextField label="Meta title (FR)" value={page.meta_title} onChange={(v) => setP("meta_title", v)} />
              <TextField label="Meta title (EN)" value={page.meta_title_en} onChange={(v) => setP("meta_title_en", v)} />
              <TextArea label="Meta description (FR)" value={page.meta_description} onChange={(v) => setP("meta_description", v)} rows={2} />
              <TextArea label="Meta description (EN)" value={page.meta_description_en} onChange={(v) => setP("meta_description_en", v)} rows={2} />
            </div>
            <div className="flex justify-end">
              <button className="btn-brand" onClick={saveMeta} disabled={savingMeta || !metaDirty}>
                {savingMeta ? "Enregistrement…" : metaDirty ? "Enregistrer" : "Enregistré"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg">Sections</h2>
        <button className="btn-accent" onClick={addSection}>
          <i className="bx bx-plus" /> Ajouter une section
        </button>
      </div>
      <div className="space-y-3">
        {sections.map((s, i) => (
          <SectionEditor
            key={s.id}
            section={s}
            isFirst={i === 0}
            isLast={i === sections.length - 1}
            onMove={move}
            onDeleted={(sid) => setSections((ss) => ss.filter((x) => x.id !== sid))}
          />
        ))}
        {sections.length === 0 && <p className="text-muted">Aucune section. Ajoutez-en une.</p>}
      </div>
    </div>
  );
}
