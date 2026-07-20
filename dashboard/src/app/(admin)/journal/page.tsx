"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  PageHeader, Loading, ErrorState, EmptyState, Badge, SelectField,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry, AuditFacets } from "@/lib/types";

type Paged = { count: number; next: string | null; previous: string | null; results: AuditEntry[] };

// Ton de pastille selon la nature de l'action (préfixe domaine.verbe).
function actionTone(a: string): "neutral" | "info" | "warning" | "danger" | "success" {
  if (/(rejected|deleted|failed|error|unknown)/.test(a)) return "danger";
  if (/(confirmed|created|granted|added)/.test(a)) return "success";
  if (/payment\./.test(a)) return "info";
  if (/(updated|status)/.test(a)) return "warning";
  return "neutral";
}

/** Rend le `details` JSON de façon lisible : les paires [avant, après] deviennent
 *  « avant → après », le reste est affiché en clé : valeur. */
function DetailBlock({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details || {});
  if (entries.length === 0) return <span className="text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {entries.map(([k, v]) => {
        const arrow = Array.isArray(v) && v.length === 2;
        return (
          <span key={k} className="text-xs">
            <span className="text-muted">{k} : </span>
            {arrow ? (
              <span className="font-medium">
                {String((v as unknown[])[0] ?? "∅")} <span className="text-muted">→</span>{" "}
                {String((v as unknown[])[1] ?? "∅")}
              </span>
            ) : (
              <span className="font-medium">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function JournalPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [data, setData] = useState<Paged | null>(null);
  const [facets, setFacets] = useState<AuditFacets | null>(null);
  const [page, setPage] = useState(1);

  const [fAction, setFAction] = useState("");
  const [fType, setFType] = useState("");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async (pageNo: number, filters: { action: string; type: string; q: string }) => {
    setLoading(true);
    setErr(false);
    try {
      const p = new URLSearchParams({ page: String(pageNo) });
      if (filters.action) p.set("action", filters.action);
      if (filters.type) p.set("entite_type", filters.type);
      if (filters.q.trim()) p.set("q", filters.q.trim());
      const [d, f] = await Promise.all([
        api<Paged>(`/audit/journal/?${p.toString()}`),
        facets ? Promise.resolve(facets) : api<AuditFacets>("/audit/journal/facets/"),
      ]);
      setData(d);
      if (!facets) setFacets(f as AuditFacets);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facets]);

  useEffect(() => {
    load(1, { action: "", type: "", q: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(next: Partial<{ action: string; type: string; q: string }>) {
    const filters = { action: next.action ?? fAction, type: next.type ?? fType, q: next.q ?? q };
    if (next.action !== undefined) setFAction(next.action);
    if (next.type !== undefined) setFType(next.type);
    setPage(1);
    load(1, filters);
  }

  function goPage(n: number) {
    setPage(n);
    load(n, { action: fAction, type: fType, q });
  }

  const rows = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / 50)) : 1;

  return (
    <div className="p-8">
      <PageHeader
        title="Journal d'audit"
        subtitle="Traçabilité des actions sensibles : qui a fait quoi, quand — journal immuable."
      />

      {/* Filtres */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Action"
          value={fAction}
          onChange={(v) => applyFilters({ action: v })}
          options={[{ value: "", label: "Toutes les actions" }].concat(
            (facets?.actions ?? []).map((a) => ({ value: a, label: a })),
          )}
        />
        <SelectField
          label="Type d'entité"
          value={fType}
          onChange={(v) => applyFilters({ type: v })}
          options={[{ value: "", label: "Tous les types" }].concat(
            (facets?.entite_types ?? []).map((t) => ({ value: t, label: t })),
          )}
        />
        <div>
          <label className="label">Recherche</label>
          <input
            className="input" value={q} placeholder="Action, entité, acteur, IP…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilters({ q }); }}
          />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : err ? (
        <ErrorState message="Impossible de charger le journal d'audit." onRetry={() => load(page, { action: fAction, type: fType, q })} />
      ) : rows.length === 0 ? (
        <EmptyState icon="bx-history" title="Aucune entrée" hint="Les actions sensibles (paiements, candidatures, offres…) apparaîtront ici." />
      ) : (
        <>
          <div className="mb-2 text-sm text-muted">
            {data?.count} entrée(s){facets ? ` · ${facets.total} au total` : ""}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th className="px-5 py-3">Horodatage</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entité</th>
                  <th className="px-5 py-3">Acteur</th>
                  <th className="px-5 py-3">Détails</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-brand-soft/40"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-muted tabular-nums">{formatDateTime(e.created_at)}</td>
                    <td className="px-5 py-3"><Badge tone={actionTone(e.action)}>{e.action}</Badge></td>
                    <td className="px-5 py-3 text-muted">
                      {e.entite_type ? `${e.entite_type}${e.entite_id ? ` #${e.entite_id}` : ""}` : "—"}
                    </td>
                    <td className="px-5 py-3">{e.user_name || <span className="text-muted">système</span>}</td>
                    <td className="px-5 py-3">
                      {expanded === e.id ? (
                        <div className="space-y-1">
                          <DetailBlock details={e.details} />
                          {e.ip && <div className="text-xs text-muted">IP : {e.ip}</div>}
                        </div>
                      ) : (
                        <DetailBlock details={e.details} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination serveur */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button className="btn-ghost disabled:opacity-40" disabled={!data?.previous} onClick={() => goPage(page - 1)}>
                <i className="bx bx-chevron-left" /> Précédent
              </button>
              <span className="text-muted tabular-nums">Page {page} / {totalPages}</span>
              <button className="btn-ghost disabled:opacity-40" disabled={!data?.next} onClick={() => goPage(page + 1)}>
                Suivant <i className="bx bx-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
