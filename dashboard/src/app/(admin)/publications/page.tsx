"use client";

import { useEffect, useRef, useState } from "react";
import { api, listAll } from "@/lib/api";
import { Toggle, Pagination, PAGE_SIZE, Modal, TextField, TextArea, SelectField, Badge } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { TeacherItem, PublicationItem, PublicationsOverview, ThemeItem } from "@/lib/types";

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
  // Cohorte : une Publication EST la session vendue.
  mode: "1",
  date_debut: "",
  date_fin: "",
  capacite: "",
  acces_duree_mois: "",
  instructors: [] as number[],
  // Champs affichés sur la fiche publique et le flyer de partage.
  show_price: true,
  show_dates: true,
  show_places: true,
  show_categorie: true,
};

// ISO (UTC) -> valeur d'un <input type="datetime-local">, en heure locale.
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PublicationsPage() {
  const toast = useToast();
  const { canWrite, profile } = useAuth();
  const isAdmin = !!profile?.is_admin;
  const writable = canWrite("publications");
  const [items, setItems] = useState<PublicationItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  useEffect(() => {
    api<TeacherItem[]>("/modules/formations/teachers/").then(setTeachers).catch(() => {});
  }, []);
  const [overview, setOverview] = useState<PublicationsOverview | null>(null);
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [categorie, setCategorie] = useState("");
  const [loading, setLoading] = useState(true);
  // Rechargement léger au changement de filtre : la liste reste visible.
  const [refetching, setRefetching] = useState(false);
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

  // Lien profond depuis la recherche rapide (⌘K) : /publications?edit=<id>
  // ouvre directement la fiche de la session concernée.
  const deepLinkFait = useRef(false);
  useEffect(() => {
    if (deepLinkFait.current || items.length === 0) return;
    const id = Number(new URLSearchParams(window.location.search).get("edit"));
    if (!id) return;
    const cible = items.find((x) => x.id === id);
    if (cible) {
      deepLinkFait.current = true;
      openEdit(cible);
    }
  }, [items]);

  async function onFilter(cat: string) {
    setCategorie(cat);
    setPage(1);
    setRefetching(true);
    try {
      await load(cat);
    } finally {
      setRefetching(false);
    }
  }

  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function togglePrivacy(p: PublicationItem) {
    const next = !p.is_private;
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, is_private: next } : x)));
    try {
      await api(`/modules/publications/${p.id}/`, { method: "PATCH", body: { is_private: next } });
    } catch {
      setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, is_private: !next } : x)));
      toast.error("Impossible de changer la visibilité de la publication.");
    }
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
      mode: String(p.mode ?? 1),
      date_debut: toLocalInput(p.date_debut),
      date_fin: toLocalInput(p.date_fin),
      capacite: p.capacite == null ? "" : String(p.capacite),
      acces_duree_mois: p.acces_duree_mois == null ? "" : String(p.acces_duree_mois),
      instructors: p.instructors ?? (p.instructors_detail ?? []).map((i) => i.id),
      show_price: p.show_price ?? true,
      show_dates: p.show_dates ?? true,
      show_places: p.show_places ?? true,
      show_categorie: p.show_categorie ?? true,
    });
    setErr("");
    setOpen(true);
  }

  async function submit() {
    setErr("");
    if (!form.title.trim()) return setErr("Le titre est requis.");
    if (!form.id && !form.categorie) return setErr("Choisis une catégorie.");
    const cohorte = form.mode === "1";
    if (cohorte && form.date_debut && form.date_fin && form.date_fin < form.date_debut) {
      return setErr("La fin de session ne peut pas précéder son début.");
    }
    setSaving(true);
    try {
      const path = form.id ? `/modules/publications/${form.id}/` : "/modules/publications/";
      const method = form.id ? "PATCH" : "POST";
      const iso = (v: string) => (v ? new Date(v).toISOString() : null);
      const num = (v: string) => (v.trim() === "" ? null : Number(v));
      if (form.image) {
        // Multipart : obligatoire pour l'upload, mais incapable d'exprimer null —
        // on n'y transmet donc que les champs renseignés.
        const fd = new FormData();
        fd.set("title", form.title.trim());
        fd.set("description", form.description);
        fd.set("price", form.price || "0");
        fd.set("is_private", form.is_private ? "true" : "false");
        fd.set("mode", form.mode);
        if (cohorte && form.date_debut) fd.set("date_debut", iso(form.date_debut) as string);
        if (cohorte && form.date_fin) fd.set("date_fin", iso(form.date_fin) as string);
        if (form.capacite.trim()) fd.set("capacite", form.capacite);
        if (form.acces_duree_mois.trim()) fd.set("acces_duree_mois", form.acces_duree_mois);
        if (isAdmin) form.instructors.forEach((i) => fd.append("instructors", String(i)));
        if (form.categorie) fd.set("categorie", form.categorie);
        if (form.parent) fd.set("parent", form.parent);
        form.themes.forEach((t) => fd.append("themes", String(t)));
        (["show_price", "show_dates", "show_places", "show_categorie"] as const).forEach((k) =>
          fd.set(k, form[k] ? "true" : "false")
        );
        fd.set("image", form.image);
        await api(path, { method, body: fd, isForm: true });
      } else {
        // JSON : permet de VIDER une date ou une capacité (envoi de null).
        const body: Record<string, unknown> = {
          title: form.title.trim(),
          description: form.description,
          price: form.price || "0",
          is_private: form.is_private,
          themes: form.themes,
          mode: Number(form.mode),
          date_debut: cohorte ? iso(form.date_debut) : null,
          date_fin: cohorte ? iso(form.date_fin) : null,
          capacite: num(form.capacite),
          acces_duree_mois: num(form.acces_duree_mois),
          show_price: form.show_price,
          show_dates: form.show_dates,
          show_places: form.show_places,
          show_categorie: form.show_categorie,
        };
        if (isAdmin) body.instructors = form.instructors;
        if (form.categorie) body.categorie = Number(form.categorie);
        if (form.parent) body.parent = Number(form.parent);
        await api(path, { method, body });
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
        <div className={refetching ? "pointer-events-none opacity-50 transition" : "transition"}>
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
                    <span><i className="bx bx-money" /> {formatMoney(p.price, "Gratuit")}</span>
                    {(p.themes_titles?.length ?? 0) > 0 && (
                      <span className="text-brand"><i className="bx bx-link" /> {p.themes_titles!.map((t) => t.title).join(", ")}</span>
                    )}
                    {p.children_count > 0 && <span><i className="bx bx-sitemap" /> {p.children_count} sous-publi.</span>}
                  </div>
                </div>
                <Badge tone={p.is_private ? "neutral" : "success"}>
                  {p.is_private ? "Privé" : "Public"}
                </Badge>
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
        </div>
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
            <label className="label">Formation(s) liée(s) — le contenu pédagogique débloqué à l&apos;achat</label>
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
              {themes.length === 0 && <span className="text-xs text-muted">Aucune formation. Crée-en d&apos;abord dans « Formations ».</span>}
            </div>
          </div>

          {/* Hiérarchie : publication parente */}
          <SelectField
            label="Publication parente (hiérarchie, facultatif)"
            value={form.parent}
            onChange={(v) => setForm({ ...form, parent: v })}
            options={[{ value: "", label: "— aucune —" }, ...items.filter((x) => x.id !== form.id).map((x) => ({ value: String(x.id), label: x.title }))]}
          />

          <div className="rounded-xl border border-line bg-brand-soft/20 p-4">
            <p className="mb-3 text-sm font-semibold text-brand-deep">Session</p>
            <SelectField
              label="Type d'offre"
              value={form.mode}
              onChange={(v) => setForm({ ...form, mode: v, ...(v === "2" ? { date_debut: "", date_fin: "" } : {}) })}
              options={[
                { value: "1", label: "Session à dates fixes (cohorte)" },
                { value: "2", label: "Accès libre (auto-formation)" },
              ]}
            />
            {form.mode === "1" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Début de session</label>
                  <input type="datetime-local" className="input" value={form.date_debut}
                    onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
                </div>
                <div>
                  <label className="label">Fin de session</label>
                  <input type="datetime-local" className="input" value={form.date_fin}
                    onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
                </div>
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Places (vide = illimité)" value={form.capacite}
                onChange={(v) => setForm({ ...form, capacite: v.replace(/[^0-9]/g, "") })} placeholder="12" />
              <TextField label="Accès pendant (mois, vide = à vie)" value={form.acces_duree_mois}
                onChange={(v) => setForm({ ...form, acces_duree_mois: v.replace(/[^0-9]/g, "") })} placeholder="12" />
            </div>
            <p className="mt-2 text-xs text-muted">
              {form.mode === "1"
                ? "L'accès se ferme ce nombre de mois après la fin de session."
                : "L'accès se ferme ce nombre de mois après l'achat (pas de fin de session en accès libre)."}
            </p>

            {/* Animateur(s) de CETTE session — distinct de l'auteur du programme,
                défini côté Formations. C'est ce rattachement qui donne accès au
                suivi des apprenants et au planning de la session. */}
            {isAdmin && (
              <div className="mt-4 border-t border-line/70 pt-3">
                <label className="label">Formateur(s) qui animent cette session</label>
                <div className="flex flex-wrap gap-2">
                  {teachers.map((t) => {
                    const on = form.instructors.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, instructors: on ? f.instructors.filter((x) => x !== t.id) : [...f.instructors, t.id] }))}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${on ? "bg-accent text-white" : "bg-brand-soft text-brand hover:bg-brand/10"}`}
                        title={t.email}
                      >
                        {on && <i className="bx bx-check" />} {t.name}
                      </button>
                    );
                  })}
                  {teachers.length === 0 && <span className="text-xs text-muted">Aucun formateur (groupe « Teacher ») encore.</span>}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Ils verront les apprenants et le planning de cette session — pas ceux des autres sessions du même programme.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="label">Image (facultatif)</label>
            <input type="file" accept="image/*" className="input" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_private} onChange={(e) => setForm({ ...form, is_private: e.target.checked })} />
            Privé (non visible sur la vitrine)
          </label>

          {/* Ce que la fiche publique et le flyer de partage montrent. */}
          <div className="border-t border-line pt-4">
            <p className="label mb-0">Champs affichés sur la fiche et le flyer</p>
            <p className="mb-3 text-xs text-muted">
              Un champ désactivé disparaît de la page ET du flyer partagé. Masquer le prix
              affiche « Prix sur demande » — l&apos;inscription reste possible.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["show_price", "Prix"],
                ["show_dates", "Dates de session"],
                ["show_places", "Places restantes"],
                ["show_categorie", "Catégorie"],
              ] as const).map(([cle, libelle]) => (
                <div key={cle} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
                  <span className="text-sm text-ink">{libelle}</span>
                  <Toggle
                    checked={form[cle]}
                    onChange={(v) => setForm({ ...form, [cle]: v })}
                    label={form[cle] ? "Affiché" : "Masqué"}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
