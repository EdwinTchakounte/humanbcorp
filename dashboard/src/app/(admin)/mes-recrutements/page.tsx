"use client";

import { useEffect, useState } from "react";
import { api, listAll, downloadFile } from "@/lib/api";
import {
  PageHeader, Loading, ErrorState, EmptyState, Badge, Modal,
  Pagination, PAGE_SIZE, SelectField,
} from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/lib/format";
import type { RecruiterOffer, RecruiterApplication, RhOverview } from "@/lib/types";

// Ton de pastille par étape du pipeline (aligné sur Application.Status côté back).
const STATUS_TONE: Record<number, "neutral" | "info" | "warning" | "danger" | "success"> = {
  0: "neutral", // Nouvelle
  1: "info",    // Vue
  2: "warning", // Présélectionnée
  3: "danger",  // Rejetée
  4: "info",    // Entretien
  5: "success", // Recrutée
};

/**
 * Espace recruteur — suivi en LECTURE SEULE de ses offres et candidatures.
 *
 * Le recruteur ne publie pas et ne fait pas avancer le pipeline : il consulte le
 * dossier complet de ses candidats (coordonnées, lettre, CV) et voit où chacun en
 * est. La publication et le suivi restent la main du super-admin HBC (module /rh).
 */
export default function MesRecrutementsPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<"candidatures" | "offres">("candidatures");
  const [overview, setOverview] = useState<RhOverview | null>(null);
  const [offers, setOffers] = useState<RecruiterOffer[]>([]);
  const [apps, setApps] = useState<RecruiterApplication[]>([]);
  const [page, setPage] = useState(1);

  // Filtres candidatures (filtrage côté serveur, borné à ses offres).
  const [fOffer, setFOffer] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [q, setQ] = useState("");
  const [refetching, setRefetching] = useState(false);

  const [detail, setDetail] = useState<RecruiterApplication | null>(null);

  async function loadAll() {
    setLoading(true);
    setErr(false);
    try {
      const [ov, offs, aps] = await Promise.all([
        api<RhOverview>("/rh/espace/overview/"),
        listAll<RecruiterOffer>("/rh/espace/offres/"),
        listAll<RecruiterApplication>("/rh/espace/candidatures/"),
      ]);
      setOverview(ov);
      setOffers(offs);
      setApps(aps);
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
      const p = new URLSearchParams();
      const offer = next.offer ?? fOffer;
      const status = next.status ?? fStatus;
      const query = (next.q ?? q).trim();
      if (offer) p.set("offer", offer);
      if (status) p.set("status", status);
      if (query) p.set("q", query);
      const qs = p.toString();
      setApps(await listAll<RecruiterApplication>(`/rh/espace/candidatures/${qs ? `?${qs}` : ""}`));
    } finally {
      setRefetching(false);
    }
  }

  async function getCv(a: RecruiterApplication) {
    try {
      await downloadFile(`/rh/espace/candidatures/${a.id}/cv/`, `CV ${a.full_name}`.trim());
    } catch {
      toast.error("Téléchargement du CV impossible.");
    }
  }

  const pagedApps = apps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusOptions = [{ value: "", label: "Tous les statuts" }].concat(
    (overview?.statuses ?? []).map((s) => ({ value: String(s.value), label: s.label })),
  );
  const offerOptions = [{ value: "", label: "Toutes mes offres" }].concat(
    offers.map((o) => ({ value: String(o.id), label: o.title })),
  );

  return (
    <div className="p-8">
      <PageHeader
        title="Mes recrutements"
        subtitle="Suivi de vos offres et des candidatures reçues."
      />

      {loading ? (
        <Loading />
      ) : err ? (
        <ErrorState message="Impossible de charger votre espace de suivi." onRetry={loadAll} />
      ) : (
        <>
          {/* Vue d'ensemble : pipeline (restreint à vos offres) */}
          {overview && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Tile icon="bx-user-voice" label="Candidatures reçues" value={overview.applications.total} accent />
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

          {/* Rappel du périmètre : lecture seule */}
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-brand-soft/30 px-4 py-2.5 text-xs text-muted">
            <i className="bx bx-info-circle mt-0.5 text-brand" />
            <span>
              Espace de suivi en lecture seule : la publication des offres et l&apos;avancement des
              candidatures sont gérés par l&apos;équipe HBC. Vous consultez ici le dossier complet
              de vos candidats et leur statut.
            </span>
          </div>

          {/* Onglets */}
          <div className="mb-4 flex gap-1 border-b border-line">
            {[
              { k: "candidatures", label: `Candidatures (${apps.length})` },
              { k: "offres", label: `Mes offres (${offers.length})` },
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
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
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
                <EmptyState icon="bx-user-x" title="Aucune candidature" hint="Les candidatures déposées sur vos offres apparaîtront ici." />
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
                            <td className="px-5 py-3 text-muted">{formatDate(a.created_at)}</td>
                            <td className="px-5 py-3 text-right">
                              <button onClick={() => setDetail(a)} className="btn-ghost text-xs" aria-label={`Voir la candidature de ${a.full_name}`}>
                                <i className="bx bx-show" /> Voir
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
            /* Onglet Offres (lecture seule) */
            offers.length === 0 ? (
              <EmptyState
                icon="bx-briefcase"
                title="Aucune offre"
                hint="Les offres qui vous sont attribuées par l'équipe HBC apparaîtront ici."
              />
            ) : (
              <div className="card divide-y divide-line">
                {offers.map((o) => (
                  <div key={o.id} className="flex items-center gap-4 px-5 py-3.5">
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
                    <Badge tone={o.is_published ? "success" : "neutral"}>
                      {o.is_published ? "Publiée" : "Masquée"}
                    </Badge>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Modale : dossier candidat (lecture seule, sans notes internes) */}
      <Modal
        open={!!detail}
        title={detail ? `Candidature — ${detail.full_name}` : ""}
        onClose={() => setDetail(null)}
        footer={<button onClick={() => setDetail(null)} className="btn-ghost">Fermer</button>}
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Badge tone={STATUS_TONE[detail.status] ?? "neutral"}>{detail.status_label}</Badge>
              {detail.rating != null && <span className="text-sm text-muted">★ {detail.rating}/5</span>}
            </div>
            {/* Coordonnées */}
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
            {detail.cv_url && (
              <button onClick={() => getCv(detail)} className="btn-brand">
                <i className="bx bx-download" /> Télécharger le CV
              </button>
            )}
          </div>
        )}
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
