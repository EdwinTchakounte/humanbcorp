"use client";

import { useEffect, useState } from "react";
import {
  getMySpace,
  getMyFormation,
  submitQuiz,
  type MySpace,
  type MyFormation,
  type LearnerActivity,
  type LearnerSeance,
  type LearnerDoc,
  type SubmitQuizResponse,
} from "@/lib/api";

const SEANCE_TYPE: Record<number, string> = { 0: "Théorie", 1: "Pratique", 2: "Exercice" };
const DOC_TYPE: Record<number, string> = { 1: "Cours", 2: "Exercice", 3: "Réponse", 4: "Correction" };

function DocRow({ d }: { d: LearnerDoc }) {
  return (
    <a
      href={d.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-line/70 bg-white px-4 py-3 text-sm transition hover:border-brand hover:shadow-hbc-sm"
    >
      <i className="bx bxs-file-pdf text-xl text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{d.title}</span>
        {d.description && <span className="block truncate text-xs text-muted">{d.description}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">
        {DOC_TYPE[d.m_type] || "Document"}
      </span>
      <i className="bx bx-link-external text-muted" />
    </a>
  );
}

function QuizBlock({ activity, token }: { activity: LearnerActivity; token: string }) {
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
    if (res) setResult(res);
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

function ActivityBlock({ a, token }: { a: LearnerActivity; token: string }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-brand-soft/40 p-5">
      <h4 className="mb-3 flex items-center gap-2 font-semibold text-brand-deep">
        {a.type === 1 ? <i className="bx bx-help-circle" /> : <i className="bx bx-book-open" />}
        {a.title}
      </h4>

      {/* Blocs de contenu (texte / image) */}
      {a.components.map((c) => (
        <div key={c.id} className="mb-3">
          {c.title && <p className="font-medium text-ink">{c.title}</p>}
          {c.paragraph && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{c.paragraph}</p>}
          {c.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image} alt={c.title} className="mt-2 max-w-full rounded-lg" />
          )}
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
      {a.questions.length > 0 && <QuizBlock activity={a} token={token} />}
    </div>
  );
}

function SeanceBlock({ s, token }: { s: LearnerSeance; token: string }) {
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
          <ActivityBlock key={a.id} a={a} token={token} />
        ))}
      </div>
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
      <header className="mb-8">
        <p className="eyebrow">Mon espace</p>
        <h1 className="mt-2 text-3xl md:text-4xl">Bonjour {space.learner.name} 👋</h1>
        <p className="mt-3 text-muted">Retrouvez ici le contenu de vos formations.</p>
      </header>

      {space.formations.length === 0 ? (
        <p className="text-muted">Aucune formation confirmée pour le moment.</p>
      ) : (
        <div className="space-y-4">
          {space.formations.map((f) => (
            <div key={f.publication_id} className="card overflow-hidden">
              <button
                onClick={() => f.has_content && openFormation(f.publication_id)}
                className="flex w-full items-center gap-4 p-5 text-left"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand">
                  <i className="bx bxs-graduation" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg leading-tight">{f.title}</h3>
                  <p className="truncate text-sm text-muted">
                    {f.has_content ? "Contenu disponible" : "Contenu en préparation"}
                  </p>
                </div>
                {f.has_content && (
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
                      {content.themes.map((th) => (
                        <div key={th.id}>
                          <h2 className="mb-2 text-2xl">{th.title}</h2>
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
                              <SeanceBlock key={s.id} s={s} token={token} />
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
    </div>
  );
}
