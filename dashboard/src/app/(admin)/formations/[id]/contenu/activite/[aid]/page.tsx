"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, listAll } from "@/lib/api";
import { Modal, TextField, TextArea, SelectField } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { ActivityItem, ComponentItem, ActivityDocItem } from "@/lib/types";

const DOC_TYPES = [
  { value: "1", label: "Cours" },
  { value: "2", label: "Exercice" },
  { value: "4", label: "Correction" },
];
const DOC_LABEL: Record<number, string> = { 1: "Cours", 2: "Exercice", 3: "Réponse", 4: "Correction" };

type CompDraft = { id?: number; title: string; paragraph: string; video_url: string };
type DocDraft = { title: string; url: string; m_type: string };

export default function ActivityContentPage({ params }: { params: { id: string; aid: string } }) {
  const themeId = params.id;
  const activityId = Number(params.aid);
  const { canWrite } = useAuth();
  const writable = canWrite("formations");

  const [activity, setActivity] = useState<ActivityItem | null>(null);
  const [comps, setComps] = useState<ComponentItem[]>([]);
  const [docs, setDocs] = useState<ActivityDocItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [cDraft, setCDraft] = useState<CompDraft | null>(null);
  const [dDraft, setDDraft] = useState<DocDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

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
      })
      .finally(() => setLoading(false));
  }, [activityId]);

  async function saveComp() {
    if (!cDraft) return;
    setSaving(true);
    setErr("");
    try {
      const body = { activity: activityId, title: cDraft.title, paragraph: cDraft.paragraph, video_url: cDraft.video_url };
      if (cDraft.id) await api(`/modules/components/${cDraft.id}/`, { method: "PATCH", body });
      else await api("/modules/components/", { method: "POST", body });
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
      await api("/modules/activity-docs/", {
        method: "POST",
        body: { activity: activityId, title: dDraft.title, url: dDraft.url, m_type: Number(dDraft.m_type) },
      });
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
    <div className="p-8">
      <Link href={`/formations/${themeId}/contenu`} className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-brand">
        <i className="bx bx-left-arrow-alt" /> Contenu de la formation
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl">Activité — {activity?.title}</h1>
        <p className="text-sm text-muted">Blocs de contenu (texte / vidéo) et documents.</p>
      </header>

      {/* Blocs de contenu */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-deep">Blocs de contenu</h2>
          {writable && (
            <button onClick={() => setCDraft({ title: "", paragraph: "", video_url: "" })} className="btn-brand text-sm">
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
                </div>
                {writable && (
                  <div className="flex gap-1">
                    <button onClick={() => setCDraft({ id: c.id, title: c.title || "", paragraph: c.paragraph || "", video_url: c.video_url || "" })} className="btn-ghost text-xs">
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
            <button onClick={() => setDDraft({ title: "", url: "", m_type: "1" })} className="btn-brand text-sm">
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
        {writable && <p className="mt-3 text-xs text-muted">Astuce : hébergez le PDF (Drive, site…) et collez son lien. L’upload de fichier se fait via l’admin.</p>}
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
            <TextField label="Lien vidéo (YouTube / Vimeo / .mp4)" value={cDraft.video_url} onChange={(v) => setCDraft({ ...cDraft, video_url: v })} placeholder="https://youtu.be/…" />
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
            <button onClick={saveDoc} disabled={saving || !dDraft?.url} className="btn-brand disabled:opacity-50">{saving ? "…" : "Ajouter"}</button>
          </>
        }
      >
        {dDraft && (
          <div className="space-y-4">
            <TextField label="Titre" value={dDraft.title} onChange={(v) => setDDraft({ ...dDraft, title: v })} />
            <TextField label="Lien du document (URL)" value={dDraft.url} onChange={(v) => setDDraft({ ...dDraft, url: v })} placeholder="https://…/fichier.pdf" />
            <SelectField label="Type" value={dDraft.m_type} onChange={(v) => setDDraft({ ...dDraft, m_type: v })} options={DOC_TYPES} />
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
