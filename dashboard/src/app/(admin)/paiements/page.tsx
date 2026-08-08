"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import { Pagination, PAGE_SIZE, Badge } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/format";
import type { PaiementItem, PaiementsOverview } from "@/lib/types";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";
const STATUS_TONE: Record<number, BadgeTone> = { 1: "success", 2: "danger", 3: "warning" };
const METHOD_ICON: Record<number, string> = { 1: "bx-money", 2: "bx-mobile", 3: "bxl-paypal" };

export default function PaiementsPage() {
  const [items, setItems] = useState<PaiementItem[]>([]);
  const [overview, setOverview] = useState<PaiementsOverview | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  // Rechargement léger au changement de filtre : le tableau reste affiché.
  const [refetching, setRefetching] = useState(false);
  const [page, setPage] = useState(1);

  async function load(st: string) {
    const path = st ? `/modules/paiements/?status=${st}` : "/modules/paiements/";
    setItems(await listAll<PaiementItem>(path));
  }

  useEffect(() => {
    Promise.all([
      listAll<PaiementItem>("/modules/paiements/"),
      api<PaiementsOverview>("/modules/paiements/overview/"),
    ])
      .then(([p, o]) => {
        setItems(p);
        setOverview(o);
      })
      .finally(() => setLoading(false));
  }, []);

  async function onFilter(st: string) {
    setStatus(st);
    setPage(1);
    setRefetching(true);
    try {
      await load(st);
    } finally {
      setRefetching(false);
    }
  }

  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tiles = overview
    ? [
        { label: "Total encaissé", value: formatMoney(overview.total_encaisse), icon: "bx-wallet", accent: true },
        { label: "Paiements", value: overview.counts.total, icon: "bx-receipt" },
        { label: "Réussis", value: overview.counts.success, icon: "bx-check-circle" },
        { label: "En attente", value: overview.counts.pending, icon: "bx-time-five" },
      ]
    : [];

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl">Paiements</h1>
        <p className="text-sm text-muted">Suivi des transactions.</p>
      </header>

      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          {tiles.map((s) => (
            <div
              key={s.label}
              className={`card flex items-center gap-3 p-4 sm:gap-4 sm:p-5 ${s.accent ? "ring-1 ring-accent/30" : ""}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl sm:h-12 sm:w-12 sm:text-2xl ${
                  s.accent ? "bg-accent/10 text-accent" : "bg-brand-soft text-brand"
                }`}
              >
                <i className={`bx ${s.icon}`} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold leading-tight text-brand-deep sm:text-xl">{s.value}</div>
                <div className="text-xs text-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {overview && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm text-muted">Statut :</label>
          <select className="input max-w-[200px]" value={status} onChange={(e) => onFilter(e.target.value)}>
            <option value="">Tous</option>
            {overview.statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-muted">Aucun paiement.</p>
      ) : (
        <div className={`card overflow-x-auto ${refetching ? "pointer-events-none opacity-50 transition" : "transition"}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-muted">
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Montant</th>
                <th className="px-5 py-3">Méthode</th>
                <th className="px-5 py-3">Tranche</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3 font-medium text-brand-deep">{p.owner_name}</td>
                  <td className="px-5 py-3 font-semibold">{formatMoney(p.montant)}</td>
                  <td className="px-5 py-3">
                    <i className={`bx ${METHOD_ICON[p.method] || "bx-money"} mr-1`} /> {p.method_label}
                  </td>
                  <td className="px-5 py-3 text-muted">{p.tranche === 4 ? "Intégral" : `Tranche ${p.tranche}`}</td>
                  <td className="px-5 py-3 text-muted">{formatDate(p.created_at)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status_label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 pb-4">
            <Pagination page={page} total={items.length} onPage={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
