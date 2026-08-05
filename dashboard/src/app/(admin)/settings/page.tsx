"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TextField, TextArea } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface Settings {
  brand_name: string;
  slogan: string;
  slogan_en: string;
  tagline: string;
  tagline_en: string;
  address: string;
  phones: string;
  email: string;
  city: string;
  whatsapp: string;
  facebook: string;
  linkedin: string;
  instagram: string;
  twitter: string;
  default_meta_title: string;
  default_meta_description: string;
}

export default function SettingsPage() {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<Settings>("/cms/settings/").then(setS);
  }, []);

  const set = (k: keyof Settings, v: string) => {
    setS((p) => (p ? { ...p, [k]: v } : p));
    setDirty(true);
    setSaved(false);
  };

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      await api("/cms/settings/1/", { method: "PATCH", body: s });
      setDirty(false);
      setSaved(true);
      toast.success("Réglages enregistrés.");
    } catch (e) {
      toast.error("Échec de l'enregistrement : " + String(e instanceof Error ? e.message : e).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }

  if (!s) return <div className="p-8 text-muted">Chargement…</div>;

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl">Réglages du site</h1>
      <div className="card max-w-3xl space-y-5 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nom de la marque" value={s.brand_name} onChange={(v) => set("brand_name", v)} />
          <div />
          <TextField label="Slogan (FR)" value={s.slogan} onChange={(v) => set("slogan", v)} />
          <TextField label="Slogan (EN)" value={s.slogan_en} onChange={(v) => set("slogan_en", v)} />
          <TextField label="Accroche (FR)" value={s.tagline} onChange={(v) => set("tagline", v)} />
          <TextField label="Accroche (EN)" value={s.tagline_en} onChange={(v) => set("tagline_en", v)} />
        </div>

        <h3 className="border-t border-line pt-4 text-sm font-semibold uppercase tracking-wide text-muted">Coordonnées</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Adresse" value={s.address} onChange={(v) => set("address", v)} />
          <TextField label="Ville" value={s.city} onChange={(v) => set("city", v)} />
          <TextField label="Téléphones (séparés par virgule)" value={s.phones} onChange={(v) => set("phones", v)} />
          <TextField label="Email" value={s.email} onChange={(v) => set("email", v)} />
          <TextField label="WhatsApp (n° international)" value={s.whatsapp} onChange={(v) => set("whatsapp", v)} />
        </div>

        <h3 className="border-t border-line pt-4 text-sm font-semibold uppercase tracking-wide text-muted">Réseaux sociaux</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Facebook" value={s.facebook} onChange={(v) => set("facebook", v)} />
          <TextField label="LinkedIn" value={s.linkedin} onChange={(v) => set("linkedin", v)} />
          <TextField label="Instagram" value={s.instagram} onChange={(v) => set("instagram", v)} />
          <TextField label="Twitter / X" value={s.twitter} onChange={(v) => set("twitter", v)} />
        </div>

        <h3 className="border-t border-line pt-4 text-sm font-semibold uppercase tracking-wide text-muted">SEO par défaut</h3>
        <TextField label="Meta title par défaut" value={s.default_meta_title} onChange={(v) => set("default_meta_title", v)} />
        <TextArea label="Meta description par défaut" value={s.default_meta_description} onChange={(v) => set("default_meta_description", v)} rows={2} />

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
