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
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({});
  // Association : {questionId: {leftId: rightText}}. Ordonnancement : {questionId: [ids ordonnés]}.
  const [matchAnswers, setMatchAnswers] = useState<Record<number, Record<number, string>>>({});
  const [orderAnswers, setOrderAnswers] = useState<Record<number, number[]>>({});
  const [result, setResult] = useState<SubmitQuizResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = result !== null;

  // Ordre courant d'une question d'ordonnancement (état, sinon ordre servi).
  const orderOf = (q: LearnerActivity["questions"][number]) =>
    orderAnswers[q.id] ?? (q.order_items ?? []).map((i) => i.id);

  function moveOrder(qid: number, arr: number[], idx: number, dir: -1 | 1) {
    if (locked) return;
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    const next = [...arr];
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrderAnswers((p) => ({ ...p, [qid]: next }));
  }

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
    // Fusionne réponses à options (QCM/VF) et saisies (texte/numérique).
    const payload: Record<number, unknown> = {};
    for (const q of activity.questions) {
      if (q.kind === 3 || q.kind === 4) {
        const v = (textAnswers[q.id] ?? "").trim();
        if (v) payload[q.id] = [v];
      } else if (q.kind === 5) {
        const m = matchAnswers[q.id] || {};
        if (Object.keys(m).length) payload[q.id] = m;
      } else if (q.kind === 6) {
        payload[q.id] = orderOf(q); // toujours un ordre (celui servi si non touché)
      } else {
        const ids = answers[q.id] || [];
        if (ids.length) payload[q.id] = ids;
      }
    }
    setBusy(true);
    const res = await submitQuiz(token, activity.id, payload);
    setBusy(false);
    if (res) {
      setResult(res);
      onComplete(activity.id, true); // un quiz soumis marque l'activité terminée
    }
  }

  function reset() {
    setAnswers({});
    setTextAnswers({});
    setMatchAnswers({});
    setOrderAnswers({});
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
            {q.image && (
              // Illustration de l'énoncé.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.image} alt="" className="mb-3 max-h-64 w-auto rounded-lg border border-line/70" />
            )}

            {q.kind === 5 ? (
              // Association : chaque élément gauche → menu déroulant des choix.
              <div className="mt-2 space-y-2">
                {(q.match_left ?? []).map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 rounded-lg bg-brand-soft/40 px-3 py-2 text-sm font-medium text-ink">
                      {l.text}
                    </span>
                    <i className="bx bx-right-arrow-alt shrink-0 text-muted" />
                    <select
                      disabled={locked}
                      value={matchAnswers[q.id]?.[l.id] ?? ""}
                      onChange={(e) =>
                        setMatchAnswers((p) => ({ ...p, [q.id]: { ...(p[q.id] || {}), [l.id]: e.target.value } }))
                      }
                      className="hbc-input w-[45%] shrink-0"
                    >
                      <option value="">—</option>
                      {(q.match_right ?? []).map((rt, i) => (
                        <option key={i} value={rt}>
                          {rt}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {r && r.correct_pairs && (
                  <div
                    className={`mt-2 rounded-lg px-3 py-2 text-sm ${
                      r.is_correct ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {r.is_correct ? (
                      <p className="font-medium">
                        <i className="bx bx-check" /> Associations correctes
                      </p>
                    ) : (
                      <>
                        <p className="font-medium">Bonnes associations :</p>
                        <ul className="mt-1 list-inside list-disc">
                          {r.correct_pairs.map((p, i) => (
                            <li key={i}>
                              {p.left} → {p.right}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : q.kind === 6 ? (
              // Ordonnancement : monter / descendre chaque élément.
              <div className="mt-2 space-y-2">
                {orderOf(q).map((id, idx, arr) => {
                  const item = (q.order_items ?? []).find((i) => i.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 rounded-lg border border-line/70 bg-white px-3 py-2 text-sm"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">{item?.text}</span>
                      <button
                        type="button"
                        disabled={locked || idx === 0}
                        onClick={() => moveOrder(q.id, arr, idx, -1)}
                        aria-label="Monter"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand disabled:opacity-30"
                      >
                        <i className="bx bx-chevron-up text-lg" />
                      </button>
                      <button
                        type="button"
                        disabled={locked || idx === arr.length - 1}
                        onClick={() => moveOrder(q.id, arr, idx, 1)}
                        aria-label="Descendre"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand disabled:opacity-30"
                      >
                        <i className="bx bx-chevron-down text-lg" />
                      </button>
                    </div>
                  );
                })}
                {r && r.is_correct && (
                  <p className="mt-2 text-sm font-medium text-green-700">
                    <i className="bx bx-check" /> Ordre correct
                  </p>
                )}
                {r && !r.is_correct && r.correct_order && (
                  <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <p className="font-medium">Ordre correct :</p>
                    <ol className="mt-1 list-inside list-decimal">
                      {r.correct_order.map((tx, i) => (
                        <li key={i}>{tx}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : q.kind === 3 || q.kind === 4 ? (
              // Texte libre / numérique : saisie directe.
              <div className="mt-2">
                <input
                  type={q.kind === 4 ? "number" : "text"}
                  inputMode={q.kind === 4 ? "decimal" : "text"}
                  value={textAnswers[q.id] ?? ""}
                  disabled={locked}
                  onChange={(e) => setTextAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                  placeholder={q.kind === 4 ? "Votre réponse (nombre)" : "Votre réponse"}
                  className="hbc-input max-w-sm"
                />
                {r && (
                  <p className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${r.is_correct ? "text-green-700" : "text-red-600"}`}>
                    {r.is_correct ? (
                      <>
                        <i className="bx bx-check text-lg" /> Bonne réponse
                      </>
                    ) : (
                      <>
                        <i className="bx bx-x text-lg" /> Réponse attendue&nbsp;: {(r.correct_values || []).join("  /  ")}
                      </>
                    )}
                  </p>
                )}
              </div>
            ) : q.kind === 2 ? (
              // Vrai / Faux : deux gros boutons.
              <div className="mt-2 grid grid-cols-2 gap-3">
                {q.options.map((o) => {
                  const selected = (answers[q.id] || []).includes(o.id);
                  const isVrai = /^(vrai|true|oui|yes)/i.test(o.title.trim());
                  let cls = selected
                    ? "border-accent bg-accent/10 text-brand-deep ring-2 ring-accent/40"
                    : "border-line/70 text-ink hover:border-brand";
                  if (r) {
                    if (r.correct_option_ids.includes(o.id)) cls = "border-green-500 bg-green-50 text-green-700";
                    else if (r.selected_option_ids.includes(o.id)) cls = "border-red-400 bg-red-50 text-red-600";
                  }
                  return (
                    <button
                      type="button"
                      key={o.id}
                      disabled={locked}
                      onClick={() => toggle(q.id, o.id, false)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-5 font-heading text-base font-semibold transition disabled:cursor-default ${cls}`}
                    >
                      <i className={`bx ${isVrai ? "bx-check-circle" : "bx-x-circle"} text-3xl`} />
                      {o.title}
                    </button>
                  );
                })}
              </div>
            ) : q.options.some((o) => o.image) ? (
              // Quiz à choix d'IMAGES : grille de cartes cliquables.
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {q.options.map((o) => {
                  const isCheckbox = o.input_type === 1;
                  const selected = (answers[q.id] || []).includes(o.id);
                  let ring = selected
                    ? "border-accent ring-2 ring-accent/40"
                    : "border-line/70 hover:border-brand";
                  if (r) {
                    if (r.correct_option_ids.includes(o.id)) ring = "border-green-500 ring-2 ring-green-400/50";
                    else if (r.selected_option_ids.includes(o.id)) ring = "border-red-400 ring-2 ring-red-300/50";
                  }
                  return (
                    <button
                      type="button"
                      key={o.id}
                      disabled={locked}
                      onClick={() => toggle(q.id, o.id, isCheckbox)}
                      className={`relative overflow-hidden rounded-xl border-2 bg-white text-left transition disabled:cursor-default ${ring}`}
                    >
                      {o.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.image} alt={o.title} className="aspect-video w-full object-cover" />
                      )}
                      <span className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                            isCheckbox ? "rounded" : "rounded-full"
                          } ${selected ? "border-accent bg-accent text-white" : "border-muted"}`}
                        >
                          {selected && <i className="bx bx-check text-xs" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{o.title}</span>
                        {r && r.correct_option_ids.includes(o.id) && (
                          <i className="bx bx-check shrink-0 text-green-600" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              // Quiz textuel classique (radio / checkbox).
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
            )}
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

/** Anneau de progression circulaire (SVG). */
function ProgressRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line/60" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className={percent === 100 ? "stroke-green-500" : "stroke-accent"}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-brand-deep">
        {percent}%
      </span>
    </div>
  );
}

/** En-tête de progression (anneau + compteur + expiration). */
function ProgressSummary({
  done,
  total,
  percent,
  accesFin,
}: {
  done: number;
  total: number;
  percent: number;
  accesFin: string | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <ProgressRing percent={percent} />
        <div className="min-w-0">
          <p className="font-heading font-semibold text-brand-deep">Ma progression</p>
          <p className="text-xs text-muted">
            {done}/{total} activité{total > 1 ? "s" : ""} terminée{done > 1 ? "s" : ""}
          </p>
        </div>
      </div>
      {accesFin && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <i className="bx bx-time-five text-accent" /> Accès jusqu&apos;au {fmtDate(accesFin)}
        </p>
      )}
    </div>
  );
}

/** Sommaire cliquable thèmes → séances, avec pastilles d'avancement. */
function ThemeNav({
  themes,
  onJump,
}: {
  themes: MyFormation["themes"];
  onJump: (id: string) => void;
}) {
  return (
    <nav className="space-y-0.5">
      {themes.map((th) => (
        <div key={th.id}>
          <button
            onClick={() => onJump(`th-${th.id}`)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-ink transition-colors hover:bg-brand-soft"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                th.progress.percent === 100 ? "bg-green-500" : th.progress.done > 0 ? "bg-accent" : "bg-line"
              }`}
            />
            <span className="min-w-0 flex-1 truncate">{th.title}</span>
            {th.progress.total > 0 && (
              <span className="shrink-0 text-xs font-semibold text-muted">{th.progress.percent}%</span>
            )}
          </button>
          {th.seances.length > 0 && (
            <div className="ml-3 border-l border-line/70 pl-2">
              {th.seances.map((s) => {
                const sd = s.activities.filter((a) => a.completed).length;
                const st = s.activities.length;
                const full = st > 0 && sd === st;
                return (
                  <button
                    key={s.id}
                    onClick={() => onJump(`se-${s.id}`)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-muted transition-colors hover:bg-brand-soft hover:text-ink"
                  >
                    <i className={`bx ${full ? "bxs-check-circle text-green-500" : "bx-circle"} text-sm shrink-0`} />
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {st > 0 && (
                      <span className="shrink-0 tabular-nums">
                        {sd}/{st}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

/**
 * Contenu d'une formation ouverte : deux colonnes sur desktop (contenu +
 * sidebar de progression sticky), et sur mobile un panneau « Progression &
 * sommaire » repliable en haut. Les liens du sommaire défilent en douceur vers
 * la section (ancres `th-…` / `se-…`, décalées sous l'en-tête collant).
 */
function FormationContent({
  content,
  token,
  onComplete,
  accesFin,
}: {
  content: MyFormation;
  token: string;
  onComplete: OnComplete;
  accesFin: string | null;
}) {
  const [navOpen, setNavOpen] = useState(false);

  const done = content.themes.reduce((n, t) => n + t.progress.done, 0);
  const total = content.themes.reduce((n, t) => n + t.progress.total, 0);
  const percent = total ? Math.round((100 * done) / total) : 0;

  function jump(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setNavOpen(false);
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
      {/* Sidebar mobile : repliable, douce */}
      <div className="mb-5 lg:hidden">
        <div className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-hbc-sm">
          <button
            onClick={() => setNavOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3"
            aria-expanded={navOpen}
          >
            <ProgressSummary done={done} total={total} percent={percent} accesFin={accesFin} />
            <i className={`bx bx-chevron-down text-2xl text-muted transition-transform ${navOpen ? "rotate-180" : ""}`} />
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-hbc ${
              navOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="border-t border-line px-3 py-3">
                <ThemeNav themes={content.themes} onJump={jump} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="min-w-0 space-y-8">
        {content.schedule.length > 0 && (
          <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-deep">
              <i className="bx bx-calendar" /> Planning des séances
            </p>
            <ul className="space-y-2">
              {content.schedule.map((ev) => {
                const link = ev.meetings.find((m) => m.link_url)?.link_url;
                const shown = ev.meetings.find((m) => m.link_url) ?? ev.meetings[0];
                return (
                  <li key={ev.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
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
          <div key={th.id} id={`th-${th.id}`} className="scroll-mt-24">
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
                <div key={s.id} id={`se-${s.id}`} className="scroll-mt-24">
                  <SeanceBlock s={s} token={token} onComplete={onComplete} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar desktop : sticky */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4 rounded-2xl border border-line/70 bg-white p-5 shadow-hbc-sm">
          <ProgressSummary done={done} total={total} percent={percent} accesFin={accesFin} />
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sommaire</p>
            <ThemeNav themes={content.themes} onJump={jump} />
          </div>
        </div>
      </aside>
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
        // Auto-sélectionne la première formation avec contenu accessible pour
        // que le panneau principal ne soit jamais vide à l'arrivée.
        const first = s.formations.find((f) => f.has_content && !f.acces_expire);
        if (first) selectFormation(first.publication_id);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Sélectionne une formation et charge son contenu dans le panneau principal.
  // (Navigation type « sidebar » : re-cliquer sur l'active ne la referme pas.)
  async function selectFormation(pubId: number) {
    if (openId === pubId) return;
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
        /* Deux panneaux pleine largeur : à gauche la navigation entre formations,
           à droite le contenu de celle sélectionnée. Sur mobile, la liste passe
           au-dessus (défilement horizontal) et le contenu dessous. */
        <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Sidebar : liste des formations */}
          <aside className="mb-6 lg:mb-0 lg:sticky lg:top-24">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Mes formations ({space.formations.length})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-2 lg:overflow-visible lg:pb-0">
              {space.formations.map((f) => {
                const active = openId === f.publication_id;
                const disabled = !f.has_content || f.acces_expire;
                return (
                  <button
                    key={f.publication_id}
                    onClick={() => !disabled && selectFormation(f.publication_id)}
                    disabled={disabled}
                    className={`shrink-0 rounded-xl border p-3 text-left transition lg:w-full ${
                      active
                        ? "border-brand bg-brand-soft/60 shadow-hbc-sm"
                        : "border-line/70 bg-white hover:border-brand/50"
                    } ${disabled ? "cursor-default opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl ${f.acces_expire ? "bg-gray-100 text-gray-400" : "bg-brand-soft text-brand"}`}>
                        <i className={`bx ${f.acces_expire ? "bx-lock-alt" : "bxs-graduation"}`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold leading-tight text-ink">{f.title}</h3>
                        {f.acces_expire ? (
                          <p className="truncate text-xs font-medium text-amber-700">
                            Terminé{f.acces_fin ? ` le ${fmtDate(f.acces_fin)}` : ""}
                          </p>
                        ) : f.has_content && f.progress.total > 0 ? (
                          <div className="mt-1.5 w-40 lg:w-full"><ProgressBar percent={f.progress.percent} /></div>
                        ) : (
                          <p className="truncate text-xs text-muted">
                            {f.has_content ? "Contenu disponible" : "En préparation"}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Panneau principal : contenu de la formation sélectionnée */}
          <div className="min-w-0">
            {openId === null ? (
              <div className="card p-10 text-center text-muted">
                <i className="bx bx-book-open mb-2 text-3xl text-brand/50" />
                <p>Sélectionnez une formation pour afficher son contenu.</p>
              </div>
            ) : loadingContent ? (
              <p className="text-muted">Chargement du contenu…</p>
            ) : !content || content.themes.length === 0 ? (
              <div className="card p-8 text-muted">Le contenu de cette formation n’est pas encore disponible.</div>
            ) : (
              <FormationContent
                content={content}
                token={token}
                onComplete={patchCompleted}
                accesFin={space.formations.find((f) => f.publication_id === openId)?.acces_fin ?? null}
              />
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
