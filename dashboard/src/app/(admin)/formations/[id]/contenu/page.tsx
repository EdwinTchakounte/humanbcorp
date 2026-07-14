"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, listAll } from "@/lib/api";
import { Modal, TextField, SelectField } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { ThemeItem, SeanceItem, ActivityItem } from "@/lib/types";

const SEANCE_TYPES = [
  { value: "0", label: "Théorie" },
  { value: "1", label: "Pratique" },
  { value: "2", label: "Exercice" },
];
const ACTIVITY_TYPES = [
  { value: "3", label: "Contenu / Vidéo" },
  { value: "2", label: "Document (PDF)" },
  { value: "1", label: "Quiz" },
];
const ACT_ICON: Record<number, string> = { 1: "bx-help-circle", 2: "bx-file", 3: "bx-book-open" };

type SeanceDraft = { id?: number; title: string; s_type: string };
type ActivityDraft = { id?: number; seance: number; title: string; a_type: string };

// Feuille d'arbre normalisée (composant / document / question).
type Leaf = { key: string; label: string; icon: string; tone: string };

export default function ContenuPage({ params }: { params: { id: string } }) {
  const themeId = Number(params.id);
  const { canWrite } = useAuth();
  const writable = canWrite("formations");

  const [theme, setTheme] = useState<ThemeItem | null>(null);
  const [seances, setSeances] = useState<SeanceItem[]>([]);
  const [acts, setActs] = useState<Record<number, ActivityItem[]>>({});
  const [openSeance, setOpenSeance] = useState<number | null>(null);
  const [openActs, setOpenActs] = useState<Set<number>>(new Set());
  const [leaves, setLeaves] = useState<Record<number, Leaf[] | null>>({});
  const [loading, setLoading] = useState(true);

  const [sDraft, setSDraft] = useState<SeanceDraft | null>(null);
  const [aDraft, setADraft] = useState<ActivityDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function loadSeances() {
    setSeances(await listAll<SeanceItem>(`/modules/seances/?theme=${themeId}`));
  }
  async function loadActs(seanceId: number) {
    setActs((m) => ({ ...m, [seanceId]: [] }));
    const list = await listAll<ActivityItem>(`/modules/activities/?seance=${seanceId}`);
    setActs((m) => ({ ...m, [seanceId]: list }));
  }

  // Charge les contenus (feuilles) d'une activité : composants + docs + questions.
  async function loadLeaves(a: ActivityItem) {
    setLeaves((m) => ({ ...m, [a.id]: null }));
    type Comp = { id: number; title?: string; paragraph?: string; video_url?: string; audio_url?: string; image_url?: string };
    type Doc = { id: number; title?: string; url?: string; m_type?: number };
    type Q = { id: number; title?: string };
    const reqs: Promise<Leaf[]>[] = [
      listAll<Comp>(`/modules/components/?activity=${a.id}`).then((cs) =>
        cs.map((c) => {
          let icon = "bx-text", tone = "text-slate-500", kind = "Texte";
          if (c.video_url) { icon = "bx-play-circle"; tone = "text-rose-500"; kind = "Vidéo"; }
          else if (c.audio_url) { icon = "bx-volume-full"; tone = "text-violet-500"; kind = "Audio"; }
          else if (c.image_url) { icon = "bx-image"; tone = "text-emerald-500"; kind = "Image"; }
          return { key: `c${c.id}`, label: c.title || kind, icon, tone };
        }),
      ),
      listAll<Doc>(`/modules/activity-docs/?activity=${a.id}`).then((ds) =>
        ds.map((d) => {
          const isLink = d.url && !/\.(pdf|docx?|pptx?|xlsx?)$/i.test(d.url);
          return { key: `d${d.id}`, label: d.title || "Document", icon: isLink ? "bx-link" : "bx-file-blank", tone: "text-sky-500" };
        }),
      ),
    ];
    if (a.a_type === 1) {
      reqs.push(
        listAll<Q>(`/modules/quiz-questions/?activity=${a.id}`).then((qs) =>
          qs.map((q, i) => ({ key: `q${q.id}`, label: q.title || `Question ${i + 1}`, icon: "bx-help-circle", tone: "text-amber-500" })),
        ),
      );
    }
    const all = (await Promise.all(reqs)).flat();
    setLeaves((m) => ({ ...m, [a.id]: all }));
  }

  useEffect(() => {
    Promise.all([api<ThemeItem>(`/modules/themes/${themeId}/`), listAll<SeanceItem>(`/modules/seances/?theme=${themeId}`)])
      .then(([t, s]) => {
        setTheme(t);
        setSeances(s);
      })
      .finally(() => setLoading(false));
  }, [themeId]);

  function expand(seanceId: number) {
    if (openSeance === seanceId) {
      setOpenSeance(null);
      return;
    }
    setOpenSeance(seanceId);
    if (!acts[seanceId]) loadActs(seanceId);
  }

  function toggleAct(a: ActivityItem) {
    setOpenActs((prev) => {
      const next = new Set(prev);
      if (next.has(a.id)) next.delete(a.id);
      else {
        next.add(a.id);
        if (leaves[a.id] === undefined) loadLeaves(a);
      }
      return next;
    });
  }

  // --- Séances ---
  async function saveSeance() {
    if (!sDraft) return;
    setSaving(true);
    setErr("");
    try {
      const body = { title: sDraft.title, s_type: Number(sDraft.s_type), theme: themeId };
      if (sDraft.id) await api(`/modules/seances/${sDraft.id}/`, { method: "PATCH", body });
      else await api("/modules/seances/", { method: "POST", body });
      setSDraft(null);
      await loadSeances();
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }
  async function delSeance(s: SeanceItem) {
    if (!confirm(`Supprimer la séance « ${s.title} » et ses activités ?`)) return;
    await api(`/modules/seances/${s.id}/`, { method: "DELETE" });
    await loadSeances();
  }

  // --- Activités ---
  async function saveActivity() {
    if (!aDraft) return;
    setSaving(true);
    setErr("");
    try {
      const body = { title: aDraft.title, a_type: Number(aDraft.a_type), seance: aDraft.seance };
      if (aDraft.id) await api(`/modules/activities/${aDraft.id}/`, { method: "PATCH", body });
      else await api("/modules/activities/", { method: "POST", body });
      setADraft(null);
      await loadActs(aDraft.seance);
      await loadSeances();
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }
  async function delActivity(a: ActivityItem) {
    if (!confirm(`Supprimer l'activité « ${a.title} » ?`)) return;
    await api(`/modules/activities/${a.id}/`, { method: "DELETE" });
    await loadActs(a.seance);
    await loadSeances();
  }

  if (loading) return <div className="p-8 text-muted">Chargement…</div>;

  return (
    <div className="p-8">
      <Link href="/formations" className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-brand">
        <i className="bx bx-left-arrow-alt" /> Formations
      </Link>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Contenu — {theme?.title}</h1>
          <p className="text-sm text-muted">Arbre du contenu : séance → activité → contenus.</p>
        </div>
        {writable && (
          <button onClick={() => setSDraft({ title: "", s_type: "0" })} className="btn-brand text-sm">
            <i className="bx bx-plus" /> Séance
          </button>
        )}
      </header>

      {seances.length === 0 ? (
        <p className="text-muted">Aucune séance. Ajoutez-en une pour structurer la formation.</p>
      ) : (
        <div className="space-y-3">
          {seances.map((s, i) => (
            <div key={s.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => expand(s.id)} className="flex flex-1 items-center gap-3 text-left">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-medium text-ink">{s.title}</span>
                    <span className="ml-2 text-xs text-muted">
                      {s.s_type_label} · {s.activities_count} activité(s)
                    </span>
                  </span>
                  <i className={`bx bx-chevron-down ml-auto text-xl text-muted transition ${openSeance === s.id ? "rotate-180" : ""}`} />
                </button>
                {writable && (
                  <div className="flex gap-1">
                    <button onClick={() => setSDraft({ id: s.id, title: s.title, s_type: String(s.s_type) })} className="btn-ghost text-xs" title="Modifier">
                      <i className="bx bx-edit" />
                    </button>
                    <button onClick={() => delSeance(s)} className="btn-ghost text-xs text-red-500" title="Supprimer">
                      <i className="bx bx-trash" />
                    </button>
                  </div>
                )}
              </div>

              {openSeance === s.id && (
                <div className="border-t border-line bg-brand-soft/20 p-4">
                  {!acts[s.id] ? (
                    <p className="text-sm text-muted">Chargement…</p>
                  ) : (
                    <div className="space-y-2">
                      {acts[s.id].length === 0 && <p className="text-sm text-muted">Aucune activité.</p>}
                      {acts[s.id].map((a) => {
                        const isOpen = openActs.has(a.id);
                        const kids = leaves[a.id];
                        return (
                          <div key={a.id} className="rounded-lg border border-line bg-white">
                            <div className="flex items-center gap-3 px-4 py-2.5">
                              <button onClick={() => toggleAct(a)} className="flex flex-1 items-center gap-3 text-left" title="Déplier les contenus">
                                <i className={`bx bx-chevron-right text-lg text-muted transition ${isOpen ? "rotate-90" : ""}`} />
                                <i className={`bx ${ACT_ICON[a.a_type] || "bx-square"} text-lg text-brand`} />
                                <span className="flex-1 text-sm text-ink">{a.title}</span>
                              </button>
                              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">{a.a_type_label}</span>
                              <Link href={`/formations/${themeId}/contenu/activite/${a.id}`} className="btn-ghost text-xs" title="Éditer le contenu">
                                <i className="bx bx-list-ul" /> Contenu
                              </Link>
                              {writable && (
                                <div className="flex gap-1">
                                  <button onClick={() => setADraft({ id: a.id, seance: s.id, title: a.title, a_type: String(a.a_type) })} className="btn-ghost text-xs" title="Modifier">
                                    <i className="bx bx-edit" />
                                  </button>
                                  <button onClick={() => delActivity(a)} className="btn-ghost text-xs text-red-500" title="Supprimer">
                                    <i className="bx bx-trash" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {isOpen && (
                              <div className="border-t border-line px-4 py-2 pl-11">
                                {kids === null || kids === undefined ? (
                                  <p className="py-1 text-xs text-muted">Chargement…</p>
                                ) : kids.length === 0 ? (
                                  <p className="py-1 text-xs text-muted">
                                    Aucun contenu.{" "}
                                    <Link href={`/formations/${themeId}/contenu/activite/${a.id}`} className="font-semibold text-accent">
                                      Ajouter →
                                    </Link>
                                  </p>
                                ) : (
                                  <ul className="space-y-1 py-1">
                                    {kids.map((k) => (
                                      <li key={k.key} className="flex items-center gap-2 text-sm text-ink">
                                        <i className={`bx ${k.icon} ${k.tone}`} />
                                        <span className="truncate">{k.label}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {writable && (
                        <button onClick={() => setADraft({ seance: s.id, title: "", a_type: "3" })} className="mt-1 text-sm font-semibold text-accent">
                          <i className="bx bx-plus" /> Ajouter une activité
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modale séance */}
      <Modal
        open={sDraft !== null}
        title={sDraft?.id ? "Modifier la séance" : "Nouvelle séance"}
        onClose={() => setSDraft(null)}
        footer={
          <>
            <button onClick={() => setSDraft(null)} className="btn-ghost">Annuler</button>
            <button onClick={saveSeance} disabled={saving || !sDraft?.title} className="btn-brand disabled:opacity-50">
              {saving ? "…" : "Enregistrer"}
            </button>
          </>
        }
      >
        {sDraft && (
          <div className="space-y-4">
            <TextField label="Titre de la séance" value={sDraft.title} onChange={(v) => setSDraft({ ...sDraft, title: v })} />
            <SelectField label="Type" value={sDraft.s_type} onChange={(v) => setSDraft({ ...sDraft, s_type: v })} options={SEANCE_TYPES} />
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>
        )}
      </Modal>

      {/* Modale activité */}
      <Modal
        open={aDraft !== null}
        title={aDraft?.id ? "Modifier l'activité" : "Nouvelle activité"}
        onClose={() => setADraft(null)}
        footer={
          <>
            <button onClick={() => setADraft(null)} className="btn-ghost">Annuler</button>
            <button onClick={saveActivity} disabled={saving || !aDraft?.title} className="btn-brand disabled:opacity-50">
              {saving ? "…" : "Enregistrer"}
            </button>
          </>
        }
      >
        {aDraft && (
          <div className="space-y-4">
            <TextField label="Titre de l'activité" value={aDraft.title} onChange={(v) => setADraft({ ...aDraft, title: v })} />
            <SelectField label="Type" value={aDraft.a_type} onChange={(v) => setADraft({ ...aDraft, a_type: v })} options={ACTIVITY_TYPES} />
            <p className="text-xs text-muted">Le contenu détaillé (texte, vidéo, audio, documents, questions du quiz) s’ajoute via « Contenu ».</p>
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
