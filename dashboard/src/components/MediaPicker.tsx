"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import type { Media } from "@/lib/types";

export default function MediaPicker({
  value,
  onSelect,
  label = "Image",
}: {
  value: Media | null;
  onSelect: (m: Media | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Media[]>([]);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    setItems(await listAll<Media>("/cms/media/"));
  }
  useEffect(() => {
    if (open) load();
  }, [open]);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    fd.append("title", file.name.replace(/\.[^.]+$/, ""));
    fd.append("alt", file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    try {
      const m = await api<Media>("/cms/media/", { method: "POST", body: fd, isForm: true });
      setItems((it) => [m, ...it]);
      onSelect(m);
      setOpen(false);
    } finally {
      setUploading(false);
    }
  }

  const filtered = q
    ? items.filter((m) => `${m.title} ${m.tags} ${m.alt}`.toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-line bg-brand-soft/40">
          {value?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <i className="bx bx-image text-2xl text-muted" />
          )}
        </div>
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
          Choisir…
        </button>
        {value && (
          <button type="button" className="btn-danger" onClick={() => onSelect(null)}>
            Retirer
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="card flex max-h-[85vh] w-full max-w-3xl flex-col p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <h3 className="flex-1 text-lg">Médiathèque</h3>
              <input className="input max-w-xs" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
              <label className="btn-brand cursor-pointer">
                {uploading ? "Envoi…" : "Importer"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
              </label>
              <button className="btn-ghost" onClick={() => setOpen(false)}>
                Fermer
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    setOpen(false);
                  }}
                  className={`overflow-hidden rounded-lg border-2 transition ${
                    value?.id === m.id ? "border-brand" : "border-transparent hover:border-line"
                  }`}
                >
                  {m.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.alt} className="aspect-square w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
