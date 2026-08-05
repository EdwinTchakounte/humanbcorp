"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, listAll, apiBase, tokens } from "@/lib/api";
import { Modal, TextField, TextArea, SelectField } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { ActivityItem, ComponentItem, ActivityDocItem, QuizQuestionItem } from "@/lib/types";

const DOC_TYPES = [
  { value: "1", label: "Cours" },
  { value: "2", label: "Exercice" },
  { value: "4", label: "Correction" },
];
const DOC_LABEL: Record<number, string> = { 1: "Cours", 2: "Exercice", 3: "Réponse", 4: "Correction" };

const INPUT_TYPES = [
  { value: "2", label: "Choix unique (une seule bonne réponse)" },
  { value: "1", label: "Choix multiple (plusieurs bonnes réponses)" },
];

// Les 6 types de quiz (miroir de Question.KIND_CHOICES côté backend).
const KIND_QCM = "1", KIND_TF = "2", KIND_TEXT = "3", KIND_NUM = "4", KIND_ASSOC = "5", KIND_ORDER = "6";
const KIND_TYPES = [
  { value: KIND_QCM, label: "QCM (choix avec/sans image)" },
  { value: KIND_TF, label: "Vrai / Faux" },
  { value: KIND_TEXT, label: "Texte libre" },
  { value: KIND_NUM, label: "Numérique" },
  { value: KIND_ASSOC, label: "Association (relier)" },
  { value: KIND_ORDER, label: "Ordonnancement" },
];
const KIND_LABEL: Record<number, string> = {
  1: "QCM", 2: "Vrai/Faux", 3: "Texte libre", 4: "Numérique", 5: "Association", 6: "Ordonnancement",
};
const KIND_ICON: Record<number, string> = {
  1: "bx-list-check", 2: "bx-toggle-left", 3: "bx-text", 4: "bx-hash", 5: "bx-link", 6: "bx-sort-alt-2",
};

type CompDraft = {
  id?: number;
  title: string;
  paragraph: string;
  video_url: string;
  audio_url: string;
  imageFile: File | null;
  videoFile: File | null;
  audioFile: File | null;
};
type DocDraft = { title: string; url: string; m_type: string; file: File | null };
// Option de QCM : peut porter une image (nouvelle via `file`, ou existante via `image`).
type QOptDraft = { id?: number; title: string; is_answer: boolean; file?: File | null; image?: string | null };
type QDraft = {
  id?: number;
  kind: string;               // "1".."6"
  title: string;
  description: string;
  points: string;
  // Image d'énoncé (facultative, tous types)
  imageFile: File | null;
  image?: string | null;      // URL existante
  imageClear?: boolean;
  // QCM
  input_type: string;         // "1" multiple / "2" unique
  options: QOptDraft[];
  // Vrai/Faux
  correct: boolean;
  // Texte libre / Numérique — réponses acceptées (num : "42" ou "42|0.5")
  accepted: string[];
  // Association
  pairs: { left: string; right: string }[];
  // Ordonnancement (dans l'ordre correct)
  items: string[];
};

// Brouillon vierge pour une nouvelle question.
function emptyQDraft(): QDraft {
  return {
    kind: KIND_QCM, title: "", description: "", points: "1",
    imageFile: null, image: null, imageClear: false,
    input_type: "2",
    options: [{ title: "", is_answer: true }, { title: "", is_answer: false }],
    correct: true,
    accepted: [""],
    pairs: [{ left: "", right: "" }, { left: "", right: "" }],
    items: ["", ""],
  };
}

// Reconstruit un brouillon éditable depuis une question existante (décode les
// options encodées : "gauche||droite", "position||texte", réponses acceptées…).
function draftFromQuestion(q: QuizQuestionItem): QDraft {
  const base = emptyQDraft();
  base.id = q.id;
  base.kind = String(q.kind || 1);
  base.title = q.title;
  base.description = q.description || "";
  base.points = String(q.points);
  base.image = q.image || null;
  base.input_type = String(q.input_type || 2);
  const opts = q.options || [];
  switch (q.kind) {
    case 2: { // Vrai/Faux
      const vrai = opts.find((o) => /^vrai$/i.test(o.title));
      base.correct = vrai ? vrai.is_answer : (opts[0]?.is_answer ?? true);
      break;
    }
    case 3:
    case 4: // Texte / Numérique → réponses acceptées
      base.accepted = opts.length ? opts.map((o) => o.title) : [""];
      break;
    case 5: // Association → paires gauche||droite
      base.pairs = opts.length
        ? opts.map((o) => { const [l, r] = o.title.split("||"); return { left: l || "", right: r || "" }; })
        : [{ left: "", right: "" }];
      break;
    case 6: { // Ordonnancement → items triés par position
      const parsed = opts.map((o) => { const [p, t] = o.title.split("||"); return { p: Number(p) || 0, t: t || "" }; });
      parsed.sort((a, b) => a.p - b.p);
      base.items = parsed.length ? parsed.map((x) => x.t) : ["", ""];
      break;
    }
    default: // QCM
      base.options = opts.length
        ? opts.map((o) => ({ id: o.id, title: o.title, is_answer: o.is_answer, image: o.image || null }))
        : [{ title: "", is_answer: true }];
  }
  return base;
}

// Aperçu lisible des réponses d'une question, selon son type.
function QuestionAnswersPreview({ q }: { q: QuizQuestionItem }) {
  const opts = q.options || [];
  if (q.kind === 5) {
    return (
      <ul className="mt-1 space-y-0.5 text-sm text-ink">
        {opts.map((o) => {
          const [l, r] = o.title.split("||");
          return <li key={o.id}><span className="font-medium">{l}</span> <i className="bx bx-right-arrow-alt align-middle text-muted" /> {r}</li>;
        })}
      </ul>
    );
  }
  if (q.kind === 6) {
    const parsed = opts.map((o) => { const [p, t] = o.title.split("||"); return { p: Number(p) || 0, t }; }).sort((a, b) => a.p - b.p);
    return (
      <ol className="mt-1 space-y-0.5 text-sm text-ink">
        {parsed.map((x, k) => <li key={k}><span className="font-semibold text-brand">{k + 1}.</span> {x.t}</li>)}
      </ol>
    );
  }
  if (q.kind === 3 || q.kind === 4) {
    return (
      <p className="mt-1 text-sm">
        <span className="text-muted">Réponse(s) acceptée(s) : </span>
        <span className="font-medium text-green-700">{opts.map((o) => o.title).join(" · ") || "—"}</span>
      </p>
    );
  }
  // QCM / Vrai-Faux : liste des options, bonnes en vert, vignette d'image si présente.
  return (
    <ul className="mt-1 space-y-0.5 text-sm">
      {opts.map((o) => (
        <li key={o.id} className={`flex items-center gap-2 ${o.is_answer ? "text-green-700" : "text-muted"}`}>
          <i className={`bx ${o.is_answer ? "bx-check-circle" : "bx-circle"} align-middle`} />
          {o.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.image} alt="" className="h-8 w-8 rounded border border-line object-cover" />
          )}
          {o.title}
        </li>
      ))}
    </ul>
  );
}

export default function ActivityContentPage({ params }: { params: { id: string; aid: string } }) {
  const themeId = params.id;
  const activityId = Number(params.aid);
  const { canWrite } = useAuth();
  const writable = canWrite("formations");

  const [activity, setActivity] = useState<ActivityItem | null>(null);
  const [comps, setComps] = useState<ComponentItem[]>([]);
  const [docs, setDocs] = useState<ActivityDocItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [questions, setQuestions] = useState<QuizQuestionItem[]>([]);
  const [cDraft, setCDraft] = useState<CompDraft | null>(null);
  const [dDraft, setDDraft] = useState<DocDraft | null>(null);
  const [qDraft, setQDraft] = useState<QDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // Import de quiz par fichier
  const [impOpen, setImpOpen] = useState(false);
  const [impFile, setImpFile] = useState<File | null>(null);
  const [impResult, setImpResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const isQuiz = activity?.a_type === 1;

  async function loadQuestions() {
    setQuestions(await api<QuizQuestionItem[]>(`/modules/quiz-questions/?activity=${activityId}`));
  }

  async function loadComps() {
    setComps(await listAll<ComponentItem>(`/modules/components/?activity=${activityId}`));
  }
  async function loadDocs() {
    setDocs(await api<ActivityDocItem[]>(`/modules/activity-docs/?activity=${activityId}`));
  }

  useEffect(() => {
    Promise.all([
      api<ActivityItem>(`/modules/activities/${activityId}/`),
      listAll<ComponentItem>(`/modules/components/?activity=${activityId}`),
      api<ActivityDocItem[]>(`/modules/activity-docs/?activity=${activityId}`),
    ])
      .then(([a, c, d]) => {
        setActivity(a);
        setComps(c);
        setDocs(d);
        if (a?.a_type === 1) loadQuestions();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  // --- Questions (quiz) ---
  async function saveQuestion() {
    if (!qDraft) return;
    setSaving(true);
    setErr("");
    try {
      const kind = qDraft.kind;
      // QCM : options non vides (libellé OU image) ; on garde l'ordre pour aligner option_image_<i>.
      const qcmOptions = qDraft.options.filter((o) => o.title.trim() || o.file || o.image);
      const hasOptionImage = kind === KIND_QCM && qcmOptions.some((o) => o.file);
      const useForm = !!qDraft.imageFile || qDraft.imageClear || hasOptionImage;

      // Construit le corps typé (valeurs sérialisées en chaînes pour le multipart).
      const typed: Record<string, unknown> = {
        activity: activityId,
        title: qDraft.title,
        description: qDraft.description,
        points: Number(qDraft.points) || 1,
        kind: Number(kind),
      };
      if (kind === KIND_QCM) {
        typed.input_type = Number(qDraft.input_type);
        // `keep_image` : conserver l'image existante d'une option non modifiée
        // (id présent, image actuelle, aucun nouveau fichier).
        typed.options = qcmOptions.map((o) => ({
          title: o.title,
          is_answer: o.is_answer,
          ...(o.id ? { id: o.id } : {}),
          keep_image: !!(o.id && o.image && !o.file),
        }));
      } else if (kind === KIND_TF) {
        typed.correct = qDraft.correct;
      } else if (kind === KIND_TEXT || kind === KIND_NUM) {
        typed.accepted = qDraft.accepted.map((a) => a.trim()).filter(Boolean);
      } else if (kind === KIND_ASSOC) {
        typed.pairs = qDraft.pairs
          .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
          .filter((p) => p.left && p.right);
      } else if (kind === KIND_ORDER) {
        typed.items = qDraft.items.map((i) => i.trim()).filter(Boolean);
      }

      let body: FormData | Record<string, unknown>;
      if (useForm) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(typed)) {
          // Les objets/tableaux passent en JSON (le backend accepte la chaîne JSON).
          fd.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
        }
        if (qDraft.imageFile) fd.set("image", qDraft.imageFile);
        if (qDraft.imageClear && !qDraft.imageFile) fd.set("image_clear", "1");
        if (hasOptionImage) qcmOptions.forEach((o, i) => { if (o.file) fd.set(`option_image_${i}`, o.file); });
        body = fd;
      } else {
        body = typed;
      }

      const opts = { method: qDraft.id ? "PATCH" : "POST", body, isForm: useForm } as const;
      if (qDraft.id) await api(`/modules/quiz-questions/${qDraft.id}/`, opts);
      else await api("/modules/quiz-questions/", opts);
      setQDraft(null);
      await loadQuestions();
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }
  async function downloadTemplate(fmt: "csv" | "xlsx") {
    const res = await fetch(`${apiBase()}/api/v1/modules/quiz-questions/template/?fmt=${fmt}`, {
      headers: { Authorization: `Bearer ${tokens.access}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fmt === "xlsx" ? "modele_quiz.xlsx" : "modele_quiz.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    if (!impFile) return;
    setSaving(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("activity", String(activityId));
      fd.set("file", impFile);
      const res = await api<{ imported: number; errors: string[] }>("/modules/quiz-questions/import/", { method: "POST", body: fd, isForm: true });
      setImpResult(res);
      setImpFile(null);
      await loadQuestions();
    } catch (e) {
      setErr(String(e).slice(0, 300));
    } finally {
      setSaving(false);
    }
  }

  async function delQuestion(q: QuizQuestionItem) {
    if (!confirm(`Supprimer la question « ${q.title} » ?`)) return;
    await api(`/modules/quiz-questions/${q.id}/`, { method: "DELETE" });
    await loadQuestions();
  }
  function setOpt(i: number, patch: Partial<QOptDraft>) {
    setQDraft((d) => (d ? { ...d, options: d.options.map((o, k) => (k === i ? { ...o, ...patch } : o)) } : d));
  }

  async function saveComp() {
    if (!cDraft) return;
    setSaving(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("activity", String(activityId));
      fd.set("title", cDraft.title);
      fd.set("paragraph", cDraft.paragraph);
      fd.set("video_url", cDraft.video_url);
      fd.set("audio_url", cDraft.audio_url);
      if (cDraft.imageFile) fd.set("image", cDraft.imageFile);
      if (cDraft.videoFile) fd.set("video_file", cDraft.videoFile);
      if (cDraft.audioFile) fd.set("audio_file", cDraft.audioFile);
      if (cDraft.id) await api(`/modules/components/${cDraft.id}/`, { method: "PATCH", body: fd, isForm: true });
      else await api("/modules/components/", { method: "POST", body: fd, isForm: true });
      setCDraft(null);
      await loadComps();
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }
  async function delComp(c: ComponentItem) {
    if (!confirm("Supprimer ce bloc ?")) return;
    await api(`/modules/components/${c.id}/`, { method: "DELETE" });
    await loadComps();
  }

  async function saveDoc() {
    if (!dDraft) return;
    setSaving(true);
    setErr("");
    try {
      if (dDraft.file) {
        const fd = new FormData();
        fd.set("activity", String(activityId));
        fd.set("title", dDraft.title);
        fd.set("m_type", dDraft.m_type);
        fd.set("file", dDraft.file);
        await api("/modules/activity-docs/", { method: "POST", body: fd, isForm: true });
      } else {
        await api("/modules/activity-docs/", {
          method: "POST",
          body: { activity: activityId, title: dDraft.title, url: dDraft.url, m_type: Number(dDraft.m_type) },
        });
      }
      setDDraft(null);
      await loadDocs();
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }
  async function delDoc(d: ActivityDocItem) {
    if (!confirm("Supprimer ce document ?")) return;
    await api(`/modules/activity-docs/${d.id}/`, { method: "DELETE" });
    await loadDocs();
  }

  if (loading) return <div className="p-8 text-muted">Chargement…</div>;

  return (
    <div className="p-4 md:p-6">
      <Link href={`/formations/${themeId}/contenu`} className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-brand">
        <i className="bx bx-left-arrow-alt" /> Contenu de la formation
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl">Activité — {activity?.title}</h1>
        <p className="text-sm text-muted">Blocs de contenu (texte / vidéo) et documents.</p>
      </header>

      {/* Questions du quiz */}
      {isQuiz && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-deep">Questions du quiz</h2>
            {writable && (
              <div className="flex gap-2">
                <button onClick={() => { setImpResult(null); setImpFile(null); setImpOpen(true); }} className="btn-ghost text-sm" title="Importer depuis un fichier CSV / Excel / JSON">
                  <i className="bx bx-upload" /> Importer
                </button>
                <button
                  onClick={() => setQDraft(emptyQDraft())}
                  className="btn-brand text-sm"
                >
                  <i className="bx bx-plus" /> Question
                </button>
              </div>
            )}
          </div>
          {questions.length === 0 ? (
            <p className="text-sm text-muted">Aucune question.</p>
          ) : (
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={q.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{q.title}</span>
                        <span className="badge-info gap-1"><i className={`bx ${KIND_ICON[q.kind] || "bx-list-check"}`} /> {KIND_LABEL[q.kind] || "QCM"}</span>
                        <span className="text-xs text-muted">{q.points} pts</span>
                      </div>
                      {q.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={q.image} alt="" className="mt-2 h-20 rounded-lg border border-line object-cover" />
                      )}
                      <QuestionAnswersPreview q={q} />
                    </div>
                    {writable && (
                      <div className="flex gap-1">
                        <button onClick={() => setQDraft(draftFromQuestion(q))} className="btn-ghost text-xs" title="Modifier">
                          <i className="bx bx-edit" />
                        </button>
                        <button onClick={() => delQuestion(q)} className="btn-ghost text-xs text-red-500" title="Supprimer">
                          <i className="bx bx-trash" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Blocs de contenu */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-deep">Blocs de contenu</h2>
          {writable && (
            <button onClick={() => setCDraft({ title: "", paragraph: "", video_url: "", audio_url: "", imageFile: null, videoFile: null, audioFile: null })} className="btn-brand text-sm">
              <i className="bx bx-plus" /> Bloc
            </button>
          )}
        </div>
        {comps.length === 0 ? (
          <p className="text-sm text-muted">Aucun bloc.</p>
        ) : (
          <div className="space-y-2">
            {comps.map((c) => (
              <div key={c.id} className="card flex items-start gap-3 p-4">
                <i className={`bx ${c.video_url ? "bx-play-circle" : "bx-text"} mt-0.5 text-lg text-brand`} />
                <div className="min-w-0 flex-1">
                  {c.title && <div className="font-medium text-ink">{c.title}</div>}
                  {c.paragraph && <div className="line-clamp-2 text-sm text-muted">{c.paragraph}</div>}
                  {c.video_url && <div className="truncate text-xs text-accent">{c.video_url}</div>}
                  {c.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt="" className="mt-2 h-16 rounded-lg object-cover" />
                  )}
                </div>
                {writable && (
                  <div className="flex gap-1">
                    <button onClick={() => setCDraft({ id: c.id, title: c.title || "", paragraph: c.paragraph || "", video_url: c.video_url || "", audio_url: c.audio_url || "", imageFile: null, videoFile: null, audioFile: null })} className="btn-ghost text-xs">
                      <i className="bx bx-edit" />
                    </button>
                    <button onClick={() => delComp(c)} className="btn-ghost text-xs text-red-500">
                      <i className="bx bx-trash" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Documents */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-deep">Documents</h2>
          {writable && (
            <button onClick={() => setDDraft({ title: "", url: "", m_type: "1", file: null })} className="btn-brand text-sm">
              <i className="bx bx-plus" /> Document
            </button>
          )}
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-muted">Aucun document.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="card flex items-center gap-3 p-4">
                <i className="bx bxs-file-pdf text-lg text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{d.title}</div>
                  {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-accent hover:underline">{d.url}</a>}
                </div>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">{DOC_LABEL[d.m_type] || "Document"}</span>
                {writable && (
                  <button onClick={() => delDoc(d)} className="btn-ghost text-xs text-red-500">
                    <i className="bx bx-trash" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {writable && <p className="mt-3 text-xs text-muted">Uploadez directement le fichier (tous formats) ou collez un lien externe (Drive, site…).</p>}
      </section>

      {/* Modale bloc */}
      <Modal
        open={cDraft !== null}
        title={cDraft?.id ? "Modifier le bloc" : "Nouveau bloc"}
        onClose={() => setCDraft(null)}
        footer={
          <>
            <button onClick={() => setCDraft(null)} className="btn-ghost">Annuler</button>
            <button onClick={saveComp} disabled={saving} className="btn-brand disabled:opacity-50">{saving ? "…" : "Enregistrer"}</button>
          </>
        }
      >
        {cDraft && (
          <div className="space-y-4">
            <TextField label="Titre (optionnel)" value={cDraft.title} onChange={(v) => setCDraft({ ...cDraft, title: v })} />
            <TextArea label="Texte" value={cDraft.paragraph} onChange={(v) => setCDraft({ ...cDraft, paragraph: v })} rows={4} />

            <div className="rounded-lg border border-line p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500"><i className="bx bx-movie-play" /> Vidéo</p>
              <TextField label="Lien vidéo (YouTube / Vimeo / .mp4)" value={cDraft.video_url} onChange={(v) => setCDraft({ ...cDraft, video_url: v })} placeholder="https://youtu.be/…" />
              <div className="mt-2">
                <label className="label">…ou uploader une vidéo</label>
                <input type="file" accept="video/*" onChange={(e) => setCDraft({ ...cDraft, videoFile: e.target.files?.[0] ?? null })} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand" />
                {cDraft.videoFile && <p className="mt-1 text-xs text-emerald-600">{cDraft.videoFile.name}</p>}
              </div>
            </div>

            <div className="rounded-lg border border-line p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-500"><i className="bx bx-volume-full" /> Audio</p>
              <TextField label="Lien audio (SoundCloud / .mp3)" value={cDraft.audio_url} onChange={(v) => setCDraft({ ...cDraft, audio_url: v })} placeholder="https://…/audio.mp3" />
              <div className="mt-2">
                <label className="label">…ou uploader un audio</label>
                <input type="file" accept="audio/*" onChange={(e) => setCDraft({ ...cDraft, audioFile: e.target.files?.[0] ?? null })} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand" />
                {cDraft.audioFile && <p className="mt-1 text-xs text-emerald-600">{cDraft.audioFile.name}</p>}
              </div>
            </div>

            <div>
              <label className="label">Image (optionnel)</label>
              <input type="file" accept="image/*" onChange={(e) => setCDraft({ ...cDraft, imageFile: e.target.files?.[0] ?? null })} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand" />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>
        )}
      </Modal>

      {/* Modale document */}
      <Modal
        open={dDraft !== null}
        title="Nouveau document"
        onClose={() => setDDraft(null)}
        footer={
          <>
            <button onClick={() => setDDraft(null)} className="btn-ghost">Annuler</button>
            <button onClick={saveDoc} disabled={saving || (!dDraft?.url && !dDraft?.file)} className="btn-brand disabled:opacity-50">{saving ? "…" : "Ajouter"}</button>
          </>
        }
      >
        {dDraft && (
          <div className="space-y-4">
            <TextField label="Titre" value={dDraft.title} onChange={(v) => setDDraft({ ...dDraft, title: v })} />
            <div>
              <label className="label">Fichier à uploader (PDF, Word, Excel, PowerPoint, image, vidéo, audio, archive…)</label>
              <input type="file" onChange={(e) => setDDraft({ ...dDraft, file: e.target.files?.[0] ?? null })} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand" />
              {dDraft.file && <p className="mt-1 text-xs text-emerald-600">{dDraft.file.name}</p>}
            </div>
            <div className="text-center text-xs text-muted">— ou —</div>
            <TextField label="Lien du document (URL)" value={dDraft.url} onChange={(v) => setDDraft({ ...dDraft, url: v })} placeholder="https://…/fichier.pdf" />
            <SelectField label="Type" value={dDraft.m_type} onChange={(v) => setDDraft({ ...dDraft, m_type: v })} options={DOC_TYPES} />
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>
        )}
      </Modal>

      {/* Modale question */}
      <Modal
        open={qDraft !== null}
        title={qDraft?.id ? "Modifier la question" : "Nouvelle question"}
        onClose={() => setQDraft(null)}
        footer={
          <>
            <button onClick={() => setQDraft(null)} className="btn-ghost">Annuler</button>
            <button onClick={saveQuestion} disabled={saving || !qDraft?.title} className="btn-brand disabled:opacity-50">{saving ? "…" : "Enregistrer"}</button>
          </>
        }
      >
        {qDraft && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Type de question" value={qDraft.kind} onChange={(v) => setQDraft({ ...qDraft, kind: v })} options={KIND_TYPES} />
              <TextField label="Points" value={qDraft.points} onChange={(v) => setQDraft({ ...qDraft, points: v.replace(/[^0-9]/g, "") })} />
            </div>
            <TextField label="Intitulé de la question" value={qDraft.title} onChange={(v) => setQDraft({ ...qDraft, title: v })} />
            <TextField label="Consigne (optionnel)" value={qDraft.description} onChange={(v) => setQDraft({ ...qDraft, description: v })} />

            {/* Image d'énoncé (facultative, tous types) */}
            <div className="rounded-lg border border-line p-3">
              <label className="label"><i className="bx bx-image" /> Image de la question (optionnel)</label>
              {qDraft.image && !qDraft.imageClear && !qDraft.imageFile && (
                <div className="mb-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qDraft.image} alt="" className="h-16 rounded border border-line object-cover" />
                  <button onClick={() => setQDraft({ ...qDraft, imageClear: true })} className="btn-ghost text-xs text-red-500"><i className="bx bx-trash" /> Retirer</button>
                </div>
              )}
              <input type="file" accept="image/*" onChange={(e) => setQDraft({ ...qDraft, imageFile: e.target.files?.[0] ?? null, imageClear: false })} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand" />
              {qDraft.imageFile && <p className="mt-1 text-xs text-emerald-600">{qDraft.imageFile.name}</p>}
            </div>

            {/* ------- Éditeur selon le type ------- */}
            {qDraft.kind === KIND_QCM && (
              <div>
                <SelectField label="Mode de réponse" value={qDraft.input_type} onChange={(v) => setQDraft({ ...qDraft, input_type: v })} options={INPUT_TYPES} />
                <label className="label mt-3">Réponses (cochez la/les bonne(s), image d&apos;option possible)</label>
                <div className="space-y-2">
                  {qDraft.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type={qDraft.input_type === "1" ? "checkbox" : "radio"}
                        name="correct"
                        checked={o.is_answer}
                        onChange={() =>
                          setQDraft((d) => d ? { ...d, options: d.options.map((x, k) => d.input_type === "1" ? (k === i ? { ...x, is_answer: !x.is_answer } : x) : { ...x, is_answer: k === i }) } : d)
                        }
                        className="accent-brand"
                        title="Bonne réponse"
                      />
                      <input className="input flex-1" value={o.title} placeholder={`Réponse ${i + 1}`} onChange={(e) => setOpt(i, { title: e.target.value })} />
                      <label className="shrink-0 cursor-pointer rounded-lg bg-brand-soft px-2 py-1.5 text-xs font-semibold text-brand" title="Image de cette option">
                        <i className="bx bx-image-add" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setOpt(i, { file: e.target.files?.[0] ?? null })} />
                      </label>
                      <button onClick={() => setQDraft((d) => (d ? { ...d, options: d.options.filter((_, k) => k !== i) } : d))} className="btn-ghost text-red-500" title="Retirer">
                        <i className="bx bx-x" />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Vignettes des images d'option (nouvelles ou existantes) */}
                {qDraft.options.some((o) => o.file || o.image) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {qDraft.options.map((o, i) => (o.file || o.image) ? (
                      <span key={i} className="inline-flex items-center gap-1 rounded bg-brand-soft/60 px-2 py-1 text-xs text-brand">
                        R{i + 1} : {o.file ? o.file.name : "image actuelle"}
                        <button onClick={() => setOpt(i, { file: null, image: null })} className="text-red-500"><i className="bx bx-x" /></button>
                      </span>
                    ) : null)}
                  </div>
                )}
                <button onClick={() => setQDraft((d) => (d ? { ...d, options: [...d.options, { title: "", is_answer: false }] } : d))} className="mt-2 text-sm font-semibold text-accent">
                  <i className="bx bx-plus" /> Ajouter une réponse
                </button>
              </div>
            )}

            {qDraft.kind === KIND_TF && (
              <div>
                <label className="label">Bonne réponse</label>
                <div className="flex gap-2">
                  <button onClick={() => setQDraft({ ...qDraft, correct: true })} className={`btn flex-1 ${qDraft.correct ? "bg-green-600 text-white" : "border border-line bg-white text-ink"}`}>
                    <i className="bx bx-check" /> Vrai
                  </button>
                  <button onClick={() => setQDraft({ ...qDraft, correct: false })} className={`btn flex-1 ${!qDraft.correct ? "bg-red-600 text-white" : "border border-line bg-white text-ink"}`}>
                    <i className="bx bx-x" /> Faux
                  </button>
                </div>
              </div>
            )}

            {(qDraft.kind === KIND_TEXT || qDraft.kind === KIND_NUM) && (
              <div>
                <label className="label">
                  {qDraft.kind === KIND_NUM ? "Valeurs acceptées (ex. « 3.14 » ou « 3.14|0.01 » avec tolérance)" : "Réponses acceptées (toutes les orthographes valides)"}
                </label>
                <div className="space-y-2">
                  {qDraft.accepted.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className="input flex-1" value={a} placeholder={qDraft.kind === KIND_NUM ? "42  ou  42|0.5" : `Réponse acceptée ${i + 1}`}
                        onChange={(e) => setQDraft((d) => d ? { ...d, accepted: d.accepted.map((x, k) => k === i ? e.target.value : x) } : d)} />
                      <button onClick={() => setQDraft((d) => (d ? { ...d, accepted: d.accepted.filter((_, k) => k !== i) } : d))} className="btn-ghost text-red-500"><i className="bx bx-x" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setQDraft((d) => (d ? { ...d, accepted: [...d.accepted, ""] } : d))} className="mt-2 text-sm font-semibold text-accent"><i className="bx bx-plus" /> Ajouter une variante</button>
              </div>
            )}

            {qDraft.kind === KIND_ASSOC && (
              <div>
                <label className="label">Paires à relier (gauche → droite)</label>
                <div className="space-y-2">
                  {qDraft.pairs.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className="input flex-1" value={p.left} placeholder="Élément" onChange={(e) => setQDraft((d) => d ? { ...d, pairs: d.pairs.map((x, k) => k === i ? { ...x, left: e.target.value } : x) } : d)} />
                      <i className="bx bx-right-arrow-alt text-muted" />
                      <input className="input flex-1" value={p.right} placeholder="Correspond à" onChange={(e) => setQDraft((d) => d ? { ...d, pairs: d.pairs.map((x, k) => k === i ? { ...x, right: e.target.value } : x) } : d)} />
                      <button onClick={() => setQDraft((d) => (d ? { ...d, pairs: d.pairs.filter((_, k) => k !== i) } : d))} className="btn-ghost text-red-500"><i className="bx bx-x" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setQDraft((d) => (d ? { ...d, pairs: [...d.pairs, { left: "", right: "" }] } : d))} className="mt-2 text-sm font-semibold text-accent"><i className="bx bx-plus" /> Ajouter une paire</button>
              </div>
            )}

            {qDraft.kind === KIND_ORDER && (
              <div>
                <label className="label">Éléments dans le bon ordre (l&apos;apprenant devra les remettre en ordre)</label>
                <div className="space-y-2">
                  {qDraft.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                      <input className="input flex-1" value={it} placeholder={`Élément ${i + 1}`} onChange={(e) => setQDraft((d) => d ? { ...d, items: d.items.map((x, k) => k === i ? e.target.value : x) } : d)} />
                      <button disabled={i === 0} onClick={() => setQDraft((d) => { if (!d || i === 0) return d; const a = [...d.items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...d, items: a }; })} className="btn-ghost text-xs disabled:opacity-30" title="Monter"><i className="bx bx-up-arrow-alt" /></button>
                      <button disabled={i === qDraft.items.length - 1} onClick={() => setQDraft((d) => { if (!d || i === d.items.length - 1) return d; const a = [...d.items]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return { ...d, items: a }; })} className="btn-ghost text-xs disabled:opacity-30" title="Descendre"><i className="bx bx-down-arrow-alt" /></button>
                      <button onClick={() => setQDraft((d) => (d ? { ...d, items: d.items.filter((_, k) => k !== i) } : d))} className="btn-ghost text-red-500"><i className="bx bx-x" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setQDraft((d) => (d ? { ...d, items: [...d.items, ""] } : d))} className="mt-2 text-sm font-semibold text-accent"><i className="bx bx-plus" /> Ajouter un élément</button>
              </div>
            )}

            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>
        )}
      </Modal>

      {/* Modale import de quiz */}
      <Modal
        open={impOpen}
        title="Importer des questions"
        onClose={() => setImpOpen(false)}
        footer={
          <>
            <button onClick={() => setImpOpen(false)} className="btn-ghost">Fermer</button>
            <button onClick={runImport} disabled={saving || !impFile} className="btn-brand disabled:opacity-50">
              {saving ? "Import…" : "Importer"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Chargez un fichier <strong>CSV</strong>, <strong>Excel (.xlsx)</strong> ou <strong>JSON</strong> contenant vos questions.
            Chaque ligne = une question, avec ses options et la (les) bonne(s) réponse(s).
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => downloadTemplate("csv")} className="btn-ghost text-xs"><i className="bx bx-download" /> Modèle CSV</button>
            <button onClick={() => downloadTemplate("xlsx")} className="btn-ghost text-xs"><i className="bx bx-download" /> Modèle Excel</button>
          </div>
          <div>
            <label className="label">Fichier de questions</label>
            <input
              type="file"
              accept=".csv,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { setImpFile(e.target.files?.[0] ?? null); setImpResult(null); }}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand"
            />
            {impFile && <p className="mt-1 text-xs text-emerald-600">{impFile.name}</p>}
          </div>
          {impResult && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <i className="bx bx-check-circle" /> {impResult.imported} question(s) importée(s).
              {impResult.errors?.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
                  {impResult.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <p className="text-xs text-muted">
            Colonnes attendues (CSV/Excel) : <code>question, option1…option6, correct, points, type</code>.
            <br />« correct » = n° des bonnes réponses (ex. « 2 » ou « 1,3 ») · « type » = radio (unique) ou checkbox (multiple).
          </p>
        </div>
      </Modal>
    </div>
  );
}
