"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Toggle, TextField, TextArea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import MediaPicker from "@/components/MediaPicker";
import CardEditor from "@/components/CardEditor";
import { SECTION_TYPES, type Card, type Media, type Section } from "@/lib/types";

export default function SectionEditor({
  section,
  onDeleted,
  onMove,
  isFirst,
  isLast,
}: {
  section: Section;
  onDeleted: (id: number) => void;
  onMove: (id: number, dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const toast = useToast();
  const [s, setS] = useState<Section>(section);
  const [cards, setCards] = useState<Card[]>(section.cards || []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof Section>(k: K, v: Section[K]) => {
    setS((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  async function save() {
    setSaving(true);
    try {
      await api(`/cms/sections/${s.id}/`, {
        method: "PATCH",
        body: {
          type: s.type, anchor: s.anchor, eyebrow: s.eyebrow, eyebrow_en: s.eyebrow_en,
          title: s.title, title_en: s.title_en, subtitle: s.subtitle, subtitle_en: s.subtitle_en,
          body: s.body, body_en: s.body_en, bg_color: s.bg_color, bg_image: s.bg_image,
          parallax: s.parallax, wave: s.wave,
        },
      });
      setDirty(false);
    } catch (e) {
      toast.error("Échec de l'enregistrement de la section : " + String(e instanceof Error ? e.message : e).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }

  // Visibilité : optimiste puis rétablissement si le serveur refuse. On met à jour
  // is_active directement (sans set() qui marquerait la section « dirty » à tort).
  async function toggleActive(v: boolean) {
    const prev = s.is_active;
    setS((p) => ({ ...p, is_active: v }));
    try {
      await api(`/cms/sections/${s.id}/`, { method: "PATCH", body: { is_active: v } });
    } catch {
      setS((p) => ({ ...p, is_active: prev }));
      toast.error("Impossible de changer la visibilité de la section.");
    }
  }

  async function del() {
    if (!confirm("Supprimer cette section et tout son contenu ?")) return;
    await api(`/cms/sections/${s.id}/`, { method: "DELETE" });
    onDeleted(s.id);
  }

  async function addCard() {
    const order = cards.length;
    const card = await api<Card>("/cms/cards/", {
      method: "POST",
      body: { section: s.id, order, title: "Nouvel élément", is_active: true },
    });
    setCards((c) => [...c, card]);
    setOpen(true);
  }

  const typeLabel = SECTION_TYPES.find((t) => t.value === s.type)?.label || s.type;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 bg-brand-soft/40 px-4 py-3">
        <div className="flex flex-col text-muted">
          <button disabled={isFirst} onClick={() => onMove(s.id, -1)} className="disabled:opacity-30">
            <i className="bx bx-chevron-up" />
          </button>
          <button disabled={isLast} onClick={() => onMove(s.id, 1)} className="disabled:opacity-30">
            <i className="bx bx-chevron-down" />
          </button>
        </div>
        <span className="rounded-md bg-brand px-2 py-0.5 text-xs font-semibold text-white">{typeLabel}</span>
        <button onClick={() => setOpen((o) => !o)} className="flex-1 text-left">
          <span className="font-heading font-semibold text-brand-deep">{s.title || s.eyebrow || "(section)"}</span>
          <span className="ml-2 text-xs text-muted">{cards.length} élément(s)</span>
        </button>
        <Toggle checked={s.is_active} onChange={toggleActive} label={s.is_active ? "Visible" : "Masquée"} />
        <button onClick={del} className="text-red-500 hover:text-red-700">
          <i className="bx bx-trash" />
        </button>
        <button onClick={() => setOpen((o) => !o)} className="text-muted">
          <i className={`bx ${open ? "bx-chevron-down" : "bx-chevron-right"} text-xl`} />
        </button>
      </div>

      {open && (
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Type</label>
              <select className="input" value={s.type} onChange={(e) => set("type", e.target.value as Section["type"])}>
                {SECTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <TextField label="Ancre (#)" value={s.anchor} onChange={(v) => set("anchor", v)} placeholder="services" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Sur-titre (FR)" value={s.eyebrow} onChange={(v) => set("eyebrow", v)} />
            <TextField label="Sur-titre (EN)" value={s.eyebrow_en} onChange={(v) => set("eyebrow_en", v)} />
            <TextField label="Titre (FR)" value={s.title} onChange={(v) => set("title", v)} />
            <TextField label="Titre (EN)" value={s.title_en} onChange={(v) => set("title_en", v)} />
            <TextArea label="Sous-titre (FR)" value={s.subtitle} onChange={(v) => set("subtitle", v)} rows={2} />
            <TextArea label="Sous-titre (EN)" value={s.subtitle_en} onChange={(v) => set("subtitle_en", v)} rows={2} />
            <TextArea label="Texte (FR)" value={s.body} onChange={(v) => set("body", v)} rows={3} />
            <TextArea label="Texte (EN)" value={s.body_en} onChange={(v) => set("body_en", v)} rows={3} />
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-3">
            <MediaPicker
              label="Image de fond / visuel"
              value={s.bg_image_detail}
              onSelect={(m: Media | null) => {
                set("bg_image", m ? m.id : null);
                set("bg_image_detail", m);
              }}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.parallax} onChange={(e) => set("parallax", e.target.checked)} /> Parallaxe
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.wave} onChange={(e) => set("wave", e.target.checked)} /> Vague en bas
            </label>
          </div>

          <div className="flex justify-end">
            <button className="btn-brand" onClick={save} disabled={saving || !dirty}>
              {saving ? "Enregistrement…" : dirty ? "Enregistrer la section" : "Enregistré"}
            </button>
          </div>

          <div className="border-t border-line pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Éléments / cartes</h4>
              <button className="btn-ghost" onClick={addCard}>
                <i className="bx bx-plus" /> Ajouter un élément
              </button>
            </div>
            <div className="space-y-2">
              {cards.map((c) => (
                <CardEditor key={c.id} card={c} onDeleted={(id) => setCards((cs) => cs.filter((x) => x.id !== id))} />
              ))}
              {cards.length === 0 && <p className="text-sm text-muted">Aucun élément.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
