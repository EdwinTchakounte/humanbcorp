"use client";

import { useState } from "react";
import type { Section } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import Pattern from "@/components/ui/Pattern";
import FloatingIcons from "@/components/ui/FloatingIcons";
import { submitContact } from "@/lib/api";

const SERVICES = [
  "Recrutement local & international",
  "Management des talents",
  "Formation & coaching",
  "Externalisation RH",
  "Autre",
];

export default function Contact({ section }: { section: Section }) {
  const showForm = Boolean(section.options?.form);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries()) as Record<string, string>;
    const res = await submitContact(payload);
    setStatus(res.ok ? "ok" : "error");
    setMsg(res.detail);
    if (res.ok) e.currentTarget.reset();
  }

  return (
    <section id="contact" className="relative overflow-hidden bg-brand-soft py-14 md:py-20">
      <Pattern variant="grid" opacity={0.08} />
      <FloatingIcons opacity={0.05} />
      <div className="container-hbc grid gap-12 md:grid-cols-2">
        <div>
          {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
          <h2 className="mt-3 text-3xl md:text-4xl">{section.title}</h2>
          {section.subtitle && <p className="mt-4 text-lg text-muted">{section.subtitle}</p>}
          <ul className="mt-8 space-y-4">
            {section.cards.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl text-accent shadow-hbc-sm">
                  <Icon name={c.icon || "bxs-chevron-right"} />
                </span>
                <span className="text-ink">{c.title}</span>
              </li>
            ))}
          </ul>
        </div>

        {showForm && (
          <form onSubmit={onSubmit} className="rounded-2xl border border-line/70 bg-white p-6 shadow-hbc md:p-8">
            <h3 className="mb-5 text-lg">Écrivez-nous</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="name" label="Nom" required />
              <Field name="firstname" label="Prénom" />
              <Field name="company" label="Entreprise" full />
              <Field name="email" label="Email" type="email" required />
              <Field name="phone" label="Téléphone" />
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Service souhaité
                </label>
                <select name="service" className="hbc-input" defaultValue="">
                  <option value="" disabled>
                    Sélectionner…
                  </option>
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Votre besoin <span className="text-accent">*</span>
                </label>
                <textarea name="message" required rows={4} className="hbc-input" placeholder="Décrivez votre besoin RH…" />
              </div>
            </div>
            <button type="submit" disabled={status === "sending"} className="btn-accent mt-5 w-full">
              {status === "sending" ? (
                "Envoi…"
              ) : (
                <>
                  <i className="bx bx-send" /> Envoyer ma demande
                </>
              )}
            </button>
            {status === "ok" && (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                <i className="bx bx-check-circle text-lg" /> {msg}
              </p>
            )}
            {status === "error" && (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                <i className="bx bx-error-circle text-lg" /> {msg}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  full = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <input name={name} type={type} required={required} className="hbc-input" />
    </div>
  );
}
