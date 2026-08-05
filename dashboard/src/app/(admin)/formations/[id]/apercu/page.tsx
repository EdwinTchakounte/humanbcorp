"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Loading, ErrorState, EmptyState, PageHeader, Badge } from "@/components/ui";

/**
 * Aperçu du contenu d'une formation — tel que l'apprenant le verra.
 *
 * Les données viennent de `/modules/themes/<id>/apercu/`, qui appelle le MÊME
 * constructeur que l'espace apprenant. Un aperçu qui reconstruirait l'arbre de
 * son côté finirait par diverger du rendu réel et ne servirait plus à rien.
 *
 * Seule différence assumée : les bonnes réponses du quiz sont signalées, pour
 * que l'auteur vérifie son corrigé.
 */
interface Option {
  id: number;
  title: string;
  input_type: number;
  is_answer?: boolean;
}
interface QuizQuestion {
  id: number;
  index: number;
  title: string;
  description: string;
  points: number;
  options: Option[];
}
interface Composant {
  id: number;
  title: string;
  paragraph: string | null;
  image: string | null;
  video_url: string | null;
  video_file: string | null;
  audio_url: string | null;
  audio_file: string | null;
  number: number;
}
interface Doc {
  id: number;
  title: string;
  description: string;
  url: string | null;
  m_type: number;
}
interface Activite {
  id: number;
  index: number;
  title: string;
  type: number; // 1=Quizz 2=PDF 3=Link
  documents: Doc[];
  questions: QuizQuestion[];
  components: Composant[];
}
interface SeanceApercu {
  id: number;
  index: number;
  title: string;
  type: number; // 0=Théorie 1=Pratique 2=Exercice
  documents: Doc[];
  activities: Activite[];
}
interface Apercu {
  titre: string;
  theme: {
    id: number;
    title: string;
    objectifs: string[];
    seances: SeanceApercu[];
  };
}

const TYPE_SEANCE: Record<number, string> = { 0: "Théorie", 1: "Pratique", 2: "Exercice" };

/** YouTube / Vimeo → embed ; fichier direct → lecteur ; sinon lien.
 *  Même normalisation que l'espace apprenant, pour un rendu identique. */
function toEmbed(url: string): { kind: "iframe" | "video" | "link"; src: string } {
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: "video", src: u };
  return { kind: "link", src: u };
}

function Video({ url }: { url: string }) {
  const { kind, src } = toEmbed(url);
  if (kind === "iframe")
    return (
      <div className="relative mt-2 aspect-video overflow-hidden rounded-md bg-black">
        <iframe src={src} title="Vidéo" allowFullScreen className="absolute inset-0 h-full w-full" />
      </div>
    );
  if (kind === "video") return <video src={src} controls className="mt-2 w-full rounded-md" />;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent">
      <i className="bx bx-play-circle text-lg" /> Voir la vidéo
    </a>
  );
}

export default function ApercuPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Apercu | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  async function load() {
    setLoading(true);
    setErr(false);
    try {
      setData(await api<Apercu>(`/modules/themes/${params.id}/apercu/`));
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const seances = data?.theme?.seances ?? [];

  return (
    <div className="p-4 md:p-6">
      <Link
        href={`/formations/${params.id}/contenu`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-brand"
      >
        <i className="bx bx-left-arrow-alt" /> Retour à l&apos;édition
      </Link>

      <PageHeader
        title={data ? `Aperçu — ${data.titre}` : "Aperçu"}
        subtitle="Le contenu tel que l'apprenant le verra. Les bonnes réponses sont signalées pour votre vérification."
      />

      {loading ? (
        <Loading />
      ) : err ? (
        <ErrorState message="Impossible de charger l'aperçu." onRetry={load} />
      ) : seances.length === 0 ? (
        <EmptyState
          icon="bx-book-open"
          title="Aucun contenu à prévisualiser"
          hint="Ajoutez une séance et des activités pour voir le rendu apprenant."
        />
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          {data?.theme.objectifs && data.theme.objectifs.length > 0 && (
            <div className="card p-5">
              <p className="label mb-2">Objectifs</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-ink">
                {data.theme.objectifs.map((o) => <li key={o}>{o}</li>)}
              </ul>
            </div>
          )}

          {seances.map((s) => (
            <section key={s.id} className="card overflow-hidden">
              <header className="flex items-center gap-3 border-b border-line bg-brand-soft/40 px-5 py-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
                  {s.index}
                </span>
                <h2 className="flex-1 font-heading text-base font-semibold text-brand-deep">{s.title}</h2>
                <Badge tone="info">{TYPE_SEANCE[s.type] ?? "Séance"}</Badge>
              </header>

              <div className="divide-y divide-line">
                {s.activities.length === 0 && (
                  <p className="px-5 py-4 text-sm text-muted">Aucune activité dans cette séance.</p>
                )}

                {s.activities.map((a) => (
                  <article key={a.id} className="px-5 py-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted">{s.index}.{a.index}</span>
                      <h3 className="flex-1 font-heading font-semibold text-brand-deep">{a.title}</h3>
                      {a.type === 1 && <Badge tone="warning" icon="bx-help-circle">Quiz</Badge>}
                    </div>

                    {/* Blocs de contenu : texte, image, vidéo, audio */}
                    {a.components.map((c) => (
                      <div key={c.id} className="mb-4">
                        {c.title && <p className="text-sm font-semibold text-ink">{c.title}</p>}
                        {c.paragraph && (
                          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">{c.paragraph}</p>
                        )}
                        {c.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.image} alt={c.title} className="mt-2 max-w-full rounded-md" />
                        )}
                        {c.video_url && <Video url={c.video_url} />}
                        {c.video_file && <video src={c.video_file} controls className="mt-2 w-full rounded-md" />}
                        {c.audio_url && <audio src={c.audio_url} controls className="mt-2 w-full" />}
                        {c.audio_file && <audio src={c.audio_file} controls className="mt-2 w-full" />}
                      </div>
                    ))}

                    {/* Quiz : énoncés + options, corrigé signalé */}
                    {a.questions.length > 0 && (
                      <div className="space-y-4">
                        {a.questions.map((q) => (
                          <div key={q.id} className="rounded-md border border-line p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold text-ink">
                                {q.index}. {q.title}
                              </p>
                              <span className="shrink-0 text-xs text-muted">{q.points} pt</span>
                            </div>
                            <ul className="mt-3 space-y-1.5">
                              {q.options.map((o) => (
                                <li key={o.id} className="flex items-center gap-2 text-sm">
                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center border ${o.input_type === 1 ? "rounded-sm" : "rounded-full"} ${o.is_answer ? "border-green-600 bg-green-600 text-white" : "border-line"}`}>
                                    {o.is_answer && <i className="bx bx-check text-[10px]" />}
                                  </span>
                                  <span className={o.is_answer ? "font-semibold text-green-700" : "text-ink"}>
                                    {o.title}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Documents joints */}
                    {a.documents.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {a.documents.map((d) => (
                          <a
                            key={d.id}
                            href={d.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink transition hover:border-brand hover:text-brand"
                          >
                            <i className="bx bx-file text-lg text-muted" /> {d.title}
                          </a>
                        ))}
                      </div>
                    )}

                    {a.components.length === 0 && a.questions.length === 0 && a.documents.length === 0 && (
                      <p className="text-sm text-muted">Activité vide — rien ne sera affiché à l&apos;apprenant.</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
