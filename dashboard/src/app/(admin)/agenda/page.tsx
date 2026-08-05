"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import { Modal, Pagination, PAGE_SIZE, TextField, TextArea, SelectField } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import EventCalendar from "@/components/EventCalendar";
import type { EventItem, MeetingItem, PublicationItem, SeanceItem } from "@/lib/types";

// Aligné sur calendarapp.Meeting.TYPES_CHOICES (0=Google Meet, 1=Zoom, 2=Présentiel).
const MEETING_TYPES: Record<number, string> = { 0: "Google Meet", 1: "Zoom", 2: "Présentiel" };

function fmt(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}
// ISO → valeur pour <input type="datetime-local">
function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

type Draft = { id?: number; title: string; description: string; start_time: string; end_time: string; publication: string; seance: string };
const EMPTY: Draft = { title: "", description: "", start_time: "", end_time: "", publication: "", seance: "" };

const MEETING_TYPE_OPTIONS = [
  { value: "0", label: "Google Meet" },
  { value: "1", label: "Zoom" },
  { value: "2", label: "Présentiel" },
];
type MeetDraft = { id?: number; event: string; m_type: string; link_url: string };

export default function AgendaPage() {
  const { isAdmin, canWrite } = useAuth();
  const writable = canWrite("agenda");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [pubs, setPubs] = useState<PublicationItem[]>([]);
  // Séances proposées : uniquement celles des programmes vendus par la session
  // choisie — le back refuse toute autre (elle daterait la séance d'une autre
  // formation).
  const [seances, setSeances] = useState<SeanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [mPage, setMPage] = useState(1);
  const [view, setView] = useState<"calendar" | "list">("calendar");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [mDraft, setMDraft] = useState<MeetDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [parts, setParts] = useState<{ event: EventItem; list: { id: number; name: string; email: string }[] } | null>(null);

  async function showParticipants(e: EventItem) {
    setParts({ event: e, list: [] });
    const list = await api<{ id: number; name: string; email: string }[]>(`/modules/events/${e.id}/participants/`);
    setParts({ event: e, list });
  }

  async function saveMeeting() {
    if (!mDraft) return;
    if (!mDraft.event) {
      setErr("Choisissez l'événement.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const body = { event: Number(mDraft.event), m_type: Number(mDraft.m_type), link_url: mDraft.link_url || null };
      if (mDraft.id) await api(`/modules/meetings/${mDraft.id}/`, { method: "PATCH", body });
      else await api("/modules/meetings/", { method: "POST", body });
      await load();
      setMDraft(null);
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }
  async function delMeeting(m: MeetingItem) {
    if (!confirm("Supprimer ce rendez-vous ?")) return;
    await api(`/modules/meetings/${m.id}/`, { method: "DELETE" });
    setMeetings((xs) => xs.filter((x) => x.id !== m.id));
  }

  async function load() {
    const [e, m, t] = await Promise.all([
      listAll<EventItem>("/modules/events/"),
      listAll<MeetingItem>("/modules/meetings/"),
      listAll<PublicationItem>("/modules/publications/"),
    ]);
    setEvents(e);
    setMeetings(m);
    setPubs(t);
  }
  // Les séances dépendent de la session choisie : on les recharge à chaque
  // changement, en concaténant les programmes vendus par cette session.
  useEffect(() => {
    const pubId = draft?.publication;
    if (!pubId) {
      setSeances([]);
      return;
    }
    const pub = pubs.find((p) => String(p.id) === String(pubId));
    const themeIds = (pub?.themes_titles ?? []).map((t) => t.id);
    if (themeIds.length === 0) {
      setSeances([]);
      return;
    }
    let annule = false;
    Promise.all(themeIds.map((id) => listAll<SeanceItem>(`/modules/seances/?theme=${id}`)))
      .then((listes) => {
        if (!annule) setSeances(listes.flat());
      })
      .catch(() => setSeances([]));
    return () => {
      annule = true;
    };
  }, [draft?.publication, pubs]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const upcoming = events.filter((e) => new Date(e.end_time) >= new Date()).length;
  const pagedEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedMeetings = meetings.slice((mPage - 1) * PAGE_SIZE, mPage * PAGE_SIZE);

  function openCreate() {
    setErr("");
    setDraft({ ...EMPTY });
  }
  function openCreateOn(dateISO: string) {
    setErr("");
    const start = toLocalInput(dateISO);
    const end = toLocalInput(new Date(new Date(dateISO).getTime() + 3600000).toISOString());
    setDraft({ ...EMPTY, start_time: start, end_time: end });
  }
  function openEdit(e: EventItem) {
    setErr("");
    setDraft({
      id: e.id,
      title: e.title,
      description: e.description,
      start_time: toLocalInput(e.start_time),
      end_time: toLocalInput(e.end_time),
      publication: e.publication_id ? String(e.publication_id) : "",
      seance: e.seance ? String(e.seance) : "",
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.title || !draft.start_time || !draft.end_time) {
      setErr("Titre, début et fin sont requis.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const body = {
        title: draft.title,
        description: draft.description,
        start_time: new Date(draft.start_time).toISOString(),
        end_time: new Date(draft.end_time).toISOString(),
        publication: draft.publication ? Number(draft.publication) : null,
        seance: draft.seance ? Number(draft.seance) : null,
      };
      if (draft.id) await api(`/modules/events/${draft.id}/`, { method: "PATCH", body });
      else await api("/modules/events/", { method: "POST", body });
      await load();
      setDraft(null);
    } catch (e) {
      setErr(String(e).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }

  async function del(e: EventItem) {
    if (!confirm(`Supprimer l'événement « ${e.title} » ?`)) return;
    await api(`/modules/events/${e.id}/`, { method: "DELETE" });
    setEvents((xs) => xs.filter((x) => x.id !== e.id));
  }

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Agenda</h1>
          <p className="text-sm text-muted">Gérez vos événements et rendez-vous.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line p-0.5">
            <button
              onClick={() => setView("calendar")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === "calendar" ? "bg-brand text-white" : "text-muted hover:text-brand-deep"
              }`}
            >
              <i className="bx bx-calendar" /> Calendrier
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === "list" ? "bg-brand text-white" : "text-muted hover:text-brand-deep"
              }`}
            >
              <i className="bx bx-list-ul" /> Liste
            </button>
          </div>
          {writable && (
            <button onClick={openCreate} className="btn-accent">
              <i className="bx bx-plus" /> Nouvel événement
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Événements", value: events.length, icon: "bx-calendar-event" },
              { label: "À venir", value: upcoming, icon: "bx-time-five" },
              { label: "Rendez-vous", value: meetings.length, icon: "bx-video" },
            ].map((s) => (
              <div key={s.label} className="card flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand">
                  <i className={`bx ${s.icon}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-brand-deep">{s.value}</div>
                  <div className="text-xs text-muted">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <section className="mb-8">
            <h3 className="mb-3 font-heading text-lg text-brand-deep">Événements</h3>
            {view === "calendar" ? (
              <EventCalendar events={events} writable={writable} onSelect={openEdit} onCreate={openCreateOn} />
            ) : events.length === 0 ? (
              <p className="text-sm text-muted">Aucun événement. Créez-en un.</p>
            ) : (
              <>
                <div className="card divide-y divide-line">
                  {pagedEvents.map((e) => (
                    <div key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                        <i className="bx bx-calendar" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-brand-deep">{e.title}</span>
                          {e.publication_title && (
                            <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">
                              <i className="bx bx-book" /> {e.publication_title}
                            </span>
                          )}
                          {e.publication_title && (
                            <button
                              onClick={() => showParticipants(e)}
                              className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/20"
                              title="Voir les participants"
                            >
                              <i className="bx bx-group" /> {e.participants_count} participant{e.participants_count > 1 ? "s" : ""}
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-muted">
                          {fmt(e.start_time)} → {fmt(e.end_time)} · {e.user_name}
                        </div>
                      </div>
                      {writable && (
                        <>
                          <button onClick={() => openEdit(e)} className="btn-ghost" title="Éditer">
                            <i className="bx bx-edit" />
                          </button>
                          <button onClick={() => del(e)} className="btn-danger" title="Supprimer">
                            <i className="bx bx-trash" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <Pagination page={page} total={events.length} onPage={setPage} />
              </>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg text-brand-deep">Rendez-vous</h3>
              {writable && (
                <button onClick={() => { setErr(""); setMDraft({ event: "", m_type: "0", link_url: "" }); }} className="btn-ghost text-sm">
                  <i className="bx bx-plus" /> Rendez-vous
                </button>
              )}
            </div>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted">Aucun rendez-vous.</p>
            ) : (
              <>
                <div className="card divide-y divide-line">
                  {pagedMeetings.map((m) => (
                    <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                        <i className="bx bx-video" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-brand-deep">{m.event_title || `RDV #${m.id}`}</div>
                        <div className="text-xs text-muted">{MEETING_TYPES[m.m_type] ?? "Type " + m.m_type}</div>
                      </div>
                      {m.link_url && (
                        <a href={m.link_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">
                          <i className="bx bx-link-external" /> Lien
                        </a>
                      )}
                      {writable && (
                        <>
                          <button onClick={() => { setErr(""); setMDraft({ id: m.id, event: String(m.event), m_type: String(m.m_type), link_url: m.link_url || "" }); }} className="btn-ghost text-xs" title="Éditer">
                            <i className="bx bx-edit" />
                          </button>
                          <button onClick={() => delMeeting(m)} className="btn-danger text-xs" title="Supprimer">
                            <i className="bx bx-trash" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <Pagination page={mPage} total={meetings.length} onPage={setMPage} />
              </>
            )}
          </section>
        </>
      )}

      {/* Modale création / édition */}
      <Modal
        open={draft !== null}
        title={!writable ? "Détail de l'événement" : draft?.id ? "Modifier l'événement" : "Nouvel événement"}
        onClose={() => setDraft(null)}
        footer={
          <>
            <button onClick={() => setDraft(null)} className="btn-ghost">
              {writable ? "Annuler" : "Fermer"}
            </button>
            {writable && (
              <button onClick={save} disabled={saving} className="btn-brand">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            )}
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <TextField label="Titre" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
            <TextArea
              label="Description"
              value={draft.description}
              onChange={(v) => setDraft({ ...draft, description: v })}
              rows={3}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Début</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={draft.start_time}
                  onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Fin</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={draft.end_time}
                  onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
                />
              </div>
            </div>
            <SelectField
              label="Session concernée (optionnel)"
              value={draft.publication}
              onChange={(v) => setDraft({ ...draft, publication: v, seance: "" })}
              options={[{ value: "", label: "— Aucune —" }, ...pubs.map((t) => ({ value: String(t.id), label: t.title }))]}
            />
            {draft.publication && (
              <SelectField
                label="Séance du programme (optionnel)"
                value={draft.seance}
                onChange={(v) => setDraft({ ...draft, seance: v })}
                options={[
                  { value: "", label: "— Aucune (réunion, examen, rattrapage…) —" },
                  ...seances.map((s) => ({ value: String(s.id), label: `${s.order}. ${s.title}` })),
                ]}
              />
            )}
            {draft.publication && seances.length === 0 && (
              <p className="-mt-2 text-xs text-muted">
                Le programme de cette session n&apos;a pas encore de séance.
              </p>
            )}
            {err && <p className="text-sm text-red-600">{err}</p>}
            {!isAdmin && (
              <p className="text-xs text-muted">
                <i className="bx bx-info-circle" /> L&apos;événement sera créé à votre nom.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Modale rendez-vous (Meeting) */}
      <Modal
        open={mDraft !== null}
        title={mDraft?.id ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
        onClose={() => setMDraft(null)}
        footer={
          <>
            <button onClick={() => setMDraft(null)} className="btn-ghost">Annuler</button>
            <button onClick={saveMeeting} disabled={saving} className="btn-brand">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </>
        }
      >
        {mDraft && (
          <div className="space-y-4">
            <SelectField
              label="Événement"
              value={mDraft.event}
              onChange={(v) => setMDraft({ ...mDraft, event: v })}
              options={[{ value: "", label: "— Choisir —" }, ...events.map((e) => ({ value: String(e.id), label: e.title }))]}
            />
            <SelectField
              label="Type"
              value={mDraft.m_type}
              onChange={(v) => setMDraft({ ...mDraft, m_type: v })}
              options={MEETING_TYPE_OPTIONS}
            />
            {mDraft.m_type !== "2" && (
              <TextField
                label="Lien de la visio"
                value={mDraft.link_url}
                onChange={(v) => setMDraft({ ...mDraft, link_url: v })}
                placeholder="https://meet.google.com/… ou https://zoom.us/…"
              />
            )}
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>
        )}
      </Modal>

      {/* Modale participants */}
      <Modal
        open={parts !== null}
        title={parts ? `Participants — ${parts.event.title}` : ""}
        onClose={() => setParts(null)}
        footer={<button onClick={() => setParts(null)} className="btn-ghost">Fermer</button>}
      >
        {parts && (
          <div>
            <p className="mb-3 text-sm text-muted">
              Apprenants inscrits (confirmés) à <strong>{parts.event.publication_title}</strong>.
            </p>
            {parts.list.length === 0 ? (
              <p className="text-sm text-muted">Aucun participant confirmé.</p>
            ) : (
              <ul className="divide-y divide-line">
                {parts.list.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                      {(p.name || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                      <div className="truncate text-xs text-muted">{p.email}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
