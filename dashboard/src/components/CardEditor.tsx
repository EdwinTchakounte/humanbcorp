"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Toggle, TextField, TextArea } from "@/components/ui";
import MediaPicker from "@/components/MediaPicker";
import type { Card, Media } from "@/lib/types";

export default function CardEditor({
  card,
  onDeleted,
}: {
  card: Card;
  onDeleted: (id: number) => void;
}) {
  const [c, setC] = useState<Card>(card);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof Card>(k: K, v: Card[K]) => {
    setC((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };
  const setExtra = (k: string, v: string) => {
    setC((prev) => ({ ...prev, extra: { ...prev.extra, [k]: v } }));
    setDirty(true);
  };

  async function save() {
    setSaving(true);
    try {
      const payload = {
        title: c.title, title_en: c.title_en, text: c.text, text_en: c.text_en,
        icon: c.icon, image: c.image, link: c.link, link_label: c.link_label,
        link_label_en: c.link_label_en, extra: c.extra, is_active: c.is_active,
      };
      await api(`/cms/cards/${c.id}/`, { method: "PATCH", body: payload });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(v: boolean) {
    set("is_active", v);
    await api(`/cms/cards/${c.id}/`, { method: "PATCH", body: { is_active: v } });
  }

  async function del() {
    if (!confirm("Supprimer cet élément ?")) return;
    await api(`/cms/cards/${c.id}/`, { method: "DELETE" });
    onDeleted(c.id);
  }

  return (
    <div className="rounded-lg border border-line bg-white">
      <div className="flex items-center gap-3 px-3 py-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-muted">
          <i className={`bx ${open ? "bx-chevron-down" : "bx-chevron-right"} text-xl`} />
        </button>
        {c.image_detail?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image_detail.url} alt="" className="h-8 w-8 rounded object-cover" />
        ) : c.icon ? (
          <i className={`bx ${c.icon} text-xl text-brand`} />
        ) : (
          <span className="text-xs text-muted">·</span>
        )}
        <span className="flex-1 truncate text-sm">{c.title || c.text || "(sans titre)"}</span>
        {c.extra?.value ? <span className="text-xs font-bold text-accent">{String(c.extra.value)}</span> : null}
        <Toggle checked={c.is_active} onChange={toggleActive} />
        <button type="button" onClick={del} className="text-red-500 hover:text-red-700">
          <i className="bx bx-trash" />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-line p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Titre (FR)" value={c.title} onChange={(v) => set("title", v)} />
            <TextField label="Titre (EN)" value={c.title_en} onChange={(v) => set("title_en", v)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextArea label="Texte (FR)" value={c.text} onChange={(v) => set("text", v)} rows={2} />
            <TextArea label="Texte (EN)" value={c.text_en} onChange={(v) => set("text_en", v)} rows={2} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Icône (Boxicon)" value={c.icon} onChange={(v) => set("icon", v)} placeholder="bx-globe" />
            <TextField label="Valeur (chiffre-clé)" value={String(c.extra?.value ?? "")} onChange={(v) => setExtra("value", v)} />
            <TextField label="Lien" value={c.link} onChange={(v) => set("link", v)} />
          </div>
          <MediaPicker
            label="Image"
            value={c.image_detail}
            onSelect={(m: Media | null) => {
              set("image", m ? m.id : null);
              set("image_detail", m);
            }}
          />
          <div className="flex justify-end">
            <button type="button" className="btn-brand" onClick={save} disabled={saving || !dirty}>
              {saving ? "Enregistrement…" : dirty ? "Enregistrer" : "Enregistré"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
