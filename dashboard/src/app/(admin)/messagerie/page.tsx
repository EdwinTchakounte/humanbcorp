"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import { Loading, EmptyState, PageHeader } from "@/components/ui";
import type { ChatProjectItem, ChatMessageItem, MessagerieOverview } from "@/lib/types";

function fmtDate(iso: string) {
  return iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default function MessageriePage() {
  const [projects, setProjects] = useState<ChatProjectItem[]>([]);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [overview, setOverview] = useState<MessagerieOverview | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listAll<ChatProjectItem>("/modules/projects/"),
      listAll<ChatMessageItem>("/modules/messages/"),
      api<MessagerieOverview>("/modules/messagerie/overview/"),
    ])
      .then(([p, m, o]) => {
        setProjects(p);
        setMessages(m);
        setOverview(o);
        if (p.length) setActive(p[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const shown = active ? messages.filter((m) => m.project === active) : messages;

  const tiles = overview
    ? [
        { label: "Conversations", value: overview.counts.projects, icon: "bx-conversation" },
        { label: "Messages", value: overview.counts.messages, icon: "bx-message-rounded" },
        { label: "Répondus", value: overview.counts.answered, icon: "bx-message-rounded-check" },
      ]
    : [];

  return (
    <div className="p-8">
      <PageHeader title="Messagerie" subtitle="Conversations et messages de l'assistant." />

      {overview && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {tiles.map((s) => (
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
      )}

      {loading ? (
        <Loading />
      ) : projects.length === 0 ? (
        <EmptyState icon="bx-chat" title="Aucune conversation" hint="Les échanges avec l'assistant apparaîtront ici." />
      ) : (
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          {/* Liste des conversations */}
          <div className="card h-fit divide-y divide-line">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  active === p.id ? "bg-brand-soft" : "hover:bg-brand-soft/50"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <i className="bx bx-conversation" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-brand-deep">{p.name}</div>
                  <div className="text-xs text-muted">
                    {p.user_name} · {p.messages_count} msg
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Fil de messages */}
          <div className="card p-5">
            {shown.length === 0 ? (
              <EmptyState icon="bx-message-square-detail" title="Aucun message" hint="Cette conversation ne contient pas encore de message." />
            ) : (
              <div className="space-y-4">
                {shown.map((m) => (
                  <div key={m.id} className="space-y-2">
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-sm text-white">
                        {m.message}
                        <div className="mt-1 text-[10px] text-white/60">
                          {m.user_name} · {fmtDate(m.timestamp)}
                        </div>
                      </div>
                    </div>
                    {m.response && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-brand-soft px-4 py-2 text-sm text-brand-deep">
                          <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-brand">
                            <i className="bx bx-bot" /> Assistant
                          </div>
                          {/* La réponse de l'assistant est du HTML (comme le template Django |safe). */}
                          <div
                            className="chat-response space-y-2 [&_a]:text-brand [&_a]:underline [&_li]:ml-4 [&_li]:list-disc"
                            dangerouslySetInnerHTML={{ __html: m.response }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
