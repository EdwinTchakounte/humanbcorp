"use client";

import { useEffect, useState } from "react";
import {
  getMySpace,
  getMyFormation,
  submitQuiz,
  markActivity,
  type MySpace,
  type MyFormation,
  type LearnerActivity,
  type LearnerSeance,
  type LearnerDoc,
  type SubmitQuizResponse,
} from "@/lib/api";
import Souscrire from "./Souscrire";

const SEANCE_TYPE: Record<number, string> = { 0: "Théorie", 1: "Pratique", 2: "Exercice" };
const DOC_TYPE: Record<number, string> = { 1: "Cours", 2: "Exercice", 3: "Réponse", 4: "Correction" };
const MEET_TYPE: Record<number, string> = { 0: "Google Meet", 1: "Zoom", 2: "Présentiel" };

function fmtDateTime(iso: string) {
  return iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "";
}

function fmtDate(iso: string) {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "long" }) : "";
}

type OnComplete = (activityId: number, completed: boolean) => void;

function toEmbed(url: string): { kind: "iframe" | "video" | "link"; src: string } {
  const u = url.trim();
  // YouTube : watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  // Vimeo : vimeo.com/ID
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  // Fichier vidéo direct
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: "video", src: u };
  return { kind: "link", src: u };
}

function VideoEmbed({ url }: { url: string }) {
  const { kind, src } = toEmbed(url);
  if (kind === "iframe")
    return (
      <div className="relative mt-2 aspect-video overflow-hidden rounded-lg bg-black">
        <iframe
          src={src}
          title="Vidéo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  if (kind === "video")
    return <video src={src} controls className="mt-2 w-full rounded-lg" />;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent">
      <i className="bx bx-play-circle text-lg" /> Voir la vidéo
    </a>
  );
}

function AudioBlock({ url }: { url: string }) {
  // Fichier audio direct → lecteur natif.
  if (/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(url)) {
    return <audio src={url} controls className="mt-2 w-full" />;
  }
  // SoundCloud → embed iframe.
  if (/soundcloud\.com/i.test(url)) {
    return (
      <iframe
        title="Audio"
        className="mt-2 w-full rounded-lg"
        height={120}
        allow="autoplay"
        src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%231E3A8A&visual=false`}
      />
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent">
      <i className="bx bx-volume-full text-lg" /> Écouter l’audio
    </a>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
        <div
          className={`h-full rounded-full transition-all ${percent === 100 ? "bg-green-500" : "bg-accent"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-semibold text-muted">{percent}%</span>
    </div>
  );
}

// Détecte la nature d'un fichier depuis son extension / type MIME.
function fileKind(url: string | null, mime?: string): { kind: string; icon: string; color: string } {
  const ext = (url || "").split("?")[0].split(".").pop()?.toLowerCase() || "";
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
    return { kind: "image", icon: "bxs-image", color: "text-emerald-500" };
  if (m.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext))
    return { kind: "video", icon: "bxs-videos", color: "text-purple-500" };
  if (m.startsWith("audio/") || ["mp3", "wav", "m4a", "aac", "flac"].includes(ext))
    return { kind: "audio", icon: "bxs-music", color: "text-pink-500" };
  if (m === "application/pdf" || ext === "pdf")
    return { kind: "pdf", icon: "bxs-file-pdf", color: "text-red-500" };
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return { kind: "word", icon: "bxs-file-doc", color: "text-blue-600" };
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return { kind: "excel", icon: "bxs-spreadsheet", color: "text-green-600" };
  if (["ppt", "pptx", "odp"].includes(ext)) return { kind: "ppt", icon: "bxs-slideshow", color: "text-orange-500" };
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return { kind: "archive", icon: "bxs-file-archive", color: "text-amber-600" };
  return { kind: "other", icon: "bxs-file", color: "text-muted" };
}

function DocRow({ d }: { d: LearnerDoc }) {
  const { kind, icon, color } = fileKind(d.url, d.mime_type);
  const badge = (
    <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">
      {DOC_TYPE[d.m_type] || "Document"}
    </span>
  );

  // Médias : aperçu inline directement dans l'espace apprenant.
  if (d.url && (kind === "image" || kind === "video" || kind === "audio")) {
    return (
      <div className="overflow-hidden rounded-xl border border-line/70 bg-white text-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <i className={`bx ${icon} text-xl ${color}`} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{d.title}</span>
            {d.description && <span className="block truncate text-xs text-muted">{d.description}</span>}
          </span>
          {badge}
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted hover:text-brand" title="Ouvrir / télécharger">
            <i className="bx bx-download" />
          </a>
        </div>
        <div className="bg-brand-soft/40 px-4 pb-4">
          {kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.url} alt={d.title} className="max-h-96 w-auto rounded-lg" />
          )}
          {kind === "video" && <video controls src={d.url} className="max-h-96 w-full rounded-lg" />}
          {kind === "audio" && <audio controls src={d.url} className="w-full" />}
        </div>
      </div>
    );
  }

  // Autres formats (PDF, Word, Excel, PowerPoint, archives…) : ouverture / téléchargement.
  return (
    <a
      href={d.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-line/70 bg-white px-4 py-3 text-sm transition hover:border-brand hover:shadow-hbc-sm"
    >
      <i className={`bx ${icon} text-xl ${color}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{d.title}</span>
        {d.description && <span className="block truncate text-xs text-muted">{d.description}</span>}
      </span>
      {badge}
      <i className={`bx ${kind === "pdf" ? "bx-link-external" : "bx-download"} text-muted`} />
    </a>
  );
}

function QuizBlock({
  activity,
  token,
  onComplete,
}: {
  activity: LearnerActivity;
  token: string;
  onComplete: OnComplete;
}) {
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [result, setResult] = useState<SubmitQuizResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = result !== null;

  function toggle(questionId: number, optionId: number, isCheckbox: boolean) {
    if (locked) return;
    setAnswers((prev) => {
      const cur = prev[questionId] || [];
      if (isCheckbox) {
        return { ...prev, [questionId]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  }

  async function onSubmit() {
    setBusy(true);
    const res = await submitQuiz(token, activity.id, answers);
    setBusy(false);
    if (res) {
      setResult(res);
      onComplete(activity.id, true); // un quiz soumis marque l'activité terminée
    }
  }

  function reset() {
    setAnswers({});
    setResult(null);
  }

  const byQuestion = (qid: number) => result?.results.find((r) => r.question_id === qid);

  return (
    <div className="space-y-4">
      {result && (
        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 font-semibold ${
            result.score === result.max_score ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          <i className={`bx ${result.score === result.max_score ? "bx-trophy" : "bx-bar-chart-alt-2"} text-xl`} />
          Votre score : {result.score} / {result.max_score}
        </div>
      )}
      {!result && activity.last_attempt && (
        <p className="text-xs text-muted">
          Dernier score : {activity.last_attempt.score} / {activity.last_attempt.max_score}
        </p>
      )}

      {activity.questions.map((q) => {
        const r = byQuestion(q.id);
        return (
          <div key={q.id} className="rounded-xl border border-line/70 bg-white p-4">
            <p className="font-medium text-ink">
              {q.number}. {q.title}{" "}
              {q.points > 0 && <span className="text-xs font-normal text-muted">({q.points} pts)</span>}
              {r && (
                <i className={`bx ml-1 ${r.is_correct ? "bx-check text-green-600" : "bx-x text-red-500"}`} />
              )}
            </p>
            {q.description && <p className="mb-2 text-sm text-muted">{q.description}</p>}
            <ul className="mt-2 space-y-1.5">
              {q.options.map((o) => {
                const isCheckbox = o.input_type === 1;
                const selected = (answers[q.id] || []).includes(o.id);
                // Après correction : vert = bonne réponse, rouge = cochée mais fausse
                let tone = "";
                if (r) {
                  if (r.correct_option_ids.includes(o.id)) tone = "text-green-700 font-medium";
                  else if (r.selected_option_ids.includes(o.id)) tone = "text-red-600 line-through";
                }
                return (
                  <li key={o.id} className={`flex items-center gap-2 text-sm ${tone || "text-ink"}`}>
                    <input
                      type={isCheckbox ? "checkbox" : "radio"}
                      name={`q-${q.id}`}
                      checked={selected}
                      disabled={locked}
                      onChange={() => toggle(q.id, o.id, isCheckbox)}
                      className="accent-brand"
                    />
                    {o.title}
                    {r && r.correct_option_ids.includes(o.id) && <i className="bx bx-check text-green-600" />}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {!result ? (
        <button onClick={onSubmit} disabled={busy} className="btn-brand text-sm disabled:opacity-50">
          {busy ? "Validation…" : "Valider mes réponses"}
        </button>
      ) : (
        <button onClick={reset} className="btn-ghost text-sm">
          <i className="bx bx-refresh" /> Recommencer
        </button>
      )}
    </div>
  );
}

function ActivityBlock({ a, token, onComplete }: { a: LearnerActivity; token: string; onComplete: OnComplete }) {
  const isQuiz = a.questions.length > 0;
  const [marking, setMarking] = useState(false);

  async function toggleDone() {
    setMarking(true);
    const ok = await markActivity(token, a.id, !a.completed);
    setMarking(false);
    if (ok) onComplete(a.id, !a.completed);
  }

  return (
    <div className="rounded-2xl border border-line/70 bg-brand-soft/40 p-5">
      <h4 className="mb-3 flex items-center gap-2 font-semibold text-brand-deep">
        {a.type === 1 ? <i className="bx bx-help-circle" /> : <i className="bx bx-book-open" />}
        {a.title}
        {a.completed && <i className="bx bxs-check-circle ml-auto text-lg text-green-600" title="Terminé" />}
      </h4>

      {/* Blocs de contenu (texte / image / vidéo / audio) */}
      {a.components.map((c) => (
        <div key={c.id} className="mb-3">
          {c.title && <p className="font-medium text-ink">{c.title}</p>}
          {c.paragraph && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{c.paragraph}</p>}
          {c.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image} alt={c.title} className="mt-2 max-w-full rounded-lg" />
          )}
          {c.video_url && <VideoEmbed url={c.video_url} />}
          {c.video_file && <video src={c.video_file} controls className="mt-2 w-full rounded-lg" />}
          {c.audio_url && <AudioBlock url={c.audio_url} />}
          {c.audio_file && <audio src={c.audio_file} controls className="mt-2 w-full" />}
        </div>
      ))}

      {/* Documents (PDF / liens) */}
      {a.documents.length > 0 && (
        <div className="grid gap-2">
          {a.documents.map((d) => (
            <DocRow key={d.id} d={d} />
          ))}
        </div>
      )}

      {/* Quiz interactif + notation */}
      {isQuiz && <QuizBlock activity={a} token={token} onComplete={onComplete} />}

      {/* Marquer comme terminé (activités non-quiz : le quiz s'auto-complète) */}
      {!isQuiz && (
        <button
          onClick={toggleDone}
          disabled={marking}
          className={`mt-4 text-sm font-semibold disabled:opacity-50 ${
            a.completed ? "text-muted hover:text-brand-deep" : "text-accent"
          }`}
        >
          <i className={`bx ${a.completed ? "bx-undo" : "bx-check"}`} />{" "}
          {a.completed ? "Marquer comme non terminé" : "Marquer comme terminé"}
        </button>
      )}
    </div>
  );
}

function SeanceBlock({ s, token, onComplete }: { s: LearnerSeance; token: string; onComplete: OnComplete }) {
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
          {s.index}
        </span>
        <div>
          <h3 className="text-lg leading-tight">{s.title}</h3>
          <span className="text-xs text-muted">{SEANCE_TYPE[s.type] || ""}</span>
        </div>
      </div>
      {s.documents.length > 0 && (
        <div className="mb-4 grid gap-2">
          {s.documents.map((d) => (
            <DocRow key={d.id} d={d} />
          ))}
        </div>
      )}
      <div className="space-y-4">
        {s.activities.map((a) => (
          <ActivityBlock key={a.id} a={a} token={token} onComplete={onComplete} />
        ))}
      </div>
    </div>
  );
}

/**
 * Abonnement agenda. On ne propose pas un téléchargement : un fichier est une
 * copie, et une séance déplacée ne bougerait pas dans l'agenda de l'apprenant.
 * Un abonnement, lui, se resynchronise tout seul.
 */
function AbonnementAgenda({ url }: { url: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [copie, setCopie] = useState(false);
  // webcal:// fait proposer l'abonnement directement par le système, là où
  // https:// ferait télécharger un fichier figé.
  const webcal = url.replace(/^https?:\/\//, "webcal://");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : l'URL reste
      // sélectionnable à la main juste au-dessus.
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-brand/20 bg-brand-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
          <i className="bx bx-calendar-plus text-lg" />
          Ajoutez vos séances à votre agenda
        </p>
        <button onClick={() => setOuvert((o) => !o)} className="text-sm font-semibold text-accent">
          {ouvert ? "Masquer" : "Comment faire ?"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Vos séances apparaissent dans votre agenda et se mettent à jour toutes seules si une date change.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={google} target="_blank" rel="noopener noreferrer" className="btn-accent text-sm">
          <i className="bx bxl-google" /> Google Agenda
        </a>
        <a href={webcal} className="btn-ghost text-sm">
          <i className="bx bx-mobile-alt" /> Apple / Outlook
        </a>
        <button onClick={copier} className="btn-ghost text-sm">
          <i className={`bx ${copie ? "bx-check" : "bx-copy"}`} /> {copie ? "Lien copié" : "Copier le lien"}
        </button>
      </div>

      {ouvert && (
        <div className="mt-4 border-t border-brand/15 pt-3 text-sm text-muted">
          <p className="font-medium text-ink">Si le bouton ne fonctionne pas :</p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Copiez le lien ci-dessous.</li>
            <li>Dans Google Agenda : <strong>Autres agendas</strong> → <strong>À partir de l&apos;URL</strong>.</li>
            <li>Collez le lien, puis validez.</li>
          </ol>
          <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-ink">{url}</p>
          <p className="mt-2 text-xs">
            Gardez ce lien pour vous : il donne accès à votre planning. Google actualise
            généralement les agendas abonnés une à deux fois par jour.
          </p>
        </div>
      )}
    </div>
  );
}

export default function LearnerSpace({ token }: { token: string }) {
  const [space, setSpace] = useState<MySpace | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [content, setContent] = useState<MyFormation | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [onglet, setOnglet] = useState<"formations" | "souscrire">("formations");

  /** Après un achat, la liste des formations a changé : on la relit. */
  async function rechargerEspace() {
    const s = await getMySpace(token);
    if (s) setSpace(s);
  }

  useEffect(() => {
    getMySpace(token)
      .then((s) => {
        if (!s) {
          setInvalid(true);
          return;
        }
        setSpace(s);
        // Auto-ouvre le contenu s'il n'y a qu'une seule formation.
        const withContent = s.formations.filter((f) => f.has_content);
        if (withContent.length === 1) openFormation(withContent[0].publication_id);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function openFormation(pubId: number) {
    if (openId === pubId) {
      setOpenId(null);
      setContent(null);
      return;
    }
    setOpenId(pubId);
    setContent(null);
    setLoadingContent(true);
    const c = await getMyFormation(token, pubId);
    setContent(c);
    setLoadingContent(false);
  }

  // Met à jour la progression localement (sans recharger → préserve l'état du quiz).
  function patchCompleted(activityId: number, completed: boolean) {
    setContent((prev) => {
      if (!prev) return prev;
      let gDone = 0;
      let gTotal = 0;
      const themes = prev.themes.map((th) => {
        let done = 0;
        let total = 0;
        const seances = th.seances.map((s) => ({
          ...s,
          activities: s.activities.map((a) => {
            const c = a.id === activityId ? completed : a.completed;
            total += 1;
            if (c) done += 1;
            return a.id === activityId ? { ...a, completed } : a;
          }),
        }));
        gDone += done;
        gTotal += total;
        return { ...th, seances, progress: { done, total, percent: total ? Math.round((100 * done) / total) : 0 } };
      });
      const gPercent = gTotal ? Math.round((100 * gDone) / gTotal) : 0;
      setSpace((sp) =>
        sp
          ? {
              ...sp,
              formations: sp.formations.map((f) =>
                f.publication_id === prev.publication_id
                  ? { ...f, progress: { done: gDone, total: gTotal, percent: gPercent } }
                  : f
              ),
            }
          : sp
      );
      return { ...prev, themes };
    });
  }

  if (loading) return <p className="text-muted">Chargement…</p>;

  if (invalid || !space)
    return (
      <div className="card p-8 text-center">
        <i className="bx bx-error-circle mb-3 text-4xl text-accent" />
        <h2 className="text-xl">Lien d’accès invalide ou expiré</h2>
        <p className="mt-2 text-muted">
          Vérifiez le lien reçu par e-mail, ou contactez-nous si le problème persiste.
        </p>
      </div>
    );

  return (
    <div>
      <header className="mb-6">
        <p className="eyebrow">Mon espace</p>
        <h1 className="mt-2 text-3xl md:text-4xl">Bonjour {space.learner.name} 👋</h1>
        <p className="mt-3 text-muted">
          Retrouvez ici le contenu de vos formations, et inscrivez-vous à de nouvelles.
        </p>
      </header>

      {/* Deux usages distincts — apprendre / s'inscrire — donc deux onglets.
          Les mêler noierait le catalogue commercial sous le contenu pédagogique. */}
      <div className="mb-8 flex gap-1 border-b border-line" role="tablist">
        {(
          [
            ["formations", "Mes formations", "bx-book-open"],
            ["souscrire", "S’inscrire à une formation", "bx-cart-add"],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={onglet === id}
            onClick={() => setOnglet(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 font-heading text-sm font-semibold transition ${
              onglet === id
                ? "border-accent text-brand-deep"
                : "border-transparent text-muted hover:text-brand"
            }`}
          >
            <i className={`bx ${icon} text-lg`} />
            {label}
          </button>
        ))}
      </div>

      {onglet === "souscrire" ? (
        <Souscrire token={token} onChangement={rechargerEspace} />
      ) : (
        <>
      {/* Abonnement agenda : proposé seulement s'il y a des séances à suivre. */}
      {space.agenda_url && space.formations.length > 0 && (
        <AbonnementAgenda url={space.agenda_url} />
      )}

      {space.formations.length === 0 ? (
        <p className="text-muted">Aucune formation confirmée pour le moment.</p>
      ) : (
        <div className="space-y-4">
          {space.formations.map((f) => (
            <div key={f.publication_id} className="card overflow-hidden">
              <button
                onClick={() => f.has_content && !f.acces_expire && openFormation(f.publication_id)}
                className="flex w-full items-center gap-4 p-5 text-left"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${f.acces_expire ? "bg-gray-100 text-gray-400" : "bg-brand-soft text-brand"}`}>
                  <i className={`bx ${f.acces_expire ? "bx-lock-alt" : "bxs-graduation"}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg leading-tight">{f.title}</h3>
                  {/* L'offre expirée reste listée : l'apprenant doit comprendre
                      pourquoi elle est fermée plutôt que de la voir disparaître. */}
                  {f.acces_expire ? (
                    <p className="truncate text-sm font-medium text-amber-700">
                      Accès terminé{f.acces_fin ? ` le ${fmtDate(f.acces_fin)}` : ""}
                    </p>
                  ) : f.has_content && f.progress.total > 0 ? (
                    <div className="mt-2 max-w-xs">
                      <ProgressBar percent={f.progress.percent} />
                    </div>
                  ) : (
                    <p className="truncate text-sm text-muted">
                      {f.has_content ? "Contenu disponible" : "Contenu en préparation"}
                    </p>
                  )}
                  {!f.acces_expire && f.acces_fin && (
                    <p className="mt-1 text-xs text-muted">
                      <i className="bx bx-time-five" /> Accès jusqu&apos;au {fmtDate(f.acces_fin)}
                    </p>
                  )}
                </div>
                {f.has_content && !f.acces_expire && (
                  <i
                    className={`bx bx-chevron-down text-2xl text-muted transition ${
                      openId === f.publication_id ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {openId === f.publication_id && (
                <div className="border-t border-line bg-brand-soft/30 p-5">
                  {loadingContent ? (
                    <p className="text-muted">Chargement du contenu…</p>
                  ) : !content || content.themes.length === 0 ? (
                    <p className="text-muted">Le contenu de cette formation n’est pas encore disponible.</p>
                  ) : (
                    <div className="space-y-8">
                      {content.schedule.length > 0 && (
                        <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-4">
                          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-deep">
                            <i className="bx bx-calendar" /> Planning des séances
                          </p>
                          <ul className="space-y-2">
                            {content.schedule.map((ev) => {
                              const link = ev.meetings.find((m) => m.link_url)?.link_url;
                              // Le badge doit décrire la visio qu'on propose de rejoindre,
                              // pas un autre rendez-vous du même créneau.
                              const shown = ev.meetings.find((m) => m.link_url) ?? ev.meetings[0];
                              return (
                                <li key={ev.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                  {/* Le créneau qui couvre une séance du programme
                                      l'annonce : l'apprenant relie une date à un
                                      chapitre plutôt qu'à un titre d'événement. */}
                                  {ev.seance_order != null && (
                                    <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
                                      Séance {ev.seance_order}
                                    </span>
                                  )}
                                  <span className="font-medium text-ink">{ev.seance_title || ev.title}</span>
                                  <span className="text-muted">{fmtDateTime(ev.start_time)}</span>
                                  {shown && (
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-brand">
                                      {MEET_TYPE[shown.m_type] ?? ""}
                                    </span>
                                  )}
                                  {link && (
                                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">
                                      <i className="bx bx-video" /> Rejoindre
                                    </a>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      {content.themes.map((th) => (
                        <div key={th.id}>
                          <h2 className="mb-2 text-2xl">{th.title}</h2>
                          {th.progress.total > 0 && (
                            <div className="mb-4 max-w-sm">
                              <ProgressBar percent={th.progress.percent} />
                            </div>
                          )}
                          {th.objectifs.length > 0 && (
                            <div className="mb-4 rounded-xl border border-line/70 bg-white p-4">
                              <p className="mb-1 text-sm font-semibold text-brand-deep">Objectifs</p>
                              <ul className="list-inside list-disc text-sm text-muted">
                                {th.objectifs.map((o, i) => (
                                  <li key={i}>{o}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="space-y-4">
                            {th.seances.map((s) => (
                              <SeanceBlock key={s.id} s={s} token={token} onComplete={patchCompleted} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
