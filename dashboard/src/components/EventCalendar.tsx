"use client";

import { useMemo, useState } from "react";
import type { EventItem } from "@/lib/types";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function atMidnight(iso: string) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function EventCalendar({
  events,
  writable,
  onSelect,
  onCreate,
}: {
  events: EventItem[];
  writable: boolean;
  onSelect: (e: EventItem) => void;
  onCreate: (dateISO: string) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const { cells, byDay } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Lundi = 0
    const gridStart = new Date(year, month, 1 - startWeekday);

    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
    }

    // Répartit chaque événement sur tous les jours qu'il couvre.
    const byDay: Record<string, EventItem[]> = {};
    for (const e of events) {
      if (!e.start_time) continue;
      const start = atMidnight(e.start_time);
      const end = e.end_time ? atMidnight(e.end_time) : start;
      const d = new Date(start);
      let guard = 0;
      while (d <= end && guard < 60) {
        (byDay[dayKey(d)] ||= []).push(e);
        d.setDate(d.getDate() + 1);
        guard++;
      }
    }
    return { cells, byDay };
  }, [cursor, events]);

  const month = cursor.getMonth();
  const isToday = (d: Date) => dayKey(d) === dayKey(today);

  return (
    <div className="card overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h3 className="font-heading text-lg font-semibold capitalize text-brand-deep">
          {MONTHS[month]} {cursor.getFullYear()}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="btn-ghost text-xs"
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="btn-ghost"
            aria-label="Mois précédent"
          >
            <i className="bx bx-chevron-left" />
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="btn-ghost"
            aria-label="Mois suivant"
          >
            <i className="bx bx-chevron-right" />
          </button>
        </div>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 border-b border-line bg-brand-soft/40 text-center text-xs font-semibold uppercase text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const evs = byDay[dayKey(d)] || [];
          return (
            <div
              key={i}
              onClick={() => writable && onCreate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9).toISOString())}
              className={`min-h-[96px] border-b border-r border-line p-1.5 ${
                (i + 1) % 7 === 0 ? "border-r-0" : ""
              } ${inMonth ? "bg-white" : "bg-gray-50/60"} ${writable ? "cursor-pointer hover:bg-brand-soft/30" : ""}`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday(d) ? "bg-accent font-bold text-white" : inMonth ? "text-ink" : "text-muted/50"
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {evs.slice(0, 3).map((e) => (
                  <button
                    key={e.id + dayKey(d)}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelect(e);
                    }}
                    className="block w-full truncate rounded bg-brand px-1.5 py-0.5 text-left text-[11px] font-medium text-white hover:bg-brand-deep"
                    title={e.title}
                  >
                    {e.title}
                  </button>
                ))}
                {evs.length > 3 && <div className="px-1 text-[10px] text-muted">+{evs.length - 3} autre(s)</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
