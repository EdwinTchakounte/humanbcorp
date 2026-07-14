"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, listAll } from "@/lib/api";
import { Toggle, Pagination, PAGE_SIZE, Modal, TextField, SelectField } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { ThemeItem, FormationsOverview, TeacherItem } from "@/lib/types";

type Opt = { id: number; name?: string; year?: string; numero?: number; session?: number };

const EMPTY_FORM = {
  id: 0,
  title: "",
  t_type: "1",
  session: "",
  sequence: "",
  categorie: "",
  classes: [] as number[],
  instructors: [] as number[],
  is_visible: true,
  image: null as File | null,
};

export default function FormationsPage() {
  const { canWrite, profile } = useAuth();
  const writable = canWrite("formations");
  const isAdmin = !!profile?.is_admin;
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [overview, setOverview] = useState<FormationsOverview | null>(null);
  const [sessions, setSessions] = useState<Opt[]>([]);
  const [sequences, setSequences] = useState<Opt[]>([]);
  const [categories, setCategories] = useState<Opt[]>([]);
  const [classes, setClasses] = useState<Opt[]>([]);
  const [session, setSession] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Modal création/édition
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // Création inline hiérarchie
  const [nSession, setNSession] = useState("");
  const [nSeq, setNSeq] = useState("");
  const [nCat, setNCat] = useState("");
  const [nClasse, setNClasse] = useState("");

  function applyOverview(o: FormationsOverview) {
    setOverview(o);
    setSessions(o.sessions);
    setSequences(o.sequences);
    setCategories(o.categories);
    setClasses(o.classes);
  }

  async function reloadOverview() {
    applyOverview(await api<FormationsOverview>("/modules/formations/overview/"));
  }

  async function loadThemes(sess: string) {
    const path = sess ? `/modules/themes/?session=${sess}` : "/modules/themes/";
    setThemes(await listAll<ThemeItem>(path));
  }

  useEffect(() => {
    Promise.all([
      listAll<ThemeItem>("/modules/themes/"),
      api<FormationsOverview>("/modules/formations/overview/"),
    ])
      .then(([t, o]) => {
        setThemes(t);
        applyOverview(o);
      })
      .finally(() => setLoading(false));
    // Liste des formateurs (pour l'affectation, admin seulement).
    api<TeacherItem[]>("/modules/formations/teachers/").then(setTeachers).catch(() => {});
  }, []);

  async function onFilter(sess: string) {
    setSession(sess);
    setPage(1);
    setLoading(true);
    await loadThemes(sess);
    setLoading(false);
  }

  const pagedThemes = themes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const seqOptions = useMemo(
    () => sequences.filter((s) => !form.session || String(s.session) === form.session),
    [sequences, form.session],
  );

  async function toggle(t: ThemeItem) {
    await api(`/modules/themes/${t.id}/`, { method: "PATCH", body: { is_visible: !t.is_visible } });
    setThemes((xs) => xs.map((x) => (x.id === t.id ? { ...x, is_visible: !x.is_visible } : x)));
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setErr("");
    setOpen(true);
  }

  function openEdit(t: ThemeItem) {
    setForm({
      id: t.id,
      title: t.title,
      t_type: String(t.t_type),
      session: t.sequence ? String(sequences.find((s) => s.id === t.sequence)?.session ?? "") : "",
      sequence: t.sequence ? String(t.sequence) : "",
      categorie: t.categorie ? String(t.categorie) : "",
      classes: t.classes ?? [],
      instructors: t.instructors ?? (t.instructors_detail ?? []).map((i) => i.id),
      is_visible: t.is_visible,
      image: null,
    });
    setErr("");
    setOpen(true);
  }

  // --- Création inline de la hiérarchie ---
  async function addSession() {
    if (!nSession.trim()) return;
    const s = await api<Opt>("/modules/sessions/", { method: "POST", body: { year: nSession.trim() } });
    setNSession("");
    await reloadOverview();
    setForm((f) => ({ ...f, session: String(s.id), sequence: "" }));
  }
  async function addSequence() {
    if (!form.session || !nSeq.trim()) return;
    const s = await api<Opt>("/modules/sequences/", {
      method: "POST",
      body: { numero: Number(nSeq), session: Number(form.session) },
    });
    setNSeq("");
    await reloadOverview();
    setForm((f) => ({ ...f, sequence: String(s.id) }));
  }
  async function addCategorie() {
    if (!nCat.trim()) return;
    const c = await api<Opt>("/modules/formation-categories/", { method: "POST", body: { name: nCat.trim() } });
    setNCat("");
    await reloadOverview();
    setForm((f) => ({ ...f, categorie: String(c.id) }));
  }
  async function addClasse() {
    if (!nClasse.trim()) return;
    const c = await api<Opt>("/modules/classes/", { method: "POST", body: { name: nClasse.trim() } });
    setNClasse("");
    await reloadOverview();
    setForm((f) => ({ ...f, classes: [...f.classes, c.id] }));
  }

  async function submit() {
    setErr("");
    if (!form.title.trim()) return setErr("Le titre est requis.");
    if (!form.id) {
      if (!form.sequence) return setErr("Choisis (ou crée) une séquence.");
      if (!form.categorie) return setErr("Choisis (ou crée) une catégorie.");
    }
    setSaving(true);
    try {
      const method = form.id ? "PATCH" : "POST";
      const path = form.id ? `/modules/themes/${form.id}/` : "/modules/themes/";
      if (form.image) {
        // Multipart (upload image). NB : listes vides non transmissibles ici.
        const fd = new FormData();
        fd.set("title", form.title.trim());
        fd.set("t_type", form.t_type);
        fd.set("is_visible", form.is_visible ? "true" : "false");
        if (form.sequence) fd.set("sequence", form.sequence);
        if (form.categorie) fd.set("categorie", form.categorie);
        form.classes.forEach((c) => fd.append("classes", String(c)));
        if (isAdmin) form.instructors.forEach((i) => fd.append("instructors", String(i)));
        fd.set("image", form.image);
        await api(path, { method, body: fd, isForm: true });
      } else {
        // JSON : permet d'ENVOYER des listes vides (retirer toutes les classes/formateurs).
        const body: Record<string, unknown> = {
          title: form.title.trim(),
          t_type: Number(form.t_type),
          is_visible: form.is_visible,
          classes: form.classes,
        };
        if (form.sequence) body.sequence = Number(form.sequence);
        if (form.categorie) body.categorie = Number(form.categorie);
        if (isAdmin) body.instructors = form.instructors;
        await api(path, { method, body });
      }
      setOpen(false);
      setLoading(true);
      await Promise.all([loadThemes(session), reloadOverview()]);
      setLoading(false);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e).slice(0, 300));
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: ThemeItem) {
    if (!confirm(`Supprimer la formation « ${t.title} » ? Son contenu (séances, activités) sera aussi supprimé.`)) return;
    await api(`/modules/themes/${t.id}/`, { method: "DELETE" });
    setThemes((xs) => xs.filter((x) => x.id !== t.id));
    reloadOverview();
  }

  const tiles = overview
    ? [
        { label: "Formations", value: overview.counts.themes, icon: "bx-book" },
        { label: "Sessions", value: overview.counts.sessions, icon: "bx-calendar" },
        { label: "Séquences", value: overview.counts.sequences, icon: "bx-list-ol" },
        { label: "Catégories", value: overview.counts.categories, icon: "bx-category" },
      ]
    : [];

  return (
    <div className="p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Formations</h1>
          <p className="text-sm text-muted">Catalogue des thèmes de formation (Cours & Examens).</p>
        </div>
        {writable && (
          <button onClick={openCreate} className="btn-brand shrink-0">
            <i className="bx bx-plus" /> Nouvelle formation
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

      {overview && sessions.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm text-muted">Session :</label>
          <select className="input max-w-[200px]" value={session} onChange={(e) => onFilter(e.target.value)}>
            <option value="">Toutes</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.year}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : themes.length === 0 ? (
        <p className="text-muted">Aucune formation. {writable && "Clique « Nouvelle formation » pour en créer une."}</p>
      ) : (
        <>
          <div className="card divide-y divide-line">
            {pagedThemes.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                {t.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image_url} alt="" className="h-12 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <i className="bx bx-book-open text-xl" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-brand-deep">{t.title}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span
                      className={`rounded px-1.5 py-0.5 font-semibold ${
                        t.t_type === 2 ? "bg-accent/10 text-accent" : "bg-brand-soft text-brand"
                      }`}
                    >
                      {t.t_type_label}
                    </span>
                    {t.categorie_name && <span><i className="bx bx-category" /> {t.categorie_name}</span>}
                    {t.session_year && <span><i className="bx bx-calendar" /> {t.session_year}</span>}
                    <span><i className="bx bx-play-circle" /> {t.seances_count} séance(s)</span>
                    {t.classes_names.length > 0 && <span><i className="bx bx-group" /> {t.classes_names.join(", ")}</span>}
                    {(t.instructors_detail?.length ?? 0) > 0 && (
                      <span className="text-accent"><i className="bx bx-user-voice" /> {t.instructors_detail!.map((i) => i.name).join(", ")}</span>
                    )}
                  </div>
                </div>
                <Link href={`/formations/${t.id}/contenu`} className="btn-ghost shrink-0 text-xs" title="Éditer le contenu">
                  <i className="bx bx-list-ul" /> Contenu
                </Link>
                {writable && (
                  <>
                    <button onClick={() => openEdit(t)} className="btn-ghost shrink-0 text-xs" title="Éditer">
                      <i className="bx bx-edit" />
                    </button>
                    <button onClick={() => remove(t)} className="btn-ghost shrink-0 text-xs text-red-600" title="Supprimer">
                      <i className="bx bx-trash" />
                    </button>
                    <Toggle checked={t.is_visible} onChange={() => toggle(t)} label={t.is_visible ? "Visible" : "Masqué"} />
                  </>
                )}
                {!writable && <span className="text-xs text-muted">{t.is_visible ? "Visible" : "Masqué"}</span>}
              </div>
            ))}
          </div>
          <Pagination page={page} total={themes.length} onPage={setPage} />
        </>
      )}

      <Modal
        open={open}
        title={form.id ? "Éditer la formation" : "Nouvelle formation"}
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
          <TextField label="Titre de la formation" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Ex : Introduction à Python" />
          <SelectField
            label="Type"
            value={form.t_type}
            onChange={(v) => setForm({ ...form, t_type: v })}
            options={[{ value: "1", label: "Cours" }, { value: "2", label: "Examen" }]}
          />

          {/* Session + création inline */}
          <div>
            <SelectField
              label="Session"
              value={form.session}
              onChange={(v) => setForm({ ...form, session: v, sequence: "" })}
              options={[{ value: "", label: "— choisir —" }, ...sessions.map((s) => ({ value: String(s.id), label: s.year || "" }))]}
            />
            <div className="mt-1.5 flex gap-2">
              <input className="input text-sm" placeholder="Nouvelle session (ex : 2026-2027)" value={nSession} onChange={(e) => setNSession(e.target.value)} />
              <button type="button" onClick={addSession} className="btn-ghost shrink-0 text-xs">+ Ajouter</button>
            </div>
          </div>

          {/* Séquence + création inline (dépend de la session) */}
          <div>
            <SelectField
              label="Séquence"
              value={form.sequence}
              onChange={(v) => setForm({ ...form, sequence: v })}
              options={[{ value: "", label: "— choisir —" }, ...seqOptions.map((s) => ({ value: String(s.id), label: `Séquence ${s.numero}` }))]}
            />
            <div className="mt-1.5 flex gap-2">
              <input className="input text-sm" placeholder={form.session ? "N° de séquence (ex : 1)" : "Choisis d'abord une session"} disabled={!form.session} value={nSeq} onChange={(e) => setNSeq(e.target.value)} />
              <button type="button" onClick={addSequence} disabled={!form.session} className="btn-ghost shrink-0 text-xs disabled:opacity-40">+ Ajouter</button>
            </div>
          </div>

          {/* Catégorie + création inline */}
          <div>
            <SelectField
              label="Catégorie"
              value={form.categorie}
              onChange={(v) => setForm({ ...form, categorie: v })}
              options={[{ value: "", label: "— choisir —" }, ...categories.map((c) => ({ value: String(c.id), label: c.name || "" }))]}
            />
            <div className="mt-1.5 flex gap-2">
              <input className="input text-sm" placeholder="Nouvelle catégorie" value={nCat} onChange={(e) => setNCat(e.target.value)} />
              <button type="button" onClick={addCategorie} className="btn-ghost shrink-0 text-xs">+ Ajouter</button>
            </div>
          </div>

          {/* Classes (multi) + création inline */}
          <div>
            <label className="label">Classes / niveaux</label>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => {
                const on = form.classes.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, classes: on ? f.classes.filter((x) => x !== c.id) : [...f.classes, c.id] }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${on ? "bg-brand text-white" : "bg-brand-soft text-brand hover:bg-brand/10"}`}
                  >
                    {on && <i className="bx bx-check" />} {c.name}
                  </button>
                );
              })}
              {classes.length === 0 && <span className="text-xs text-muted">Aucune classe encore.</span>}
            </div>
            <div className="mt-1.5 flex gap-2">
              <input className="input text-sm" placeholder="Nouvelle classe / niveau" value={nClasse} onChange={(e) => setNClasse(e.target.value)} />
              <button type="button" onClick={addClasse} className="btn-ghost shrink-0 text-xs">+ Ajouter</button>
            </div>
          </div>

          {/* Formateurs affectés (admin uniquement) */}
          {isAdmin && (
            <div>
              <label className="label">Formateur(s) affecté(s)</label>
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
              <p className="mt-1 text-xs text-muted">Un formateur ne voit et n&apos;édite que les formations qui lui sont affectées.</p>
            </div>
          )}

          {/* Image */}
          <div>
            <label className="label">Image (facultatif)</label>
            <input type="file" accept="image/*" className="input" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_visible} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} />
            Visible sur la vitrine
          </label>
        </div>
      </Modal>
    </div>
  );
}
