"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import type { Media } from "@/lib/types";

export default function MediaLibrary() {
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    setItems(await listAll<Media>("/cms/media/"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function upload(files: FileList) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("title", file.name.replace(/\.[^.]+$/, ""));
        fd.append("alt", file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
        const m = await api<Media>("/cms/media/", { method: "POST", body: fd, isForm: true });
        setItems((it) => [m, ...it]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function del(m: Media) {
    if (!confirm("Supprimer cette image ?")) return;
    await api(`/cms/media/${m.id}/`, { method: "DELETE" });
    setItems((it) => it.filter((x) => x.id !== m.id));
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Médiathèque</h1>
          <p className="text-sm text-muted">{items.length} image(s)</p>
        </div>
        <label className="btn-brand cursor-pointer">
          {uploading ? "Envoi…" : "Importer des images"}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
        </label>
      </header>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => (
            <div key={m.id} className="card group relative overflow-hidden">
              {m.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.alt} className="aspect-square w-full object-cover" />
              )}
              <div className="truncate px-2 py-1.5 text-xs text-muted">{m.title}</div>
              <button
                onClick={() => del(m)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 opacity-0 shadow transition group-hover:opacity-100"
              >
                <i className="bx bx-trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
