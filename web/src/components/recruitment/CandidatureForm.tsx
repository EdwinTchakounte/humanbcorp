"use client";

import { useState } from "react";
import { submitCandidature, type Lang } from "@/lib/api";

const L = {
  fr: {
    apply: "Postuler",
    offerLabel: (t: string) => `Offre : ${t}`,
    spontaneous: "Candidature spontanée",
    sentTitle: "Candidature envoyée !",
    firstName: "Prénom",
    lastName: "Nom",
    email: "Email",
    phone: "Téléphone",
    letter: "Lettre de motivation",
    letterPh: "Quelques mots sur votre motivation…",
    cv: "CV (PDF, DOC ou DOCX — 5 Mo max)",
    sending: "Envoi…",
    send: "Envoyer ma candidature",
  },
  en: {
    apply: "Apply",
    offerLabel: (t: string) => `Position: ${t}`,
    spontaneous: "Open application",
    sentTitle: "Application sent!",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    letter: "Cover letter",
    letterPh: "A few words about your motivation…",
    cv: "CV (PDF, DOC or DOCX — 5 MB max)",
    sending: "Sending…",
    send: "Send my application",
  },
} as const;

export default function CandidatureForm({
  offerSlug,
  offerTitle,
  lang = "fr",
}: {
  offerSlug?: string;
  offerTitle?: string;
  lang?: Lang;
}) {
  const t = L[lang];
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const fd = new FormData(e.currentTarget);
    if (offerSlug) fd.set("offer_slug", offerSlug);
    const res = await submitCandidature(fd);
    setStatus(res.ok ? "ok" : "error");
    setMsg(res.detail);
    if (res.ok) e.currentTarget.reset();
  }

  if (status === "ok") {
    return (
      <div className="rounded-2xl border border-line/70 bg-white p-8 text-center shadow-hbc">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-3xl text-green-600">
          <i className="bx bx-check-circle" />
        </div>
        <h4 className="text-base font-semibold text-ink">{t.sentTitle}</h4>
        <p className="mt-2 text-sm text-muted">{msg}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-line/70 bg-white p-6 shadow-hbc md:p-8">
      <h3 className="mb-1 text-lg">{t.apply}</h3>
      <p className="mb-5 text-sm text-muted">{offerTitle ? t.offerLabel(offerTitle) : t.spontaneous}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="first_name" label={t.firstName} required />
        <Field name="last_name" label={t.lastName} />
        <Field name="email" label={t.email} type="email" required />
        <Field name="phone" label={t.phone} />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{t.letter}</label>
          <textarea name="cover_letter" rows={4} className="hbc-input" placeholder={t.letterPh} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            {t.cv} <span className="text-accent">*</span>
          </label>
          <input
            name="cv"
            type="file"
            accept=".pdf,.doc,.docx"
            required
            className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand hover:file:bg-brand-soft/70"
          />
        </div>
      </div>

      <button type="submit" disabled={status === "sending"} className="btn-accent mt-5 w-full">
        {status === "sending" ? (
          t.sending
        ) : (
          <>
            <i className="bx bx-send" /> {t.send}
          </>
        )}
      </button>

      {status === "error" && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <i className="bx bx-error-circle text-lg" /> {msg}
        </p>
      )}
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <input name={name} type={type} required={required} className="hbc-input" />
    </div>
  );
}
