"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Loading, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { SuiviResponse, SuiviFormation, SuiviLearner } from "@/lib/types";

function Bar({ percent }: { percent: number }) {
  const color = percent >= 100 ? "bg-emerald-500" : percent >= 50 ? "bg-brand" : "bg-accent";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold text-ink">{percent}%</span>
    </div>
  );
}

function scoreTone(p: number) {
  return p >= 70 ? "bg-emerald-50 text-emerald-700" : p >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
}

function LearnerRow({ l }: { l: SuiviLearner }) {
  return (
    <tr className="border-t border-line align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-brand-deep">{l.name}</div>
        <div className="text-xs text-muted">{l.email}</div>
      </td>
      <td className="px-4 py-3">
        <Bar percent={l.progress.percent} />
        <div className="mt-0.5 text-[11px] text-muted">
          {l.progress.done}/{l.progress.total} activité(s)
        </div>
      </td>
      <td className="px-4 py-3">
        {l.quizzes.length === 0 ? (
          <span className="text-xs text-muted">— aucun quiz passé —</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {l.quizzes.map((q) => (
              <span
                key={q.activity_id}
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${scoreTone(q.percent)}`}
                title={q.title}
              >
                {q.title}: {q.score}/{q.max_score} ({q.percent}%)
              </span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

// « 12 mars → 20 mars 2026 », ou la seule date de début si la fin manque.
function fmtSession(debut: string, fin?: string | null) {
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const d = new Date(debut).toLocaleDateString("fr-FR", o);
  return fin ? `${d} → ${new Date(fin).toLocaleDateString("fr-FR", o)}` : `dès le ${d}`;
}

function FormationBlock({ f }: { f: SuiviFormation }) {
  const [open, setOpen] = useState(true);
  const avg = useMemo(
    () => (f.learners.length ? Math.round(f.learners.reduce((s, l) => s + l.progress.percent, 0) / f.learners.length) : 0),
    [f.learners],
  );
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-brand-soft/40">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-xl text-brand">
          <i className="bx bx-book-open" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-brand-deep">{f.title}</div>
          {/* On suit une session, pas un programme : les dates la situent, et le
              programme rappelle quel contenu est suivi. */}
          <div className="flex flex-wrap gap-x-3 text-xs text-muted">
            {f.date_debut && (
              <span><i className="bx bx-calendar" /> {fmtSession(f.date_debut, f.date_fin)}</span>
            )}
            {f.mode === 2 && <span><i className="bx bx-infinite" /> Accès libre</span>}
            {!!f.programmes?.length && (
              <span className="truncate"><i className="bx bx-book-open" /> {f.programmes.join(", ")}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted">
            <span><i className="bx bx-group" /> {f.learners_count} apprenant(s)</span>
            <span><i className="bx bx-play-circle" /> {f.activities_total} activité(s)</span>
            <span><i className="bx bx-help-circle" /> {f.quiz_count} quiz</span>
            <span><i className="bx bx-trending-up" /> progression moy. {avg}%</span>
          </div>
        </div>
        <i className={`bx bx-chevron-down text-xl text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        (f.learners.length === 0 ? (
          <p className="border-t border-line px-5 py-4 text-sm text-muted">Aucun apprenant inscrit (confirmé) pour l&apos;instant.</p>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-semibold">Apprenant</th>
                  <th className="px-4 py-2 font-semibold">Progression</th>
                  <th className="px-4 py-2 font-semibold">Scores quiz</th>
                </tr>
              </thead>
              <tbody>
                {f.learners.map((l) => (
                  <LearnerRow key={l.id} l={l} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

export default function SuiviPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<SuiviResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<SuiviResponse>("/modules/suivi/")
      .then(setData)
      .catch((e) => setErr(String(e instanceof Error ? e.message : e).slice(0, 200)))
      .finally(() => setLoading(false));
  }, []);

  const formations = data?.formations ?? [];
  const totalLearners = formations.reduce((s, f) => s + f.learners_count, 0);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Suivi apprenants"
        subtitle={
          profile?.is_teacher && !profile?.is_admin
            ? "Progression et résultats des apprenants de vos formations."
            : "Progression et résultats des apprenants, formation par formation."
        }
      />

      {loading ? (
        <Loading />
      ) : err ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : formations.length === 0 ? (
        <p className="text-muted">Aucune formation à suivre pour l&apos;instant.</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="card flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand"><i className="bx bx-book" /></div>
              <div><div className="text-2xl font-bold text-brand-deep">{formations.length}</div><div className="text-xs text-muted">Formation(s)</div></div>
            </div>
            <div className="card flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand"><i className="bx bx-group" /></div>
              <div><div className="text-2xl font-bold text-brand-deep">{totalLearners}</div><div className="text-xs text-muted">Inscription(s) suivie(s)</div></div>
            </div>
            <div className="card flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand"><i className="bx bx-help-circle" /></div>
              <div><div className="text-2xl font-bold text-brand-deep">{formations.reduce((s, f) => s + f.quiz_count, 0)}</div><div className="text-xs text-muted">Quiz au total</div></div>
            </div>
          </div>

          <div className="space-y-4">
            {formations.map((f) => (
              <FormationBlock key={f.id} f={f} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
