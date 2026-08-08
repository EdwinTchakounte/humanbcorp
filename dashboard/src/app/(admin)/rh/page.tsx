"use client";

import { useEffect, useState } from "react";
import { api, listAll, downloadFile } from "@/lib/api";
import {
  PageHeader, Loading, ErrorState, EmptyState, Badge, Modal, Toggle,
  Pagination, PAGE_SIZE, TextField, TextArea, SelectField,
} from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { JobOffer, ApplicationItem, ApplicationNote, RhOverview } from "@/lib/types";

const CONTRACTS = [
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "STAGE", label: "Stage" },
  { value: "ALTERNANCE", label: "Alternance" },
  { value: "FREELANCE", label: "Freelance / Mission" },
];

// Ton de pastille par étape du pipeline (cf. Application.Status côté back).
const STATUS_TONE: Record<number, "neutral" | "info" | "warning" | "danger" | "success"> = {
  0: "neutral", // Nouvelle
  1: "info",    // Vue
  2: "warning", // Présélectionnée
  3: "danger",  // Rejetée
  4: "info",    // Entretien
  5: "success", // Recrutée
};

const EMPTY_OFFER = {
  title: "", department: "", location: "Douala — Cameroun",
  contract_type: "CDI", salary: "", description: "", profile: "",
  closing_date: "", is_published: true,
  // Compte recruteur de suivi (id sous forme de chaîne pour le <select>) ;
  // vide = offre gérée par HBC en propre, sans espace client.
  owner: "",
  // Entreprise (révélée uniquement en premium)
  company_name: "", company_website: "",
  // Formule commerciale
  plan: "classic", is_featured: false,
  // Candidature directe (premium)
  apply_email: "", apply_url: "",
  // Bascules d'affichage
  show_company: true, show_salary: true, show_location: true,
  show_contract: true, show_department: true, show_closing_date: true,
};

/** Aperçu de l'accroche, calqué sur la règle serveur (JobOffer.headline). */
function apercuAccroche(f: typeof EMPTY_OFFER): string {
  const revele = f.plan === "premium" && f.show_company && f.company_name.trim();
  return `${revele ? f.company_name.trim() : "Une entreprise"} recrute`;
}

export default function RhPage() {
  const toast = useToast();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<"candidatures" | "offres">("candidatures");
  const [overview, setOverview] = useState<RhOverview | null>(null);
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [recruiters, setRecruiters] = useState<{ id: number; label: string; email: string }[]>([]);
  const [page, setPage] = useState(1);

  // Filtres candidatures (filtrage côté serveur).
  const [fOffer, setFOffer] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [q, setQ] = useState("");
  const [refetching, setRefetching] = useState(false);

  // Détail candidature.
  const [detail, setDetail] = useState<ApplicationItem | null>(null);
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);

  // Édition d'offre.
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerId, setOfferId] = useState<number | null>(null);
  const [offerForm, setOfferForm] = useState({ ...EMPTY_OFFER });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [savingOffer, setSavingOffer] = useState(false);

  async function loadAll() {
    setLoading(true);
    setErr(false);
    try {
      const [ov, offs, aps, recs] = await Promise.all([
        api<RhOverview>("/rh/overview/"),
        listAll<JobOffer>("/rh/offres/"),
        listAll<ApplicationItem>("/rh/candidatures/"),
        api<{ id: number; label: string; email: string }[]>("/rh/recruteurs/"),
      ]);
      setOverview(ov);
      setOffers(offs);
      setApps(aps);
      setRecruiters(recs);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadAll();
  }, []);

  async function onFilter(next: { offer?: string; status?: string; q?: string }) {
    if (next.offer !== undefined) setFOffer(next.offer);
    if (next.status !== undefined) setFStatus(next.status);
    if (next.q !== undefined) setQ(next.q);
    setPage(1);
    setRefetching(true);
    try {
      // Attendre le prochain tick : les setState ci-dessus ne sont pas encore
      // reflétés dans appsQuery(), donc on construit la requête à la volée.
      const p = new URLSearchParams();
      const offer = next.offer ?? fOffer;
      const status = next.status ?? fStatus;
      const query = (next.q ?? q).trim();
      if (offer) p.set("offer", offer);
      if (status) p.set("status", status);
      if (query) p.set("q", query);
      const qs = p.toString();
      setApps(await listAll<ApplicationItem>(`/rh/candidatures/${qs ? `?${qs}` : ""}`));
    } finally {
      setRefetching(false);
    }
  }

  // --- Détail candidature -------------------------------------------------
  async function openDetail(a: ApplicationItem) {
    setDetail(a);
    setNoteDraft("");
    setNotes([]);
    try {
      setNotes(await api<ApplicationNote[]>(`/rh/candidatures/${a.id}/notes/`));
    } catch {
      /* le fil de notes est secondaire : on n'échoue pas l'ouverture */
    }
  }

  async function patchApp(id: number, body: Record<string, unknown>) {
    setSavingDetail(true);
    try {
      const updated = await api<ApplicationItem>(`/rh/candidatures/${id}/`, { method: "PATCH", body });
      setApps((xs) => xs.map((x) => (x.id === id ? updated : x)));
      setDetail((d) => (d && d.id === id ? updated : d));
      if (overview) setOverview(await api<RhOverview>("/rh/overview/"));
    } catch {
      toast.error("Mise à jour impossible.");
    } finally {
      setSavingDetail(false);
    }
  }

  async function addNote() {
    if (!detail || !noteDraft.trim()) return;
    try {
      const note = await api<ApplicationNote>(`/rh/candidatures/${detail.id}/notes/`, {
        method: "POST", body: { body: noteDraft.trim() },
      });
      setNotes((ns) => [...ns, note]);
      setNoteDraft("");
    } catch {
      toast.error("Ajout de la note impossible.");
    }
  }

  async function getCv(a: ApplicationItem) {
    try {
      await downloadFile(`/rh/candidatures/${a.id}/cv/`, `CV ${a.full_name}`.trim());
    } catch {
      toast.error("Téléchargement du CV impossible.");
    }
  }

  // --- Offres -------------------------------------------------------------
  function openOfferCreate() {
    setOfferId(null);
    setOfferForm({ ...EMPTY_OFFER });
    setLogoFile(null);
    setOfferOpen(true);
  }
  function openOfferEdit(o: JobOffer) {
    setOfferId(o.id);
    setOfferForm({
      title: o.title, department: o.department, location: o.location,
      contract_type: o.contract_type, salary: o.salary || "",
      description: o.description, profile: o.profile,
      closing_date: o.closing_date || "", is_published: o.is_published,
      owner: o.owner != null ? String(o.owner) : "",
      company_name: o.company_name || "", company_website: o.company_website || "",
      plan: o.plan || "classic", is_featured: o.is_featured,
      apply_email: o.apply_email || "", apply_url: o.apply_url || "",
      show_company: o.show_company, show_salary: o.show_salary,
      show_location: o.show_location, show_contract: o.show_contract,
      show_department: o.show_department, show_closing_date: o.show_closing_date,
    });
    setLogoFile(null);
    setOfferOpen(true);
  }
  async function submitOffer() {
    if (!offerForm.title.trim() || !offerForm.description.trim()) {
      toast.error("Le titre et la description sont requis.");
      return;
    }
    setSavingOffer(true);
    const plat = {
      ...offerForm,
      closing_date: offerForm.closing_date || null,
      // "" (aucun recruteur) → null pour la FK ; sinon l'id numérique.
      owner: offerForm.owner ? Number(offerForm.owner) : null,
    };
    // Un logo impose le multipart ; sans logo on reste en JSON (plus simple et
    // seul moyen d'envoyer un `closing_date` réellement nul).
    let body: unknown = plat;
    let isForm = false;
    if (logoFile) {
      const fd = new FormData();
      Object.entries(plat).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, String(v));
      });
      fd.append("company_logo", logoFile);
      body = fd;
      isForm = true;
    }
    try {
      if (offerId) {
        const up = await api<JobOffer>(`/rh/offres/${offerId}/`, { method: "PATCH", body, isForm });
        setOffers((xs) => xs.map((x) => (x.id === offerId ? up : x)));
      } else {
        const created = await api<JobOffer>("/rh/offres/", { method: "POST", body, isForm });
        setOffers((xs) => [created, ...xs]);
      }
      setOfferOpen(false);
      if (overview) setOverview(await api<RhOverview>("/rh/overview/"));
    } catch (e) {
      // Le back refuse explicitement premium-only sur une offre classique :
      // son message est exploitable tel quel.
      const m = String(e);
      let detail = "Enregistrement de l'offre impossible.";
      try {
        const j = JSON.parse(m.slice(m.indexOf("{")));
        detail = Object.values(j).flat().join(" ") || detail;
      } catch {
        /* corps non JSON */
      }
      toast.error(detail);
    } finally {
      setSavingOffer(false);
    }
  }
  async function toggleOffer(o: JobOffer) {
    const next = !o.is_published;
    setOffers((xs) => xs.map((x) => (x.id === o.id ? { ...x, is_published: next } : x)));
    try {
      await api(`/rh/offres/${o.id}/`, { method: "PATCH", body: { is_published: next } });
      if (overview) setOverview(await api<RhOverview>("/rh/overview/"));
    } catch {
      setOffers((xs) => xs.map((x) => (x.id === o.id ? { ...x, is_published: !next } : x)));
      toast.error("Impossible de changer la publication de l'offre.");
    }
  }
  async function delOffer(o: JobOffer) {
    if (!confirm(`Supprimer l'offre « ${o.title} » ?`)) return;
    try {
      await api(`/rh/offres/${o.id}/`, { method: "DELETE" });
      setOffers((xs) => xs.filter((x) => x.id !== o.id));
      if (overview) setOverview(await api<RhOverview>("/rh/overview/"));
    } catch {
      toast.error("Suppression impossible.");
    }
  }

  // Les avantages entreprise/candidature directe/mise en avant sont la
  // contrepartie du premium : l'interface les grise hors de cette formule.
  const premium = offerForm.plan === "premium";
  const pagedApps = apps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusOptions = [{ value: "", label: "Tous les statuts" }].concat(
    (overview?.statuses ?? []).map((s) => ({ value: String(s.value), label: s.label })),
  );
  const offerOptions = [{ value: "", label: "Toutes les offres" }].concat(
    offers.map((o) => ({ value: String(o.id), label: o.title })),
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="RH & Recrutement"
        subtitle="Offres d'emploi et pipeline de candidatures."
        actions={
          tab === "offres" ? (
            <button onClick={openOfferCreate} className="btn-accent">
              <i className="bx bx-plus" /> Nouvelle offre
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <Loading />
      ) : err ? (
        <ErrorState message="Impossible de charger le module RH." onRetry={loadAll} />
      ) : (
        <>
          {/* Vue d'ensemble : pipeline */}
          {overview && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Tile icon="bx-user-voice" label="Candidatures" value={overview.applications.total} accent />
              <Tile icon="bx-briefcase" label="Offres publiées" value={overview.offers.published} />
              <Tile icon="bx-chat" label="En entretien" value={pipeCount(overview, 4)} />
              <Tile icon="bx-check-shield" label="Recrutées" value={pipeCount(overview, 5)} />
            </div>
          )}
          {overview && (
            <div className="mb-6 flex flex-wrap gap-2">
              {overview.pipeline.map((s) => (
                <span key={s.value} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm">
                  <span className="text-muted">{s.label}</span>
                  <span className="font-bold text-brand-deep">{s.count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Onglets */}
          <div className="mb-4 flex gap-1 border-b border-line">
            {[
              { k: "candidatures", label: `Candidatures (${apps.length})` },
              { k: "offres", label: `Offres (${offers.length})` },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => { setTab(t.k as typeof tab); setPage(1); }}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  tab === t.k ? "border-accent text-accent" : "border-transparent text-muted hover:text-brand-deep"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "candidatures" ? (
            <>
              {/* Filtres */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <SelectField label="Offre" value={fOffer} onChange={(v) => onFilter({ offer: v })} options={offerOptions} />
                <SelectField label="Statut" value={fStatus} onChange={(v) => onFilter({ status: v })} options={statusOptions} />
                <div>
                  <label className="label">Recherche</label>
                  <input
                    className="input" value={q} placeholder="Nom ou e-mail…"
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onFilter({ q }); }}
                  />
                </div>
              </div>

              {apps.length === 0 ? (
                <EmptyState icon="bx-user-x" title="Aucune candidature" hint="Les candidatures déposées sur la vitrine apparaîtront ici." />
              ) : (
                <div className={refetching ? "pointer-events-none opacity-50 transition" : "transition"}>
                  <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs uppercase text-muted">
                          <th className="px-5 py-3">Candidat</th>
                          <th className="px-5 py-3">Offre</th>
                          <th className="px-5 py-3">Statut</th>
                          <th className="px-5 py-3">Éval.</th>
                          <th className="px-5 py-3">Recruteur</th>
                          <th className="px-5 py-3">Reçue le</th>
                          <th className="px-5 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedApps.map((a) => (
                          <tr key={a.id} className="border-b border-line/60 last:border-0">
                            <td className="px-5 py-3">
                              <div className="font-medium text-brand-deep">{a.full_name}</div>
                              <div className="text-xs text-muted">{a.email}</div>
                            </td>
                            <td className="px-5 py-3 text-muted">{a.offer_title}</td>
                            <td className="px-5 py-3">
                              <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status_label}</Badge>
                            </td>
                            <td className="px-5 py-3 text-muted">{a.rating != null ? `★ ${a.rating}/5` : "—"}</td>
                            <td className="px-5 py-3 text-muted">{a.assigned_to_name || "—"}</td>
                            <td className="px-5 py-3 text-muted">{formatDate(a.created_at)}</td>
                            <td className="px-5 py-3 text-right">
                              <button onClick={() => openDetail(a)} className="btn-ghost text-xs" aria-label={`Ouvrir la candidature de ${a.full_name}`}>
                                <i className="bx bx-slider-alt" /> Suivi
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-5 pb-4">
                      <Pagination page={page} total={apps.length} onPage={setPage} />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Onglet Offres */
            offers.length === 0 ? (
              <EmptyState
                icon="bx-briefcase"
                title="Aucune offre"
                hint="Publiez une offre pour recevoir des candidatures depuis la vitrine."
                action={<button onClick={openOfferCreate} className="btn-accent"><i className="bx bx-plus" /> Nouvelle offre</button>}
              />
            ) : (
              <div className="card divide-y divide-line">
                {offers.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap sm:gap-4 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-brand-deep">{o.title}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span>{o.contract_label}</span>
                        {o.department && <span>· {o.department}</span>}
                        {o.location && <span>· {o.location}</span>}
                        <span>· {o.applications_count} candidature(s)</span>
                        {o.closing_date && <span>· clôture {formatDate(o.closing_date)}</span>}
                      </div>
                    </div>
                    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                      <Toggle checked={o.is_published} onChange={() => toggleOffer(o)} label={o.is_published ? "Publiée" : "Masquée"} />
                      <button onClick={() => openOfferEdit(o)} className="btn-ghost shrink-0" aria-label={`Éditer l'offre ${o.title}`}>
                        <i className="bx bx-edit" /> Éditer
                      </button>
                      <button onClick={() => delOffer(o)} className="btn-danger shrink-0" title="Supprimer" aria-label={`Supprimer l'offre ${o.title}`}>
                        <i className="bx bx-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Modale : suivi d'une candidature */}
      <Modal
        open={!!detail}
        title={detail ? `Candidature — ${detail.full_name}` : ""}
        onClose={() => setDetail(null)}
        footer={<button onClick={() => setDetail(null)} className="btn-ghost">Fermer</button>}
      >
        {detail && (
          <div className="space-y-5">
            {/* Coordonnées + CV */}
            <div className="space-y-1 text-sm">
              <div><span className="text-muted">E-mail : </span><a className="text-brand hover:underline" href={`mailto:${detail.email}`}>{detail.email}</a></div>
              {detail.phone && <div><span className="text-muted">Téléphone : </span>{detail.phone}</div>}
              <div><span className="text-muted">Offre : </span>{detail.offer_title}</div>
              <div><span className="text-muted">Reçue le : </span>{formatDate(detail.created_at)}</div>
            </div>
            {detail.cover_letter && (
              <div>
                <div className="label">Lettre de motivation</div>
                <p className="whitespace-pre-wrap rounded-lg bg-brand-soft/40 p-3 text-sm text-ink">{detail.cover_letter}</p>
              </div>
            )}
            <button onClick={() => getCv(detail)} className="btn-ghost">
              <i className="bx bx-download" /> Télécharger le CV
            </button>

            {/* Pilotage : statut / évaluation / recruteur */}
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Statut"
                value={String(detail.status)}
                onChange={(v) => patchApp(detail.id, { status: Number(v) })}
                options={(overview?.statuses ?? []).map((s) => ({ value: String(s.value), label: s.label }))}
              />
              <SelectField
                label="Évaluation"
                value={detail.rating != null ? String(detail.rating) : ""}
                onChange={(v) => patchApp(detail.id, { rating: v === "" ? null : Number(v) })}
                options={[{ value: "", label: "Non évaluée" }, ...[0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}/5` }))]}
              />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted">Recruteur : </span>
              <span className="font-medium text-brand-deep">{detail.assigned_to_name || "non attribué"}</span>
              {profile && detail.assigned_to !== profile.id && (
                <button onClick={() => patchApp(detail.id, { assigned_to: profile.id })} className="btn-ghost text-xs">M&apos;attribuer</button>
              )}
              {detail.assigned_to != null && (
                <button onClick={() => patchApp(detail.id, { assigned_to: null })} className="btn-ghost text-xs">Retirer</button>
              )}
            </div>

            {/* Notes internes */}
            <div>
              <div className="label">Notes internes</div>
              <div className="space-y-2">
                {notes.length === 0 && <p className="text-sm text-muted">Aucune note pour l&apos;instant.</p>}
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                    <p className="whitespace-pre-wrap text-ink">{n.body}</p>
                    <div className="mt-1 text-xs text-muted">{n.author_name} · {formatDate(n.created_at)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className="input" value={noteDraft} placeholder="Ajouter une note…"
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
                />
                <button onClick={addNote} disabled={!noteDraft.trim()} className="btn-brand disabled:opacity-50">Ajouter</button>
              </div>
            </div>
            {savingDetail && <p className="text-xs text-muted">Enregistrement…</p>}
          </div>
        )}
      </Modal>

      {/* Modale : création / édition d'offre */}
      <Modal
        open={offerOpen}
        title={offerId ? "Éditer l'offre" : "Nouvelle offre"}
        onClose={() => setOfferOpen(false)}
        footer={
          <>
            <button onClick={() => setOfferOpen(false)} className="btn-ghost">Annuler</button>
            <button onClick={submitOffer} disabled={savingOffer} className="btn-brand disabled:opacity-50">
              {savingOffer ? "Enregistrement…" : offerId ? "Enregistrer" : "Créer"}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Aperçu de ce que verra le public, mis à jour en direct. */}
          <div className="rounded-md border border-line bg-brand-soft/40 px-4 py-3">
            <div className="label mb-0">Aperçu de l&apos;accroche</div>
            <p className="font-heading text-sm font-bold text-brand-deep">
              {apercuAccroche(offerForm)} — {offerForm.title || "…"}
            </p>
          </div>

          {/* --- Le poste --- */}
          <section className="space-y-4">
            <p className="label mb-0">Le poste</p>
            <TextField label="Intitulé du poste" value={offerForm.title} onChange={(v) => setOfferForm({ ...offerForm, title: v })} placeholder="Ex : Formateur(trice) Data" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Département / Pôle" value={offerForm.department} onChange={(v) => setOfferForm({ ...offerForm, department: v })} />
              <TextField label="Lieu" value={offerForm.location} onChange={(v) => setOfferForm({ ...offerForm, location: v })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Type de contrat" value={offerForm.contract_type} onChange={(v) => setOfferForm({ ...offerForm, contract_type: v })} options={CONTRACTS} />
              <TextField label="Rémunération" value={offerForm.salary} onChange={(v) => setOfferForm({ ...offerForm, salary: v })} placeholder="Ex : 300 000 – 450 000 FCFA" />
            </div>
            <div>
              <label className="label">Date de clôture</label>
              <input type="date" className="input" value={offerForm.closing_date} onChange={(e) => setOfferForm({ ...offerForm, closing_date: e.target.value })} />
            </div>
            <TextArea label="Description du poste" value={offerForm.description} onChange={(v) => setOfferForm({ ...offerForm, description: v })} rows={4} />
            <TextArea label="Profil recherché" value={offerForm.profile} onChange={(v) => setOfferForm({ ...offerForm, profile: v })} rows={3} />
          </section>

          {/* --- Formule commerciale --- */}
          <section className="space-y-4 border-t border-line pt-5">
            <p className="label mb-0">Formule</p>
            <SelectField
              label="Abonnement"
              value={offerForm.plan}
              onChange={(v) => setOfferForm({
                ...offerForm,
                plan: v,
                // Repasser en classique retire les avantages premium, sinon le
                // back refuserait l'enregistrement.
                ...(v === "classic" ? { is_featured: false, apply_email: "", apply_url: "" } : {}),
              })}
              options={[
                { value: "classic", label: "Classique — offre anonyme, candidatures sur la plateforme" },
                { value: "premium", label: "Premium — entreprise visible, candidature directe, mise en avant" },
              ]}
            />
            {!premium && (
              <p className="text-xs text-muted">
                En formule classique, l&apos;offre reste anonyme (« Une entreprise recrute ») et les
                candidatures arrivent dans votre pipeline. Passez en Premium pour révéler
                l&apos;entreprise et rediriger les candidatures vers elle.
              </p>
            )}
          </section>

          {/* --- Espace recruteur (suivi en lecture seule) --- */}
          <section className="space-y-3 border-t border-line pt-5">
            <p className="label mb-0">Espace recruteur (suivi)</p>
            <SelectField
              label="Compte recruteur rattaché"
              value={offerForm.owner}
              onChange={(v) => setOfferForm({ ...offerForm, owner: v })}
              options={[{ value: "", label: "HBC — aucun espace recruteur" }].concat(
                recruiters.map((r) => ({ value: String(r.id), label: `${r.label} (${r.email})` })),
              )}
            />
            <p className="text-xs text-muted">
              {recruiters.length === 0
                ? "Aucun compte recruteur pour l'instant. Créez un compte dans le groupe « Recruiter » pour lui donner un espace de suivi."
                : "Le recruteur rattaché suit cette offre et ses candidatures (dossier + CV) en lecture seule, sans pouvoir la modifier ni voir les notes internes."}
            </p>
          </section>

          {/* --- Entreprise (premium) --- */}
          <section className={`space-y-4 border-t border-line pt-5 ${premium ? "" : "opacity-50"}`}>
            <p className="label mb-0">Entreprise qui recrute</p>
            <TextField label="Nom de l'entreprise" value={offerForm.company_name} onChange={(v) => setOfferForm({ ...offerForm, company_name: v })} placeholder="Ex : UCB" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Site de l'entreprise" value={offerForm.company_website} onChange={(v) => setOfferForm({ ...offerForm, company_website: v })} placeholder="https://…" />
              <div>
                <label className="label">Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  className="input"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
                {offerId && !logoFile && (
                  <p className="mt-1 text-xs text-muted">Laissez vide pour conserver le logo actuel.</p>
                )}
              </div>
            </div>
          </section>

          {/* --- Candidature directe (premium) --- */}
          <section className={`space-y-4 border-t border-line pt-5 ${premium ? "" : "opacity-50"}`}>
            <p className="label mb-0">Destination des candidatures</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="E-mail de l'entreprise" value={offerForm.apply_email} onChange={(v) => setOfferForm({ ...offerForm, apply_email: v })} placeholder="rh@entreprise.cm" />
              <TextField label="Lien de candidature" value={offerForm.apply_url} onChange={(v) => setOfferForm({ ...offerForm, apply_url: v })} placeholder="https://…" />
            </div>
            <p className="text-xs text-muted">
              {premium && (offerForm.apply_email || offerForm.apply_url)
                ? "Candidature DIRECTE : le formulaire de la plateforme est remplacé par un bouton vers l'entreprise."
                : "Vide = les candidatures arrivent dans votre pipeline (formulaire + CV)."}
            </p>
          </section>

          {/* --- Champs affichés --- */}
          <section className="space-y-3 border-t border-line pt-5">
            <p className="label mb-0">Champs affichés sur le flyer et la page</p>
            <p className="text-xs text-muted">
              Un champ désactivé disparaît du flyer et de la page — la mise en page se resserre.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["show_company", "Entreprise", !premium],
                ["show_contract", "Type de contrat", false],
                ["show_location", "Lieu", false],
                ["show_salary", "Rémunération", false],
                ["show_department", "Département", false],
                ["show_closing_date", "Date de clôture", false],
              ] as const).map(([cle, libelle, grise]) => (
                <div key={cle} className={`flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 ${grise ? "opacity-50" : ""}`}>
                  <span className="text-sm text-ink">{libelle}</span>
                  <Toggle
                    checked={offerForm[cle]}
                    onChange={(v) => setOfferForm({ ...offerForm, [cle]: v })}
                    label={offerForm[cle] ? "Affiché" : "Masqué"}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* --- Diffusion --- */}
          <section className="space-y-3 border-t border-line pt-5">
            <p className="label mb-0">Diffusion</p>
            <Toggle checked={offerForm.is_published} onChange={(v) => setOfferForm({ ...offerForm, is_published: v })} label={offerForm.is_published ? "Publiée sur la vitrine" : "Masquée"} />
            <div className={premium ? "" : "opacity-50"}>
              <Toggle
                checked={offerForm.is_featured}
                onChange={(v) => setOfferForm({ ...offerForm, is_featured: v })}
                label={offerForm.is_featured ? "Mise en avant (à la une)" : "Pas de mise en avant"}
              />
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}

function pipeCount(ov: RhOverview, value: number) {
  return ov.pipeline.find((s) => s.value === value)?.count ?? 0;
}

function Tile({ icon, label, value, accent }: { icon: string; label: string; value: number; accent?: boolean }) {
  return (
    <div className={`card flex items-center gap-4 p-5 ${accent ? "ring-1 ring-accent/30" : ""}`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${accent ? "bg-accent/10 text-accent" : "bg-brand-soft text-brand"}`}>
        <i className={`bx ${icon}`} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-brand-deep">{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}
