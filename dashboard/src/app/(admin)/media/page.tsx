"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import { Loading, ErrorState, EmptyState, PageHeader } from "@/components/ui";
import type { Media } from "@/lib/types";

export default function MediaLibrary() {
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    setErr(false);
    try {
      setItems(await listAll<Media>("/cms/media/"));
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
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
    const total = (m.usages ?? []).reduce((s, u) => s + u.count, 0);
    const msg =
      total > 0
        ? `Cette image est utilisée à ${total} endroit(s) : ` +
          (m.usages ?? []).map((u) => `${u.label} (${u.count})`).join(", ") +
          ". La supprimer videra ces emplacements. Continuer ?"
        : "Supprimer cette image ?";
    if (!confirm(msg)) return;
    // `force=true` quand l'image sert quelque part : le backend refuse sinon (409).
    await api(`/cms/media/${m.id}/${total > 0 ? "?force=true" : ""}`, { method: "DELETE" });
    setItems((it) => it.filter((x) => x.id !== m.id));
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Médiathèque"
        subtitle={`${items.length} image(s) réutilisables — logos, images de blocs, cartes, couvertures d'articles, images de partage. Chaque vignette indique où elle sert.`}
        actions={
          <label className="btn-brand cursor-pointer">
            {uploading ? "Envoi…" : "Importer des images"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
          </label>
        }
      />

      {loading ? (
        <Loading />
      ) : err ? (
        <ErrorState message="Impossible de charger la médiathèque." onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bx-image"
          title="Aucune image"
          hint="Importez des images pour les réutiliser dans les pages et articles."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => (
            <div key={m.id} className="card group relative overflow-hidden">
              {m.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.alt} className="aspect-square w-full object-cover" />
              )}
              <div className="truncate px-2 pt-1.5 text-xs text-muted">{m.title}</div>
              {(() => {
                const total = (m.usages ?? []).reduce((s, u) => s + u.count, 0);
                const titre = (m.usages ?? []).map((u) => `${u.label} : ${u.count}`).join("\n");
                return (
                  <div
                    className="px-2 pb-1.5 text-[11px]"
                    title={total > 0 ? `Utilisée dans :\n${titre}` : "Cette image n'est utilisée nulle part"}
                  >
                    {total > 0 ? (
                      <span className="inline-flex items-center gap-1 font-medium text-brand">
                        <i className="bx bx-link" /> Utilisée ({total})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted/70">
                        <i className="bx bx-minus-circle" /> Inutilisée
                      </span>
                    )}
                  </div>
                );
              })()}
              <button
                onClick={() => del(m)}
                title="Supprimer l'image"
                aria-label={`Supprimer l'image ${m.title}`}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 opacity-0 shadow transition focus-visible:opacity-100 group-hover:opacity-100"
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
