"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import { Toggle, Pagination, PAGE_SIZE, Modal, TextField, TextArea, SelectField } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { PublicationItem, PublicationsOverview, ThemeItem } from "@/lib/types";

function fmtPrice(p: string) {
  const n = Number(p);
  if (!n) return "Gratuit";
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

const EMPTY = {
  id: 0,
  title: "",
  description: "",
  price: "0",
  categorie: "",
  parent: "",
  is_private: false,
  themes: [] as number[],
  image: null as File | null,
};

export default function PublicationsPage() {
  const { canWrite } = useAuth();
  const writable = canWrite("publications");
  const [items, setItems] = useState<PublicationItem[]>([]);
  const [overview, setOverview] = useState<PublicationsOverview | null>(null);
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [categorie, setCategorie] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function load(cat: string) {
    const path = cat ? `/modules/publications/?categorie=${cat}` : "/modules/publications/";
    setItems(await listAll<PublicationItem>(path));
  }

  useEffect(() => {
    Promise.all([
      listAll<PublicationItem>("/modules/publications/"),
      api<PublicationsOverview>("/modules/publications/overview/"),
      listAll<ThemeItem>("/modules/themes/"),
    ])
      .then(([p, o, t]) => {
        setItems(p);
        setOverview(o);
        setThemes(t);
      })
      .finally(() => setLoading(false));
  }, []);

  async function onFilter(cat: string) {
    setCategorie(cat);
    setPage(1);
    setLoading(true);
    await load(cat);
    setLoading(false);
  }

  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function togglePrivacy(p: PublicationItem) {
    await api(`/modules/publications/${p.id}/`, { method: "PATCH", body: { is_private: !p.is_private } });
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, is_private: !x.is_private } : x)));
  }

  function openCreate() {
    setForm({ ...EMPTY, categorie: overview?.categories[0] ? String(overview.categories[0].id) : "" });
    setErr("");
    setOpen(true);
  }
  function openEdit(p: PublicationItem) {
    setForm({
      id: p.id,
      title: p.title,
      description: p.description || "",
      price: String(Number(p.price) || 0),
      categorie: p.categorie ? String(p.categorie) : "",
      parent: p.parent ? String(p.parent) : "",
      is_private: p.is_private,
      themes: (p.themes_titles ?? []).map((t) => t.id),
      image: null,
    });
    setErr("");
    setOpen(true);
  }

  async function submit() {
    setErr("");
    if (!form.title.trim()) return setErr("Le titre est requis.");
    if (!form.id && !form.categorie) return setErr("Choisis une catégorie.");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("title", form.title.trim());
      fd.set("description", form.description);
      fd.set("price", form.price || "0");
      fd.set("is_private", form.is_private ? "true" : "false");
      if (form.categorie) fd.set("categorie", form.categorie);
      if (form.parent) fd.set("parent", form.parent);
      form.themes.forEach((t) => fd.append("themes", String(t)));
      if (form.image) fd.set("image", form.image);
      if (form.id) {
        await api(`/modules/publications/${form.id}/`, { method: "PATCH", body: fd, isForm: true });
      } else {
        await api("/modules/publications/", { method: "POST", body: fd, isForm: true });
      }
      setOpen(false);
      setLoading(true);
      await load(categorie);
      setLoading(false);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e).slice(0, 300));
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: PublicationItem) {
    if (!confirm(`Supprimer la publication « ${p.title} » ?`)) return;
    await api(`/modules/publications/${p.id}/`, { method: "DELETE" });
    setItems((xs) => xs.filter((x) => x.id !== p.id));
  }

  const tiles = overview
    ? [
        { label: "Publications", value: overview.counts.publications, icon: "bx-news" },
        { label: "Publiques", value: overview.counts.public, icon: "bx-globe" },
        { label: "Catégories", value: overview.counts.categories, icon: "bx-category" },
        { label: "Tags", value: overview.counts.tags, icon: "bx-purchase-tag" },
      ]
    : [];

  return (
    <div className="p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Publications</h1>
          <p className="text-sm text-muted">Produits payants (formations), reliés à un thème pédagogique.</p>
        </div>
        {writable && (
          <button onClick={openCreate} className="btn-brand shrink-0">
            <i className="bx bx-plus" /> Nouvelle publication
          </button>
        )}
      </header>

      {overview && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {tiles.map((s) => (
            <div key={s.label} className="card flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand">
                <i className={`bx ${s.icon}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-brand-deep">{s.value}</div>
                <div className="text-xs text-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {overview && overview.categories.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm text-muted">Catégorie :</label>
          <select className="input max-w-[240px]" value={categorie} onChange={(e) => onFilter(e.target.value)}>
            <option value="">Toutes</option>
            {overview.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-muted">Aucune publication. {writable && "Clique « Nouvelle publication »."}</p>
      ) : (
        <>
          <div className="card divide-y divide-line">
            {pagedItems.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-12 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <i className="bx bx-file text-xl" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-brand-deep">{p.title}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                    {p.categorie_name && <span><i className="bx bx-category" /> {p.categorie_name}</span>}
                    <span><i className="bx bx-money" /> {fmtPrice(p.price)}</span>
                    {(p.themes_titles?.length ?? 0) > 0 && (
                      <span className="text-brand"><i className="bx bx-link" /> {p.themes_titles!.map((t) => t.title).join(", ")}</span>
                    )}
                    {p.children_count > 0 && <span><i className="bx bx-sitemap" /> {p.children_count} sous-publi.</span>}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    p.is_private ? "bg-gray-100 text-gray-500" : "bg-green-50 text-green-700"
                  }`}
                >
                  {p.is_private ? "Privé" : "Public"}
                </span>
                {writable && (
                  <>
                    <button onClick={() => openEdit(p)} className="btn-ghost shrink-0 text-xs" title="Éditer">
                      <i className="bx bx-edit" />
                    </button>
                    <button onClick={() => remove(p)} className="btn-danger shrink-0 text-xs" title="Supprimer">
                      <i className="bx bx-trash" />
                    </button>
                    <Toggle checked={!p.is_private} onChange={() => togglePrivacy(p)} label={p.is_private ? "Rendre public" : "Rendre privé"} />
                  </>
                )}
              </div>
            ))}
          </div>
          <Pagination page={page} total={items.length} onPage={setPage} />
        </>
      )}

      <Modal
        open={open}
        title={form.id ? "Éditer la publication" : "Nouvelle publication"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
            <button onClick={submit} disabled={saving} className="btn-brand disabled:opacity-50">
              {saving ? "Enregistrement…" : form.id ? "Enregistrer" : "Créer"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <TextField label="Titre" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Ex : Formation Python — Accès complet" />
          <TextArea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Prix (FCFA)" value={form.price} onChange={(v) => setForm({ ...form, price: v.replace(/[^0-9.]/g, "") })} placeholder="5000" />
            <SelectField
              label="Catégorie"
              value={form.categorie}
              onChange={(v) => setForm({ ...form, categorie: v })}
              options={[{ value: "", label: "— choisir —" }, ...(overview?.categories ?? []).map((c) => ({ value: String(c.id), label: c.name }))]}
            />
          </div>

          {/* Lien vers formation(s) / thème(s) */}
          <div>
            <label className="label">Formation(s) liée(s) — le contenu pédagogique débloqué à l'achat</label>
            <div className="flex flex-wrap gap-2">
              {themes.map((t) => {
                const on = form.themes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, themes: on ? f.themes.filter((x) => x !== t.id) : [...f.themes, t.id] }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${on ? "bg-brand text-white" : "bg-brand-soft text-brand hover:bg-brand/10"}`}
                  >
                    {on && <i className="bx bx-check" />} {t.title}
                  </button>
                );
              })}
              {themes.length === 0 && <span className="text-xs text-muted">Aucune formation. Crée-en d'abord dans « Formations ».</span>}
            </div>
          </div>

          {/* Hiérarchie : publication parente */}
          <SelectField
            label="Publication parente (hiérarchie, facultatif)"
            value={form.parent}
            onChange={(v) => setForm({ ...form, parent: v })}
            options={[{ value: "", label: "— aucune —" }, ...items.filter((x) => x.id !== form.id).map((x) => ({ value: String(x.id), label: x.title }))]}
          />

          <div>
            <label className="label">Image (facultatif)</label>
            <input type="file" accept="image/*" className="input" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_private} onChange={(e) => setForm({ ...form, is_private: e.target.checked })} />
            Privé (non visible sur la vitrine)
          </label>
        </div>
      </Modal>
    </div>
  );
}
