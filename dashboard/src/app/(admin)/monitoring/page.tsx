"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, Loading, ErrorState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { MonitoringOverview } from "@/lib/types";

const STATUT_META: Record<string, { label: string; cls: string; icon: string }> = {
  ok: { label: "Tout fonctionne", cls: "border-emerald-300 bg-emerald-50 text-emerald-800", icon: "bx-check-circle" },
  attention: { label: "Points d'attention", cls: "border-amber-300 bg-amber-50 text-amber-800", icon: "bx-error" },
  critique: { label: "Incident en cours", cls: "border-rose-300 bg-rose-50 text-rose-800", icon: "bx-error-circle" },
};

const REFRESH_MS = 30_000;

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await api<MonitoringOverview>("/monitoring/overview/");
      setData(d);
      setErr(false);
      setLastAt(new Date().toLocaleTimeString("fr-FR"));
    } catch {
      if (!silent) setErr(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(() => load(true), REFRESH_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]);

  const meta = data ? STATUT_META[data.statut] ?? STATUT_META.attention : null;

  return (
    <div className="p-8">
      <PageHeader
        title="Monitoring"
        subtitle="Santé technique de la plateforme et activité en temps quasi réel."
        actions={
          <button onClick={() => load()} className="btn-ghost" aria-label="Rafraîchir">
            <i className="bx bx-refresh" /> Rafraîchir
          </button>
        }
      />

      {loading && !data ? (
        <Loading />
      ) : err && !data ? (
        <ErrorState message="Impossible de charger le monitoring." onRetry={() => load()} />
      ) : data && meta ? (
        <>
          {/* Bannière d'état global */}
          <div className={`mb-6 flex items-start gap-3 rounded-xl border px-5 py-4 ${meta.cls}`}>
            <i className={`bx ${meta.icon} text-2xl`} />
            <div className="flex-1">
              <div className="font-heading text-lg font-bold">{meta.label}</div>
              {data.alertes.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {data.alertes.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              ) : (
                <div className="mt-0.5 text-sm">Aucune anomalie détectée sur les dernières 24 h.</div>
              )}
            </div>
            {lastAt && <div className="whitespace-nowrap text-xs opacity-70">màj {lastAt}</div>}
          </div>

          {/* Services */}
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Services</h2>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Service label="Base de données" up={data.services.database === "ok"} detail={data.services.database === "ok" ? "Répond" : "Injoignable"} />
            <Service
              label="Ordonnanceur (crons)"
              up={data.services.scheduler.running}
              detail={data.services.scheduler.running
                ? `${data.services.scheduler.schedules} planification(s)`
                : "Inactif — crons non exécutés"}
            />
            <Tile icon="bx-envelope" tone={data.emails_echec_24h ? "warn" : "ok"} value={data.emails_echec_24h} label="E-mails en échec · 24 h" />
            <Tile icon="bx-link-alt" tone={data.webhooks_erreurs_24h ? "warn" : "ok"} value={data.webhooks_erreurs_24h} label="Erreurs webhook · 24 h" />
          </div>

          {/* Paiements */}
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Paiements</h2>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile icon="bx-check-shield" tone="ok" value={data.paiements.valides_24h} label="Validés · 24 h" />
            <Tile icon="bx-time" tone="neutral" value={data.paiements.en_attente} label="En attente" />
            <Tile icon="bx-error-circle" tone={data.paiements.bloques ? "crit" : "ok"} value={data.paiements.bloques} label={`Bloqués > ${data.paiements.seuil_minutes} min`} />
            <Tile icon="bx-calendar-check" tone="neutral" value={data.services.scheduler.schedules} label="Tâches planifiées" />
          </div>

          {/* Activité récente */}
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Activité récente</h2>
          <div className="card overflow-x-auto">
            {data.activite_recente.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted">Aucune activité récente.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.activite_recente.map((e) => (
                    <tr key={e.id} className="border-b border-line/60 last:border-0">
                      <td className="whitespace-nowrap px-5 py-2.5 text-muted tabular-nums">{formatDateTime(e.created_at)}</td>
                      <td className="px-5 py-2.5 font-medium text-brand-deep">{e.action}</td>
                      <td className="px-5 py-2.5 text-muted">{e.entite_type ? `${e.entite_type}${e.entite_id ? ` #${e.entite_id}` : ""}` : "—"}</td>
                      <td className="px-5 py-2.5 text-muted">{e.user || "système"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">Rafraîchissement automatique toutes les 30 s.</p>
        </>
      ) : null}
    </div>
  );
}

function Service({ label, up, detail }: { label: string; up: boolean; detail: string }) {
  return (
    <div className="card flex items-center gap-3 p-5">
      <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${up ? "bg-emerald-500" : "bg-rose-500"}`} aria-hidden />
      <div className="min-w-0">
        <div className="font-medium text-brand-deep">{label}</div>
        <div className="truncate text-xs text-muted">{detail}</div>
      </div>
    </div>
  );
}

function Tile({ icon, value, label, tone }: { icon: string; value: number; label: string; tone: "ok" | "warn" | "crit" | "neutral" }) {
  const toneCls = {
    ok: "bg-emerald-50 text-emerald-600",
    warn: "bg-amber-50 text-amber-600",
    crit: "bg-rose-50 text-rose-600",
    neutral: "bg-brand-soft text-brand",
  }[tone];
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${toneCls}`}>
        <i className={`bx ${icon}`} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-brand-deep tabular-nums">{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}
